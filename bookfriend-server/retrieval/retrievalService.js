import { BookChunk } from '../models/BookChunk.js';
import { cosineSimilarity, embedTokens } from '../utils/embeddings.js';
import { stripHtml, tokenize } from '../utils/text.js';

const toChunkText = (chapter) => {
  const title = chapter?.title ? `${chapter.title}. ` : '';
  const html = stripHtml(chapter?.html || '');
  return `${title}${html}`.trim();
};

const getCandidateChunks = (book) => {
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  return chapters
    .map((chapter) => ({
      chapterIndex: chapter.index || null,
      text: toChunkText(chapter),
    }))
    .filter((entry) => entry.text.length > 0);
};

const getBookCacheKey = (book) => {
  if (book?._id) {
    return `id:${book._id}`;
  }

  if (book?.gutenbergId != null) {
    return `gutenberg:${book.gutenbergId}`;
  }

  return `title:${String(book?.title || 'unknown')}`;
};

const getSourceSignature = (chunks) => chunks
  .map((chunk) => `${chunk.chapterIndex ?? 'na'}:${chunk.text.length}`)
  .join('|');

const buildStoredVectors = (chunks) => chunks.map((chunk) => ({
  chapterIndex: chunk.chapterIndex,
  text: chunk.text,
  vector: embedTokens(tokenize(chunk.text)),
}));

const hydrateVectorsFromDb = (records) => records.map((chunk) => ({
  chapterIndex: chunk.chapterIndex ?? null,
  text: String(chunk.text || ''),
  vector: Array.isArray(chunk.vector) ? chunk.vector : [],
}));

const ensureStoredChunkVectors = async (book, chunks) => {
  const bookKey = getBookCacheKey(book);
  const sourceSignature = getSourceSignature(chunks);

  const stored = await BookChunk.find({ bookKey }).lean();
  if (stored.length > 0 && stored.every((item) => item.sourceSignature === sourceSignature)) {
    return hydrateVectorsFromDb(stored);
  }

  const vectors = buildStoredVectors(chunks);

  await BookChunk.deleteMany({ bookKey });
  if (vectors.length) {
    await BookChunk.insertMany(vectors.map((item) => ({
      bookKey,
      chapterIndex: item.chapterIndex,
      text: item.text,
      vector: item.vector,
      sourceSignature,
    })));
  }

  return vectors;
};

export const retrieveRelevantChunks = async ({ book, userMessage, chapterProgress, limit = 4 }) => {
  const chunks = getCandidateChunks(book);

  if (chapterProgress != null) {
    const progressNum = Number(chapterProgress);
    if (Number.isFinite(progressNum)) {
      const spoilerSafe = chunks.filter((chunk) => chunk.chapterIndex == null || chunk.chapterIndex <= progressNum);
      if (spoilerSafe.length > 0) {
        chunks.length = 0;
        chunks.push(...spoilerSafe);
      }
    }
  }

  if (!chunks.length && book?.synopsis) {
    return [{ chapterIndex: null, text: String(book.synopsis) }];
  }

  const chunkVectors = await ensureStoredChunkVectors(book, chunks);
  const queryVector = embedTokens(tokenize(userMessage));

  return chunkVectors
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryVector, chunk.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
    .map(({ chapterIndex, text }) => ({ chapterIndex, text: text.slice(0, 1400) }));
};

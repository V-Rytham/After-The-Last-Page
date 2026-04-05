import { getCache } from '../config/cache.js';
import { cosineSimilarity, embedTokens } from '../utils/embeddings.js';
import { stripHtml, tokenize } from '../utils/text.js';

const vectorTtlSeconds = Number.parseInt(process.env.BOOKFRIEND_VECTOR_CACHE_TTL_SECONDS || '3600', 10);

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

const buildSignature = (chunks) => chunks.map((chunk) => `${chunk.chapterIndex ?? 'na'}:${chunk.text.length}`).join('|');

const getOrBuildChunkVectors = async (book, chunks) => {
  const cache = getCache();
  const cacheKey = `bookfriend:vectors:${getBookCacheKey(book)}`;
  const signature = buildSignature(chunks);

  const raw = await cache.get(cacheKey);
  if (raw) {
    const cached = JSON.parse(raw);
    if (cached?.signature === signature && Array.isArray(cached.vectors)) {
      return cached.vectors;
    }
  }

  const vectors = chunks.map((chunk) => ({
    ...chunk,
    vector: embedTokens(tokenize(chunk.text)),
  }));

  await cache.set(cacheKey, JSON.stringify({ signature, vectors }), 'EX', vectorTtlSeconds);
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

  const chunkVectors = await getOrBuildChunkVectors(book, chunks);
  const queryVector = embedTokens(tokenize(userMessage));

  return chunkVectors
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryVector, chunk.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
    .map(({ chapterIndex, text }) => ({ chapterIndex, text: text.slice(0, 1400) }));
};

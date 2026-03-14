import { scoreChunkOverlap, stripHtml } from '../utils/text.js';

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

export const retrieveRelevantChunks = ({ book, userMessage, chapterProgress, limit = 4 }) => {
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

  return chunks
    .map((chunk) => ({ ...chunk, score: scoreChunkOverlap(userMessage, chunk.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
    .map(({ chapterIndex, text }) => ({ chapterIndex, text: text.slice(0, 1400) }));
};

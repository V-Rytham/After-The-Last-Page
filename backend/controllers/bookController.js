import { success } from '../utils/apiResponse.js';
import { searchBooks, readBook } from '../services/bookSourceService.js';
import { gutenbergCatalog } from '../seed/gutenbergCatalog.js';

const UNAVAILABLE_CHAPTER = {
  index: 1,
  title: 'Unavailable',
  html: '<p>This book is currently unavailable.</p>',
};

const ensureReadContract = (payload) => {
  const chapters = Array.isArray(payload?.chapters)
    ? payload.chapters
      .map((chapter, index) => ({
        index: Number(chapter?.index) || index + 1,
        title: String(chapter?.title || `Chapter ${index + 1}`),
        html: String(chapter?.html || ''),
      }))
      .filter((chapter) => chapter.html)
    : [];

  return {
    title: String(payload?.title || 'Unavailable'),
    author: String(payload?.author || 'Unknown author'),
    chapters: chapters.length > 0 ? chapters : [UNAVAILABLE_CHAPTER],
  };
};

const normalizeCuratedAuthor = (author) => {
  const raw = String(author || '').trim();
  if (!raw) return 'Unknown author';

  if (!raw.includes(',')) return raw;

  const [lastName, ...rest] = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (!lastName || rest.length === 0) return raw;
  return `${rest.join(' ')} ${lastName}`.trim();
};

const curatedDefaultBooks = gutenbergCatalog.slice(0, 50).map((book) => ({
  title: String(book?.title || 'Untitled'),
  author: normalizeCuratedAuthor(book?.author),
  source: 'gutenberg',
  sourceId: String(book?.gutenbergId || ''),
  coverImage: `https://www.gutenberg.org/cache/epub/${encodeURIComponent(String(book?.gutenbergId || ''))}/pg${encodeURIComponent(String(book?.gutenbergId || ''))}.cover.medium.jpg`,
})).filter((book) => book.sourceId);

export const getBooks = async (_req, res) => success(res, []);

export const getBookById = async (_req, res) => success(res, null);

export const searchBooksController = async (req, res) => {
  const query = String(req.query?.q || '').trim();
  if (!query) {
    return success(res, []);
  }

  const results = await searchBooks(query);
  return success(res, results);
};

export const defaultBooksController = async (_req, res) => success(res, curatedDefaultBooks);

export const readBookController = async (req, res) => {
  const source = String(req.query?.source || '').trim();
  const sourceId = String(req.query?.id || '').trim();

  if (!source || !sourceId) {
    return success(res, {
      title: 'Unavailable',
      author: 'Unknown author',
      chapters: [UNAVAILABLE_CHAPTER],
    });
  }

  const payload = await readBook(source, sourceId);
  return success(res, ensureReadContract(payload));
};

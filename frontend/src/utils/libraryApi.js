import api from './api';

export const PLACEHOLDER_COVER = 'https://placehold.co/420x630?text=No+Cover';

export const buildReadRoute = (book) => {
  const source = encodeURIComponent(String(book?.source || 'gutenberg'));
  const sourceId = encodeURIComponent(String(book?.sourceId || book?.id || ''));
  return `/read/${source}/${sourceId}`;
};

export const normalizeBook = (book) => {
  const source = String(book?.source || '').trim().toLowerCase();
  const sourceId = String(book?.sourceId || '').trim();
  if (!source || !sourceId) return null;

  return {
    id: String(book?.id || `${source}:${sourceId}`),
    title: String(book?.title || 'Untitled'),
    author: String(book?.author || 'Unknown author'),
    coverImage: String(book?.coverImage || PLACEHOLDER_COVER),
    source,
    sourceId,
  };
};

export const searchBooks = async (query, signal) => {
  const term = String(query || '').trim();
  if (!term) return [];

  const payload = await api.get('/books/search', {
    params: { q: term },
    signal,
  });

  const list = Array.isArray(payload) ? payload : [];
  return list.map(normalizeBook).filter(Boolean);
};

export const fetchDefaultBooks = async (signal) => {
  const payload = await api.get('/books/default', { signal });
  const list = Array.isArray(payload) ? payload : [];
  return list.map(normalizeBook).filter(Boolean);
};

export const readBook = async ({ source, sourceId }) => {
  const payload = await api.get('/books/read', {
    params: { source, id: sourceId },
  });

  return {
    title: String(payload?.title || 'Unavailable'),
    author: String(payload?.author || 'Unknown author'),
    chapters: Array.isArray(payload?.chapters) ? payload.chapters : [],
  };
};

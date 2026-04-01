const OPEN_LIBRARY_BASE = 'https://covers.openlibrary.org';
const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
const googleThumbnailCache = new Map();

const normalizeIsbn = (value) => {
  if (!value) return null;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeIsbn(entry);
      if (normalized) return normalized;
    }
    return null;
  }

  if (typeof value !== 'string') return null;

  const cleaned = value.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (cleaned.length === 10 || cleaned.length === 13) return cleaned;
  return null;
};

const getBookIsbn = (book) => {
  if (!book) return null;
  return (
    normalizeIsbn(book.isbn) ||
    normalizeIsbn(book.isbn13) ||
    normalizeIsbn(book.isbn10) ||
    normalizeIsbn(book.identifiers?.isbn) ||
    null
  );
};

const buildGoogleQuery = (book) => {
  const isbn = getBookIsbn(book);
  if (isbn) return `isbn:${isbn}`;

  const title = String(book?.title || '').trim();
  const author = String(book?.author || '').trim();
  if (!title) return null;

  return author ? `intitle:${title}+inauthor:${author}` : `intitle:${title}`;
};

export const fetchGoogleBooksThumbnail = async (book) => {
  const query = buildGoogleQuery(book);
  if (!query) return null;

  if (googleThumbnailCache.has(query)) {
    return googleThumbnailCache.get(query);
  }

  try {
    const response = await fetch(
      `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(query)}&maxResults=1&printType=books`
    );

    if (!response.ok) {
      googleThumbnailCache.set(query, null);
      return null;
    }

    const data = await response.json();
    const imageLinks = data?.items?.[0]?.volumeInfo?.imageLinks;
    const thumbnail = imageLinks?.large || imageLinks?.medium || imageLinks?.thumbnail || imageLinks?.smallThumbnail || null;
    const normalizedThumb = thumbnail ? thumbnail.replace('http://', 'https://') : null;
    googleThumbnailCache.set(query, normalizedThumb);
    return normalizedThumb;
  } catch {
    googleThumbnailCache.set(query, null);
    return null;
  }
};

export const getOpenLibraryCoverCandidates = (book) => {
  const candidates = [];

  if (book?.coverImage) {
    candidates.push(book.coverImage);
  }

  const isbn = getBookIsbn(book);
  if (isbn) {
    candidates.push(`${OPEN_LIBRARY_BASE}/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`);
  }

  if (book?.title) {
    const encodedTitle = encodeURIComponent(book.title.trim());
    candidates.push(`${OPEN_LIBRARY_BASE}/b/title/${encodedTitle}-L.jpg?default=false`);
    candidates.push(`${OPEN_LIBRARY_BASE}/b/title/${encodedTitle}.jpg?default=false`);
  }

  return [...new Set(candidates.filter(Boolean))];
};

const FALLBACK_TIMEOUT_MS = 9000;

const normalize = ({ id, title, authors, cover_image, description, source, read_link, download_link }) => ({
  id,
  title: String(title || 'Untitled'),
  authors: Array.isArray(authors) ? authors.filter(Boolean) : [],
  cover_image: cover_image || '',
  description: description || '',
  source,
  read_link: read_link || '',
  download_link: download_link || '',
});

const makeId = (source, key) => `${source}:${String(key || '').trim().toLowerCase()}`;

const fetchJson = async (url, timeoutMs = FALLBACK_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Failed ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const searchOpenLibrary = async (query) => {
  const data = await fetchJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=15`);
  return (Array.isArray(data?.docs) ? data.docs : []).slice(0, 15).map((book) => normalize({
    id: makeId('openlibrary', book.key || `${book.title}-${(book.author_name || [])[0] || ''}`),
    title: book.title,
    authors: book.author_name || [],
    cover_image: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : '',
    description: '',
    source: 'openlibrary',
    read_link: book.key ? `https://openlibrary.org${book.key}` : '',
    download_link: '',
  }));
};

const searchGoogleBooks = async (query) => {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const suffix = key ? `&key=${encodeURIComponent(key)}` : '';
  const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=15${suffix}`);
  return (Array.isArray(data?.items) ? data.items : []).slice(0, 15).map((item) => {
    const info = item.volumeInfo || {};
    return normalize({
      id: makeId('google', item.id || info.title),
      title: info.title,
      authors: info.authors || [],
      cover_image: info.imageLinks?.thumbnail || '',
      description: info.description || '',
      source: 'google',
      read_link: info.infoLink || '',
      download_link: item.accessInfo?.pdf?.acsTokenLink || item.accessInfo?.epub?.acsTokenLink || '',
    });
  });
};

const searchInternetArchive = async (query) => {
  const q = encodeURIComponent(query);
  const data = await fetchJson(`https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier,title,creator,description&rows=15&page=1&output=json`);
  return (Array.isArray(data?.response?.docs) ? data.response.docs : []).slice(0, 15).map((book) => normalize({
    id: makeId('internetarchive', book.identifier || book.title),
    title: book.title,
    authors: Array.isArray(book.creator) ? book.creator : [book.creator].filter(Boolean),
    cover_image: book.identifier ? `https://archive.org/services/img/${book.identifier}` : '',
    description: Array.isArray(book.description) ? book.description[0] : book.description,
    source: 'internetarchive',
    read_link: book.identifier ? `https://archive.org/details/${book.identifier}` : '',
    download_link: book.identifier ? `https://archive.org/download/${book.identifier}` : '',
  }));
};

const dedupeBooks = (books = []) => {
  const index = new Map();
  books.forEach((book) => {
    const fingerprint = `${book.title.toLowerCase()}::${(book.authors[0] || '').toLowerCase()}`;
    if (!index.has(fingerprint)) {
      index.set(fingerprint, book);
    }
  });
  return [...index.values()];
};

export const searchBooksUnified = async (query) => {
  const jobs = await Promise.allSettled([
    searchOpenLibrary(query),
    searchGoogleBooks(query),
    searchInternetArchive(query),
  ]);

  const results = jobs.flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : []));
  return dedupeBooks(results).slice(0, 30);
};

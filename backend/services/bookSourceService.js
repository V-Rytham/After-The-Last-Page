const GUTENDEX_BASE_URL = 'https://gutendex.com';
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';
const REQUEST_TIMEOUT_MS = 12000;

const FALLBACK_COVER = 'https://placehold.co/420x630?text=No+Cover';

const fallbackChapter = {
  index: 1,
  title: 'Unavailable',
  html: '<p>This book is currently unavailable.</p>',
};

const createFallbackRead = ({ title = 'Unavailable', author = 'Unknown author' } = {}) => ({
  title,
  author,
  chapters: [fallbackChapter],
});

const withTimeout = async (url, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const error = new Error(`Request failed with status ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
};

const fetchJson = async (url, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const response = await withTimeout(url, timeoutMs);
  return response.json();
};

const fetchText = async (url, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const response = await withTimeout(url, timeoutMs);
  return response.text();
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const toHtmlParagraphs = (text) => String(text || '')
  .replaceAll('\r\n', '\n')
  .split(/\n{2,}/)
  .map((block) => block.replace(/\n+/g, ' ').trim())
  .filter(Boolean)
  .map((block) => `<p>${escapeHtml(block)}</p>`)
  .join('\n');

const stripGutenbergBoilerplate = (rawText) => {
  const lines = String(rawText || '').replaceAll('\r\n', '\n').split('\n');
  const startIndex = lines.findIndex((line) => /^\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i.test(line.trim()));
  const endIndex = lines.findIndex((line) => /^\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i.test(line.trim()));

  const start = startIndex >= 0 ? startIndex + 1 : 0;
  const end = endIndex > start ? endIndex : lines.length;
  return lines.slice(start, end).join('\n').trim();
};

const splitIntoChapters = (inputText) => {
  const text = String(inputText || '').trim();
  if (!text) return [];

  const lines = text.split('\n');
  const chapterHeading = /^chapter\s+(\d+|[ivxlcdm]+)\b(?:[\s.:\-–—]+(.*))?$/i;
  const chapters = [];

  let activeTitle = null;
  let buffer = [];

  const flush = () => {
    if (!activeTitle) return;
    const body = buffer.join('\n').trim();
    buffer = [];
    if (!body) {
      activeTitle = null;
      return;
    }

    chapters.push({
      index: chapters.length + 1,
      title: activeTitle,
      html: toHtmlParagraphs(body),
    });
    activeTitle = null;
  };

  for (const line of lines) {
    const match = line.trim().match(chapterHeading);
    if (match) {
      flush();
      const suffix = String(match[2] || '').trim();
      activeTitle = suffix ? `Chapter ${match[1]}: ${suffix}` : `Chapter ${match[1]}`;
      continue;
    }

    if (activeTitle) {
      buffer.push(line);
    }
  }

  flush();

  if (chapters.length === 0) {
    const html = toHtmlParagraphs(text);
    return html
      ? [{ index: 1, title: 'Full Text', html }]
      : [];
  }

  return chapters.filter((chapter) => String(chapter?.html || '').trim());
};

const ensureChapters = (chapters) => {
  const safe = Array.isArray(chapters) ? chapters : [];
  const normalized = safe
    .map((chapter, index) => ({
      index: Number(chapter?.index) || index + 1,
      title: String(chapter?.title || `Chapter ${index + 1}`),
      html: String(chapter?.html || ''),
    }))
    .filter((chapter) => chapter.html);

  return normalized.length > 0 ? normalized : [fallbackChapter];
};

const mapGutendexSearchBook = (book) => ({
  id: `gutenberg:${String(book?.id || '')}`,
  title: String(book?.title || 'Untitled'),
  author: String(book?.authors?.[0]?.name || 'Unknown author'),
  coverImage: String(book?.formats?.['image/jpeg'] || FALLBACK_COVER),
  source: 'gutenberg',
  sourceId: String(book?.id || ''),
});

const mapOpenLibrarySearchBook = (book) => ({
  id: `openlibrary:${String(book?.key || '')}`,
  title: String(book?.title || 'Untitled'),
  author: String((Array.isArray(book?.author_name) ? book.author_name[0] : '') || 'Unknown author'),
  coverImage: book?.cover_i
    ? `https://covers.openlibrary.org/b/id/${encodeURIComponent(String(book.cover_i))}-L.jpg`
    : FALLBACK_COVER,
  source: 'openlibrary',
  sourceId: String(book?.key || ''),
});

const dedupeBooks = (books = []) => {
  const seen = new Set();
  return books.filter((book) => {
    const key = `${String(book.source)}:${String(book.sourceId)}`;
    if (!book?.source || !book?.sourceId || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const searchGutenberg = async (query) => {
  const isNumeric = /^\d+$/.test(query);
  const url = isNumeric
    ? `${GUTENDEX_BASE_URL}/books/${encodeURIComponent(query)}`
    : `${GUTENDEX_BASE_URL}/books?search=${encodeURIComponent(query)}`;

  try {
    const payload = await fetchJson(url);
    const results = isNumeric
      ? [payload]
      : (Array.isArray(payload?.results) ? payload.results : []);

    return results.map(mapGutendexSearchBook).filter((book) => book.sourceId);
  } catch {
    return [];
  }
};

const searchOpenLibrary = async (query) => {
  const isNumeric = /^\d+$/.test(query);

  if (isNumeric) {
    return [];
  }

  try {
    const payload = await fetchJson(`${OPEN_LIBRARY_BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=20`);
    const docs = Array.isArray(payload?.docs) ? payload.docs : [];
    return docs.map(mapOpenLibrarySearchBook).filter((book) => book.sourceId);
  } catch {
    return [];
  }
};

export const searchBooks = async (rawQuery) => {
  const query = String(rawQuery || '').trim();
  if (!query) return [];

  const settled = await Promise.allSettled([
    searchGutenberg(query),
    searchOpenLibrary(query),
  ]);

  const merged = settled.flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : []));
  return dedupeBooks(merged).slice(0, 40);
};

const readFromGutenberg = async (sourceId) => {
  const id = String(sourceId || '').trim();
  if (!/^\d+$/.test(id)) {
    return createFallbackRead();
  }

  try {
    const metadata = await fetchJson(`${GUTENDEX_BASE_URL}/books/${encodeURIComponent(id)}`);
    const title = String(metadata?.title || `Project Gutenberg #${id}`);
    const author = String(metadata?.authors?.[0]?.name || 'Unknown author');

    const textCandidate = metadata?.formats?.['text/plain; charset=utf-8']
      || metadata?.formats?.['text/plain; charset=us-ascii']
      || metadata?.formats?.['text/plain'];

    if (!textCandidate) {
      return createFallbackRead({ title, author });
    }

    const rawText = await fetchText(textCandidate);
    const stripped = stripGutenbergBoilerplate(rawText);
    const chapters = splitIntoChapters(stripped || rawText);

    return {
      title,
      author,
      chapters: ensureChapters(chapters),
    };
  } catch {
    return createFallbackRead();
  }
};

const readFromOpenLibrary = async (sourceId) => {
  const key = String(sourceId || '').trim();
  const normalizedKey = key.startsWith('/') ? key : `/${key}`;
  if (!normalizedKey.startsWith('/works/')) {
    return createFallbackRead();
  }

  try {
    const work = await fetchJson(`${OPEN_LIBRARY_BASE_URL}${normalizedKey}.json`);
    const title = String(work?.title || 'OpenLibrary Book');

    let author = 'Unknown author';
    const firstAuthorKey = work?.authors?.[0]?.author?.key;
    if (firstAuthorKey) {
      try {
        const authorPayload = await fetchJson(`${OPEN_LIBRARY_BASE_URL}${firstAuthorKey}.json`);
        author = String(authorPayload?.name || author);
      } catch {
        author = 'Unknown author';
      }
    }

    const description = typeof work?.description === 'string'
      ? work.description
      : String(work?.description?.value || '').trim();

    const contentText = description || `${title} by ${author} is listed on Open Library. Full readable text is not available for this title.`;

    return {
      title,
      author,
      chapters: ensureChapters([{ index: 1, title: 'Preview', html: toHtmlParagraphs(contentText) }]),
    };
  } catch {
    return createFallbackRead();
  }
};

export const readBook = async (source, sourceId) => {
  const normalizedSource = String(source || '').trim().toLowerCase();

  if (normalizedSource === 'gutenberg') {
    return readFromGutenberg(sourceId);
  }

  if (normalizedSource === 'openlibrary') {
    return readFromOpenLibrary(sourceId);
  }

  return createFallbackRead();
};

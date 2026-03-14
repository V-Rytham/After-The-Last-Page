const GUTENBERG_HOST = 'https://www.gutenberg.org';

const escapeHtml = (value) => (
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
);

export const getGutenbergTextUrl = (gutenbergId) => (
  `${GUTENBERG_HOST}/ebooks/${encodeURIComponent(String(gutenbergId))}.txt.utf-8`
);

export const getGutenbergCoverUrl = (gutenbergId, size = 'medium') => (
  `${GUTENBERG_HOST}/cache/epub/${encodeURIComponent(String(gutenbergId))}/pg${encodeURIComponent(String(gutenbergId))}.cover.${size}.jpg`
);

export const getGutenbergBookPageUrl = (gutenbergId) => (
  `${GUTENBERG_HOST}/ebooks/${encodeURIComponent(String(gutenbergId))}`
);

export const fetchGutenbergText = async (gutenbergId) => {
  const url = getGutenbergTextUrl(gutenbergId);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Gutenberg text (${gutenbergId}): ${response.status}`);
  }
  return await response.text();
};

export const stripGutenbergBoilerplate = (rawText) => {
  const text = String(rawText || '').replaceAll('\r\n', '\n');
  const startMatch = text.match(/\*\*\*\s*START OF (?:THE|THIS)\s+PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*/i);
  const endMatch = text.match(/\*\*\*\s*END OF (?:THE|THIS)\s+PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*/i);

  const startIndex = startMatch ? startMatch.index + startMatch[0].length : 0;
  const endIndex = endMatch ? endMatch.index : text.length;

  return text.slice(startIndex, endIndex).trim();
};

const isLikelyChapterHeading = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return false;

  if (/^chapter\s+\d+/i.test(trimmed)) return true;
  if (/^chapter\s+[ivxlcdm]+\b/i.test(trimmed)) return true;
  if (/^chapter\s+\w+/i.test(trimmed) && trimmed.length <= 28) return true;

  if (/^[ivxlcdm]+\.\s+\S+/i.test(trimmed)) return true;
  if (/^adventure\s+[ivxlcdm]+\b/i.test(trimmed)) return true;
  if (/^book\s+[ivxlcdm]+\b/i.test(trimmed)) return true;
  if (/^part\s+[ivxlcdm\d]+\b/i.test(trimmed)) return true;

  return false;
};

const normalizeHeading = (heading, maybeSubtitle) => {
  const base = heading.trim().replace(/\s{2,}/g, ' ');
  if (!maybeSubtitle) return base;

  const subtitle = maybeSubtitle.trim().replace(/\s{2,}/g, ' ');
  if (!subtitle) return base;

  if (base.length <= 22 && subtitle.length <= 70) {
    return `${base}: ${subtitle}`;
  }

  return base;
};

const toParagraphHtml = (block) => {
  const cleaned = block
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();

  if (!cleaned) return '';
  return `<p>${escapeHtml(cleaned)}</p>`;
};

const blocksToHtml = (blocks) => (
  blocks
    .map(toParagraphHtml)
    .filter(Boolean)
    .join('\n')
);

const countWords = (value) => (
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length
);

export const convertTextToChapters = (text, { fallbackTitle = 'Chapter' } = {}) => {
  const lines = String(text || '').replaceAll('\r\n', '\n').split('\n');

  const chapters = [];
  let current = null;
  let buffer = [];
  const consumedSubtitleLineIndexes = new Set();

  const flush = () => {
    const content = buffer.join('\n').trim();
    buffer = [];

    if (!current) {
      if (!content) return;
      current = { title: 'Opening', index: chapters.length + 1 };
    }

    const blocks = content
      .split(/\n{2,}/g)
      .map((block) => block.replace(/\n+/g, ' ').trim())
      .filter(Boolean);

    const html = blocksToHtml(blocks);
    if (!html) {
      current = null;
      return;
    }
    chapters.push({
      index: current.index,
      title: current.title || `${fallbackTitle} ${current.index}`,
      html,
      wordCount: countWords(html),
    });

    current = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isLikelyChapterHeading(trimmed)) {
      flush();

      let subtitle = null;
      let subtitleLineIndex = null;
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j += 1) {
        const peek = lines[j].trim();
        if (!peek) continue;
        if (isLikelyChapterHeading(peek)) break;
        if (peek.length <= 70 && (peek === peek.toUpperCase() || /^["'“]/.test(peek))) {
          subtitle = peek;
          subtitleLineIndex = j;
        }
        break;
      }

      if (subtitleLineIndex != null) {
        consumedSubtitleLineIndexes.add(subtitleLineIndex);
      }

      const title = normalizeHeading(trimmed, subtitle);
      current = { title, index: chapters.length + 1 };
      continue;
    }

    if (consumedSubtitleLineIndexes.has(i)) {
      continue;
    }

    buffer.push(line);
  }

  flush();

  if (chapters.length === 0) {
    const fallbackBlocks = String(text || '')
      .split(/\n{2,}/g)
      .map((block) => block.replace(/\n+/g, ' ').trim())
      .filter(Boolean);

    const html = blocksToHtml(fallbackBlocks);
    return [{
      index: 1,
      title: fallbackTitle,
      html,
      wordCount: countWords(html),
    }];
  }

  return chapters;
};


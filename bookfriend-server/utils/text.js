export const stripHtml = (value = '') => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export const tokenize = (value = '') => stripHtml(value)
  .toLowerCase()
  .split(/[^a-z0-9]+/i)
  .filter(Boolean);

export const scoreChunkOverlap = (query, chunk) => {
  const queryTokens = new Set(tokenize(query));
  if (!queryTokens.size) {
    return 0;
  }

  const chunkTokens = tokenize(chunk);
  if (!chunkTokens.length) {
    return 0;
  }

  let score = 0;
  for (const token of chunkTokens) {
    if (queryTokens.has(token)) {
      score += 1;
    }
  }

  return score / Math.sqrt(chunkTokens.length);
};

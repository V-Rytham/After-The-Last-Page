import { getStoredUser } from './auth';

const SESSION_KEY = 'readingSessions:v2';
const HISTORY_KEY = 'readingHistory:v1';
const MAX_HISTORY = 20;

const getActorKeyForUser = (user) => user?._id || user?.anonymousId || 'guest';
const getActorKey = () => getActorKeyForUser(getStoredUser());

const readStore = (key) => {
  const raw = localStorage.getItem(key);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeStore = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const makeSessionKey = ({ source, sourceId }) => `${String(source || '').toLowerCase()}:${String(sourceId || '')}`;

export const getReadingSessionsForCurrentUser = () => {
  const store = readStore(SESSION_KEY);
  return store[getActorKey()] || {};
};

export const getReadingHistoryForCurrentUser = () => {
  const store = readStore(HISTORY_KEY);
  const list = store[getActorKey()];
  return Array.isArray(list) ? list : [];
};

const writeActorSession = (sessionKey, updates) => {
  if (!sessionKey) return null;

  const actorKey = getActorKey();
  const store = readStore(SESSION_KEY);
  const actorSessions = store[actorKey] || {};

  store[actorKey] = {
    ...actorSessions,
    [sessionKey]: {
      ...(actorSessions[sessionKey] || {}),
      ...updates,
    },
  };

  writeStore(SESSION_KEY, store);
  return store[actorKey][sessionKey];
};

const writeHistoryEntry = (entry) => {
  const actorKey = getActorKey();
  const store = readStore(HISTORY_KEY);
  const existing = Array.isArray(store[actorKey]) ? store[actorKey] : [];

  const next = [entry, ...existing.filter((item) => item?.key !== entry.key)].slice(0, MAX_HISTORY);
  store[actorKey] = next;
  writeStore(HISTORY_KEY, store);
  return next;
};

export const trackBookOpened = (book) => {
  const source = String(book?.source || '').toLowerCase();
  const sourceId = String(book?.sourceId || '');
  if (!source || !sourceId) return null;

  const key = makeSessionKey({ source, sourceId });
  const now = new Date().toISOString();

  writeHistoryEntry({
    key,
    source,
    sourceId,
    title: String(book?.title || 'Untitled'),
    author: String(book?.author || 'Unknown author'),
    coverImage: String(book?.coverImage || ''),
    lastOpenedAt: now,
  });

  return writeActorSession(key, {
    source,
    sourceId,
    lastOpenedAt: now,
    lastChapterIndex: 0,
    chapterCount: 1,
  });
};

export const updateReadingSession = ({ source, sourceId, currentChapterIndex, chapterCount }) => {
  const safeSource = String(source || '').toLowerCase();
  const safeSourceId = String(sourceId || '');
  if (!safeSource || !safeSourceId) return null;

  const safeCount = Math.max(1, Number(chapterCount) || 1);
  const safeIndex = Math.max(0, Number(currentChapterIndex) || 0);
  const progressPercent = Math.round(((safeIndex + 1) / safeCount) * 100);

  return writeActorSession(makeSessionKey({ source: safeSource, sourceId: safeSourceId }), {
    source: safeSource,
    sourceId: safeSourceId,
    lastChapterIndex: safeIndex,
    chapterCount: safeCount,
    progressPercent,
    lastOpenedAt: new Date().toISOString(),
  });
};

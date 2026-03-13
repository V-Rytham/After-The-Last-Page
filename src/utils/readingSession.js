import { getActorKeyForUser, getAllBookAccessStates } from './readingAccess';
import { getStoredUser } from './auth';

const SESSION_KEY = 'readingSessions';
const SHELF_KEY = 'userShelf';

const readShelfStore = () => {
  const raw = localStorage.getItem(SHELF_KEY);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeShelfStore = (store) => {
  localStorage.setItem(SHELF_KEY, JSON.stringify(store));
};

export const getUserShelf = () => {
  const store = readShelfStore();
  const actorKey = getActorKeyForUser(getStoredUser());
  return store[actorKey] || [];
};

export const toggleBookOnShelf = (bookId) => {
  const store = readShelfStore();
  const actorKey = getActorKeyForUser(getStoredUser());
  const current = store[actorKey] || [];
  
  if (current.includes(bookId)) {
    store[actorKey] = current.filter(id => id !== bookId);
  } else {
    store[actorKey] = [...current, bookId];
  }
  
  writeShelfStore(store);
  return store[actorKey];
};

const readSessionStore = () => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeSessionStore = (store) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(store));
};

const getCurrentActorSessions = () => {
  const store = readSessionStore();
  const actorKey = getActorKeyForUser(getStoredUser());
  return store[actorKey] || {};
};

const setCurrentActorSession = (bookId, updates) => {
  const store = readSessionStore();
  const actorKey = getActorKeyForUser(getStoredUser());
  const actorSessions = store[actorKey] || {};

  store[actorKey] = {
    ...actorSessions,
    [bookId]: {
      ...(actorSessions[bookId] || {}),
      ...updates,
    },
  };

  writeSessionStore(store);
  return store[actorKey][bookId];
};

export const trackBookOpened = (bookId) => (
  setCurrentActorSession(bookId, {
    lastOpenedAt: new Date().toISOString(),
  })
);

export const updateReadingSession = (bookId, currentPage, totalPages) => (
  setCurrentActorSession(bookId, {
    currentPage,
    totalPages,
    progressPercent: Math.round((currentPage / totalPages) * 100),
    isFinished: currentPage >= totalPages,
    lastOpenedAt: new Date().toISOString(),
  })
);

export const getLibraryState = (books) => {
  const sessions = getCurrentActorSessions();
  const accessMap = getAllBookAccessStates();
  const byId = new Map(books.map((book) => [book._id || book.id, book]));

  const continueReading = Object.entries(sessions)
    .map(([bookId, session]) => ({ book: byId.get(bookId), session }))
    .filter(({ book, session }) => book && session.progressPercent > 0 && session.progressPercent < 100)
    .sort((a, b) => new Date(b.session.lastOpenedAt) - new Date(a.session.lastOpenedAt))
    .map(({ book, session }) => ({ ...book, session, access: accessMap[book._id || book.id] || {} }));

  const continueIds = new Set(continueReading.map((book) => book._id || book.id));

  const recentlyRead = books
    .map((book) => ({
      ...book,
      access: accessMap[book._id || book.id] || {},
    }))
    .filter((book) => book.access?.isRead)
    .sort((a, b) => new Date(b.access.lastReadAt || 0) - new Date(a.access.lastReadAt || 0));

  const recentlyReadIds = new Set(recentlyRead.map((book) => book._id || book.id));

  const recentlyOpened = Object.entries(sessions)
    .map(([bookId, session]) => ({ book: byId.get(bookId), session }))
    .filter(({ book }) => book)
    .sort((a, b) => new Date(b.session.lastOpenedAt) - new Date(a.session.lastOpenedAt))
    .map(({ book, session }) => ({ ...book, session, access: accessMap[book._id || book.id] || {} }))
    .filter((book) => !continueIds.has(book._id || book.id))
    .slice(0, 8);

  const discover = books
    .map((book) => ({
      ...book,
      access: accessMap[book._id || book.id] || {},
      session: sessions[book._id || book.id] || null,
    }))
    .filter((book) => !continueIds.has(book._id || book.id) && !recentlyReadIds.has(book._id || book.id));

  const savedBookIds = new Set(getUserShelf());
  const savedBooks = books
    .filter((book) => savedBookIds.has(book._id || book.id))
    .map((book) => ({
      ...book,
      access: accessMap[book._id || book.id] || {},
      session: sessions[book._id || book.id] || null,
    }));

  return {
    continueReading,
    recentlyRead,
    recentlyOpened,
    discover,
    savedBooks,
    accessMap,
    sessions,
  };
};

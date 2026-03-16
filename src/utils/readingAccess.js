import api from './api';
import { getStoredUser, updateStoredUser } from './auth';

const ACCESS_KEY = 'readingAccess';

export const getActorKeyForUser = (user) => user?._id || user?.anonymousId || 'guest';

const readAccessStore = () => {
  const raw = localStorage.getItem(ACCESS_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeAccessStore = (store) => {
  localStorage.setItem(ACCESS_KEY, JSON.stringify(store));
};

export const getCurrentActorAccessState = () => {
  const store = readAccessStore();
  const actorKey = getActorKeyForUser(getStoredUser());
  return store[actorKey] || {};
};

export const hydrateBookAccessForUser = (user, options = {}) => {
  if (!user) {
    return {};
  }

  const { mergeExisting = false } = options;
  const store = readAccessStore();
  const actorKey = getActorKeyForUser(user);
  const remoteState = (user.booksRead || []).reduce((acc, entry) => {
    acc[entry.bookId] = {
      isRead: Boolean(entry.completedAt),
      lastReadAt: entry.completedAt || null,
    };
    return acc;
  }, {});
  const existingState = store[actorKey] || {};
  store[actorKey] = mergeExisting
    ? {
        ...remoteState,
        ...existingState,
        ...Object.fromEntries(
          Object.keys(remoteState).map((bookId) => [
            bookId,
            {
              ...existingState[bookId],
              ...remoteState[bookId],
              isRead: Boolean(remoteState[bookId]?.isRead || existingState[bookId]?.isRead),
            },
          ]),
        ),
      }
    : remoteState;
  writeAccessStore(store);
  return store[actorKey];
};

const setCurrentActorBookAccessState = (bookId, updates) => {
  const store = readAccessStore();
  const actorKey = getActorKeyForUser(getStoredUser());
  const actorState = store[actorKey] || {};
  store[actorKey] = {
    ...actorState,
    [bookId]: {
      ...(actorState[bookId] || {}),
      ...updates,
    },
  };
  writeAccessStore(store);
  return store[actorKey][bookId];
};

export const getBookAccessState = (bookId) => {
  const actorState = getCurrentActorAccessState();
  return actorState[bookId] || { isRead: false };
};

export const markBookAsRead = (bookId) => (
  setCurrentActorBookAccessState(bookId, {
    isRead: true,
    lastReadAt: new Date().toISOString(),
  })
);

export const getAllBookAccessStates = () => getCurrentActorAccessState();

export const convertAccessStateToRecords = (records) =>
  Object.entries(records)
    .filter(([, value]) => value?.isRead)
    .map(([bookId, value]) => ({
      bookId,
      isRead: Boolean(value.isRead),
      completedAt: value.lastReadAt || new Date().toISOString(),
    }));

export const syncBookAccessRecords = async (records) => {
  if (!records.length) {
    return getStoredUser();
  }

  const { data } = await api.put('/users/access', { books: records });
  const nextUser = updateStoredUser({ booksRead: data.booksRead }) || getStoredUser();
  if (nextUser) {
    hydrateBookAccessForUser(nextUser);
  }
  return nextUser;
};

export const syncCurrentAccessState = async () => {
  const records = convertAccessStateToRecords(getCurrentActorAccessState());
  return syncBookAccessRecords(records);
};

export const syncSingleBookAccess = async (bookId, accessState) => {
  const records = convertAccessStateToRecords({ [bookId]: accessState });
  return syncBookAccessRecords(records);
};

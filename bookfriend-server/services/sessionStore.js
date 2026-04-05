import { getCache } from '../config/cache.js';

const ttlSeconds = Number.parseInt(process.env.BOOKFRIEND_SESSION_TTL_SECONDS || '7200', 10);

const keyForSession = (sessionId) => `bookfriend:session:${sessionId}`;

export const createSession = async ({ sessionId, userId, bookId, book }) => {
  const session = {
    sessionId,
    userId,
    bookId,
    book,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const cache = getCache();
  await cache.set(keyForSession(sessionId), JSON.stringify(session), 'EX', ttlSeconds);
  return session;
};

export const getSession = async (sessionId) => {
  const raw = await getCache().get(keyForSession(sessionId));
  return raw ? JSON.parse(raw) : null;
};

export const appendMessage = async ({ sessionId, role, content }) => {
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  session.messages.push({ role, content, timestamp: new Date().toISOString() });
  session.updatedAt = new Date().toISOString();
  await getCache().set(keyForSession(sessionId), JSON.stringify(session), 'EX', ttlSeconds);
  return session;
};

export const endSession = async (sessionId) => {
  const deleted = await getCache().del(keyForSession(sessionId));
  return deleted > 0;
};

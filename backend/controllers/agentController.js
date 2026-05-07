import { log } from '../utils/logger.js';
import { bookfriendClient } from '../services/bookfriendClient.js';
import {
  getSessionMapping,
  setActiveSessionMapping,
  markSessionEnded,
  markSessionMessageSuccess,
  markSessionStale,
} from '../services/bookfriendSessionManager.js';
import { BookFriendUpstreamError, BOOKFRIEND_ERROR_CODES } from '../services/bookfriendErrors.js';

const validateStartPayload = (body) => {
  const bookId = String(body?.book_id || '').trim();
  if (!bookId) {
    const error = new Error('book_id is required.');
    error.statusCode = 400;
    throw error;
  }
};

const validateMessagePayload = (body) => {
  const message = String(body?.message || '').trim();
  if (!message) {
    const error = new Error('message is required.');
    error.statusCode = 400;
    throw error;
  }
};

const getActor = (req) => ({
  userId: req.user?._id?.toString() || req.user?.anonymousId,
  bookId: String(req.body?.book_id || req.params?.bookId || '').trim(),
  requestId: req.requestId || req.headers['x-request-id'] || null,
});

const sendError = (res, error) => {
  const status = error.statusCode || 502;
  return res.status(status).json({
    error: error.message,
    code: error.code || 'BOOKFRIEND_REQUEST_FAILED',
    details: error.details || {},
  });
};

export const startAgentSession = async (req, res) => {
  try {
    validateStartPayload(req.body || {});
    const { userId, bookId, requestId } = getActor(req);
    const data = await bookfriendClient.startSession(req, { user_id: userId, book_id: bookId, chapter_progress: req.body?.chapter_progress });
    await setActiveSessionMapping({ userId, bookId, sessionId: data.session_id });
    log('[BOOKFRIEND] session_created', { requestId, userId, bookId, sessionId: data.session_id });
    return res.status(201).json(data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const sendAgentMessage = async (req, res) => {
  try {
    validateStartPayload(req.body || {});
    validateMessagePayload(req.body || {});
    const { userId, bookId, requestId } = getActor(req);
    let session = await getSessionMapping({ userId, bookId });
    if (!session?.sessionId) {
      const started = await bookfriendClient.startSession(req, { user_id: userId, book_id: bookId, chapter_progress: req.body?.chapter_progress });
      session = await setActiveSessionMapping({ userId, bookId, sessionId: started.session_id });
      log('[BOOKFRIEND] session_auto_created', { requestId, userId, bookId, sessionId: started.session_id });
    }

    const basePayload = { session_id: session.sessionId, message: req.body.message, chapter_progress: req.body?.chapter_progress };
    try {
      const data = await bookfriendClient.sendMessage(req, basePayload);
      await markSessionMessageSuccess({ userId, bookId });
      return res.json({ ...data, sessionRecovered: false });
    } catch (error) {
      if (!(error instanceof BookFriendUpstreamError) || error.code !== BOOKFRIEND_ERROR_CODES.SESSION_NOT_FOUND) {
        throw error;
      }

      await markSessionStale({ userId, bookId, reason: 'upstream_404' });
      log('[BOOKFRIEND] session_stale_detected', { requestId, userId, bookId, oldSessionId: session.sessionId });
      const newSession = await bookfriendClient.startSession(req, { user_id: userId, book_id: bookId, chapter_progress: req.body?.chapter_progress });
      await setActiveSessionMapping({ userId, bookId, sessionId: newSession.session_id });
      const retried = await bookfriendClient.sendMessage(req, { ...basePayload, session_id: newSession.session_id });
      await markSessionMessageSuccess({ userId, bookId });
      return res.json({ ...retried, sessionRecovered: true, newSessionId: newSession.session_id, warning: 'Previous session expired.' });
    }
  } catch (error) {
    return sendError(res, error);
  }
};

export const endAgentSession = async (req, res) => {
  try {
    const { userId, bookId } = getActor(req);
    const session = await getSessionMapping({ userId, bookId });
    const sessionId = String(req.body?.session_id || session?.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ error: 'session_id is required.', code: 'VALIDATION_ERROR' });
    const data = await bookfriendClient.endSession(req, { session_id: sessionId });
    await markSessionEnded({ userId, bookId });
    return res.json(data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const getAgentSessionStatus = async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.anonymousId;
    const bookId = String(req.params?.bookId || '').trim();
    const session = await getSessionMapping({ userId, bookId });
    if (!session) return res.json({ exists: false, stale: false, recoverable: true });
    return res.json({
      exists: Boolean(session.sessionId),
      sessionId: session.sessionId,
      stale: Boolean(session.stale),
      status: session.status,
      lastActivity: session.lastSuccessfulMessageAt,
      recoverable: true,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

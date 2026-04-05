import crypto from 'node:crypto';
import { NotFoundError } from '../lib/errors.js';
import { sendSuccess } from '../lib/http.js';
import { findBookForAgent } from '../retrieval/bookRepository.js';
import { retrieveRelevantChunks } from '../retrieval/retrievalService.js';
import { generateAgentReply } from '../services/llmService.js';
import { buildBookFriendPrompt } from '../services/promptService.js';
import { appendMessage, createSession, endSession, getSession } from '../services/sessionStore.js';

const getMaxHistory = () => {
  const parsed = Number.parseInt(process.env.BOOKFRIEND_MAX_HISTORY || '12', 10);
  return Number.isFinite(parsed) ? parsed : 12;
};

const getRetrievalLimit = () => {
  const parsed = Number.parseInt(process.env.BOOKFRIEND_RETRIEVAL_LIMIT || '4', 10);
  return Number.isFinite(parsed) ? parsed : 4;
};

export const startAgentSession = async (req, res) => {
  const { user_id: userId, book_id: bookId } = req.validatedBody;

  const book = await findBookForAgent(bookId);
  if (!book) {
    throw new NotFoundError('Book not found for this session.', 'BOOK_NOT_FOUND');
  }

  const sessionId = crypto.randomUUID();
  await createSession({ sessionId, userId, bookId, book });
  return sendSuccess(res, { session_id: sessionId }, 201);
};

export const sendAgentMessage = async (req, res) => {
  const { session_id: sessionId, message, chapter_progress: chapterProgress } = req.validatedBody;

  const session = await getSession(sessionId);
  if (!session) {
    throw new NotFoundError('Session not found or expired.', 'SESSION_NOT_FOUND');
  }

  if (req.user.role !== 'admin' && req.user.sub !== String(session.userId)) {
    throw new NotFoundError('Session not found or expired.', 'SESSION_NOT_FOUND');
  }

  await appendMessage({ sessionId, role: 'user', content: String(message) });

  const retrievedChunks = await retrieveRelevantChunks({
    book: session.book,
    userMessage: message,
    chapterProgress,
    limit: getRetrievalLimit(),
  });

  const promptPayload = buildBookFriendPrompt({
    book: session.book,
    retrievedChunks,
    sessionMessages: session.messages,
    userMessage: message,
    maxHistory: getMaxHistory(),
  });

  const response = await generateAgentReply(promptPayload);
  await appendMessage({ sessionId, role: 'assistant', content: response });

  return sendSuccess(res, { response });
};

export const endAgentSession = async (req, res) => {
  const { session_id: sessionId } = req.validatedBody;

  const session = await getSession(sessionId);
  if (!session) {
    throw new NotFoundError('Session not found.', 'SESSION_NOT_FOUND');
  }

  if (req.user.role !== 'admin' && req.user.sub !== String(session.userId)) {
    throw new NotFoundError('Session not found.', 'SESSION_NOT_FOUND');
  }

  await endSession(sessionId);
  return sendSuccess(res, { message: 'Session deleted.' });
};

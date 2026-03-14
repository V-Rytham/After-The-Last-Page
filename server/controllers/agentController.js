import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Book } from '../models/Book.js';

const getBookFriendBaseUrl = () => (process.env.BOOKFRIEND_SERVER_URL || 'http://127.0.0.1:5050').replace(/\/$/, '');
const localSessionStore = new Map();

const parseBookId = (bookId) => {
  const raw = String(bookId || '').trim();
  const gutenbergMatch = raw.match(/^g?(\d+)$/i);
  if (gutenbergMatch) {
    return { gutenbergId: Number.parseInt(gutenbergMatch[1], 10) };
  }

  if (mongoose.Types.ObjectId.isValid(raw)) {
    return { _id: raw };
  }

  return null;
};

const findBookForAgent = async (bookId) => {
  const query = parseBookId(bookId);
  if (!query) {
    return null;
  }

  return Book.findOne(query)
    .select('title author synopsis tags chapters gutenbergId')
    .lean();
};

const scoreChunkOverlap = (userMessage, chunkText) => {
  const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const msgTokens = new Set(normalize(userMessage).split(/\s+/).filter((token) => token.length > 2));
  if (!msgTokens.size) {
    return 0;
  }

  const chunkTokens = normalize(chunkText).split(/\s+/).filter((token) => token.length > 2);
  return chunkTokens.reduce((score, token) => score + (msgTokens.has(token) ? 1 : 0), 0);
};

const getRetrievedChunks = (book, userMessage, chapterProgress) => {
  const chunks = (Array.isArray(book?.chapters) ? book.chapters : [])
    .map((chapter) => ({
      chapterIndex: chapter.index || null,
      text: `${chapter?.title ? `${chapter.title}. ` : ''}${String(chapter?.html || '').replace(/<[^>]+>/g, ' ')}`.trim(),
    }))
    .filter((chunk) => chunk.text.length > 0);

  const progressNum = Number(chapterProgress);
  const progressAwareChunks = Number.isFinite(progressNum)
    ? chunks.filter((chunk) => chunk.chapterIndex == null || chunk.chapterIndex <= progressNum)
    : chunks;

  const activeChunks = progressAwareChunks.length > 0 ? progressAwareChunks : chunks;

  if (!activeChunks.length && book?.synopsis) {
    return [{ chapterIndex: null, text: String(book.synopsis) }];
  }

  return activeChunks
    .map((chunk) => ({ ...chunk, score: scoreChunkOverlap(userMessage, chunk.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ chapterIndex, text }) => ({ chapterIndex, text: text.slice(0, 1400) }));
};

const buildLocalAgentReply = ({ userMessage, bookTitle }) => {
  const trimmed = String(userMessage || '').trim();
  if (trimmed.length <= 8) {
    return `I like where you're going with that. In ${bookTitle}, what feeling does that moment leave with you right now?`;
  }

  if (trimmed.includes('?')) {
    return "Great question. A lot depends on how we read the characters' motivations in that scene. Which character choice feels most important to you there?";
  }

  return `That's an insightful take. I can see why that would stand out in ${bookTitle}. Do you think that moment changes how we should view the main character's decisions?`;
};

const isServiceUnavailableError = (error) => {
  if (!error) {
    return false;
  }

  return error.name === 'TypeError' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND';
};

const forwardToBookFriend = async (path, payload) => {
  let response;

  try {
    response = await fetch(`${getBookFriendBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    error.serviceUnavailable = isServiceUnavailableError(error);
    throw error;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || 'BookFriend agent request failed.';
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = data;
    throw error;
  }

  return data;
};

export const startAgentSession = async (req, res) => {
  try {
    const { book_id: explicitBookId, chapter_progress: chapterProgress } = req.body || {};
    const userId = req.user?._id?.toString() || req.user?.anonymousId;
    const bookId = explicitBookId;

    if (!userId || !bookId) {
      return res.status(400).json({ message: 'book_id is required.' });
    }

    let data;

    try {
      data = await forwardToBookFriend('/agent/start', {
        user_id: userId,
        book_id: bookId,
        chapter_progress: chapterProgress,
      });
    } catch (error) {
      if (!error.serviceUnavailable) {
        throw error;
      }

      const book = await findBookForAgent(bookId);
      if (!book) {
        return res.status(404).json({ message: 'Book not found for this session.' });
      }

      const sessionId = crypto.randomUUID();
      localSessionStore.set(sessionId, {
        sessionId,
        userId,
        book,
        messages: [],
      });

      data = { session_id: sessionId, mode: 'local-fallback' };
    }

    res.status(201).json(data);
  } catch (error) {
    const status = error.statusCode || 502;
    res.status(status).json({
      message: error.message || 'Unable to start BookFriend session.',
      details: error.payload,
    });
  }
};

export const sendAgentMessage = async (req, res) => {
  try {
    let data;

    try {
      data = await forwardToBookFriend('/agent/message', req.body || {});
    } catch (error) {
      if (!error.serviceUnavailable) {
        throw error;
      }

      const { session_id: sessionId, message, chapter_progress: chapterProgress } = req.body || {};

      if (!sessionId || !message) {
        return res.status(400).json({ message: 'session_id and message are required.' });
      }

      const session = localSessionStore.get(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found or expired.' });
      }

      session.messages.push({ role: 'user', content: String(message), timestamp: new Date().toISOString() });
      getRetrievedChunks(session.book, message, chapterProgress);
      const response = buildLocalAgentReply({ userMessage: message, bookTitle: session.book?.title || 'this book' });
      session.messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });

      data = { response, mode: 'local-fallback' };
    }

    res.json(data);
  } catch (error) {
    const status = error.statusCode || 502;
    res.status(status).json({
      message: error.message || 'Unable to fetch BookFriend response.',
      details: error.payload,
    });
  }
};

export const endAgentSession = async (req, res) => {
  try {
    let data;

    try {
      data = await forwardToBookFriend('/agent/end', req.body || {});
    } catch (error) {
      if (!error.serviceUnavailable) {
        throw error;
      }

      const { session_id: sessionId } = req.body || {};
      if (!sessionId) {
        return res.status(400).json({ message: 'session_id is required.' });
      }

      if (!localSessionStore.delete(sessionId)) {
        return res.status(404).json({ message: 'Session not found.' });
      }

      data = { message: 'Session deleted.', mode: 'local-fallback' };
    }

    res.json(data);
  } catch (error) {
    const status = error.statusCode || 502;
    res.status(status).json({
      message: error.message || 'Unable to end BookFriend session.',
      details: error.payload,
    });
  }
};

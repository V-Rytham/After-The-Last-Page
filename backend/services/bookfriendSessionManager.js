import { BookFriendSession } from '../models/BookFriendSession.js';

export const getSessionMapping = async ({ userId, bookId }) => BookFriendSession.findOne({ userId, bookId }).lean();

export const setActiveSessionMapping = async ({ userId, bookId, sessionId }) => {
  const now = new Date();
  return BookFriendSession.findOneAndUpdate(
    { userId, bookId },
    {
      $set: {
        userId,
        bookId,
        sessionId,
        status: 'active',
        stale: false,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, new: true },
  ).lean();
};

export const markSessionMessageSuccess = async ({ userId, bookId }) => BookFriendSession.findOneAndUpdate(
  { userId, bookId },
  { $set: { lastSuccessfulMessageAt: new Date(), updatedAt: new Date() } },
  { new: true },
).lean();

export const markSessionStale = async ({ userId, bookId, reason }) => BookFriendSession.findOneAndUpdate(
  { userId, bookId },
  {
    $set: {
      stale: true,
      status: 'stale',
      sessionId: null,
      updatedAt: new Date(),
      staleReason: reason,
    },
  },
  { new: true },
).lean();

export const markSessionEnded = async ({ userId, bookId }) => BookFriendSession.findOneAndUpdate(
  { userId, bookId },
  { $set: { stale: false, status: 'ended', sessionId: null, updatedAt: new Date() } },
  { new: true },
).lean();

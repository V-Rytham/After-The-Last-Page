import crypto from 'crypto';
import { isDbConnected } from '../config/db.js';

const anonymousUsers = new Map();
const quizProgress = new Map();

const DEFAULT_ANON_PREFIX = 'Reader';

export const isDegradedMode = () => !isDbConnected();

export const buildDegradedAnonymousUser = () => {
  const id = crypto.randomUUID();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const user = {
    _id: id,
    anonymousId: `${DEFAULT_ANON_PREFIX} #${suffix}`,
    name: '',
    username: '',
    bio: '',
    email: '',
    isAnonymous: true,
    rating: 5,
    preferences: {
      theme: 'dark',
      defaultMatchMedium: 'text',
    },
    createdAt: new Date().toISOString(),
  };

  anonymousUsers.set(String(id), user);
  return user;
};

export const getDegradedUserById = (id) => anonymousUsers.get(String(id)) || null;

const progressKey = (userId, bookId) => `${String(userId)}::${String(bookId)}`;

export const setDegradedQuizProgress = ({ userId, bookId, passed, score }) => {
  const record = {
    quizAttempted: true,
    quizPassed: Boolean(passed),
    score: Number(score || 0),
    attemptedAt: new Date().toISOString(),
  };

  quizProgress.set(progressKey(userId, bookId), record);
  return record;
};

export const getDegradedQuizProgress = ({ userId, bookId }) => (
  quizProgress.get(progressKey(userId, bookId)) || null
);

export const getDegradedAllowedBookIds = ({ userId, bookIds }) => {
  const normalized = Array.isArray(bookIds) ? bookIds.map((bookId) => String(bookId)) : [];
  return normalized.filter((bookId) => getDegradedQuizProgress({ userId, bookId })?.quizPassed);
};

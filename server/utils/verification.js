import { Book } from '../models/Book.js';
import { UserBookVerification } from '../models/UserBookVerification.js';
import mongoose from 'mongoose';

export const resolveBookAndIsbn = async (bookId) => {
  const book = await Book.findById(bookId).select('_id isbn');
  if (!book) {
    return { book: null, isbn: null };
  }

  return { book, isbn: String(book.isbn || '').trim() || null };
};

export const isUserVerifiedForIsbn = async (userId, isbn) => {
  if (!userId || !isbn) {
    return false;
  }

  const record = await UserBookVerification.findOne({ userId, isbn, verified: true }).select('_id');
  return Boolean(record);
};

export const isUserVerifiedForBook = async ({ userId, bookId, isbn }) => {
  if (!userId) {
    return false;
  }

  if (bookId && mongoose.Types.ObjectId.isValid(bookId)) {
    const byBook = await UserBookVerification.findOne({ userId, bookId, verified: true }).select('_id');
    if (byBook) {
      return true;
    }
  }

  if (isbn) {
    return isUserVerifiedForIsbn(userId, isbn);
  }

  return false;
};

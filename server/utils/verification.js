import { Book } from '../models/Book.js';
import { UserBookVerification } from '../models/UserBookVerification.js';

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

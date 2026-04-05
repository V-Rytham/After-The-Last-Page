import mongoose from 'mongoose';
import { Book } from '../models/Book.js';

export const resolveBookOrThrow = async (bookId) => {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    const err = new Error('Invalid book reference.');
    err.statusCode = 400;
    throw err;
  }

  const book = await Book.findById(bookId).select('_id');
  if (!book) {
    const err = new Error('Book not found.');
    err.statusCode = 404;
    throw err;
  }
  return book;
};

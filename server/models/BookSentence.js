import mongoose from 'mongoose';

const bookSentenceSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    chapter: { type: Number, required: true, index: true },
    sentence: { type: String, required: true },
    position: { type: Number, required: true, index: true },
  },
  { collection: 'book_sentences', timestamps: true },
);

bookSentenceSchema.index({ bookId: 1, chapter: 1, position: 1 }, { unique: true });

export const BookSentence = mongoose.models.BookSentence || mongoose.model('BookSentence', bookSentenceSchema);

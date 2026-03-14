import mongoose from 'mongoose';

const bookFactSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    chapter: { type: Number, required: true, index: true },
    subject: { type: String, required: true, index: true },
    verb: { type: String, required: true },
    object: { type: String, required: true, index: true },
    sentence: { type: String, required: true },
    sentencePosition: { type: Number, required: true, index: true },
  },
  { collection: 'book_facts', timestamps: true },
);

bookFactSchema.index({ bookId: 1, chapter: 1, sentencePosition: 1 });

export const BookFact = mongoose.models.BookFact || mongoose.model('BookFact', bookFactSchema);

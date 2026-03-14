import mongoose from 'mongoose';

const bookQuestionSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    question: { type: String, required: true },
    correctAnswer: { type: String, required: true },
    optionA: { type: String, required: true },
    optionB: { type: String, required: true },
    optionC: { type: String, required: true },
    optionD: { type: String, required: true },
    factId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookFact', required: true, index: true },
  },
  { collection: 'book_questions', timestamps: true },
);

bookQuestionSchema.index({ bookId: 1, factId: 1 });

export const BookQuestion = mongoose.models.BookQuestion || mongoose.model('BookQuestion', bookQuestionSchema);

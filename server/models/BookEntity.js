import mongoose from 'mongoose';

const bookEntitySchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    frequency: { type: Number, required: true, default: 1 },
  },
  { collection: 'book_entities', timestamps: true },
);

bookEntitySchema.index({ bookId: 1, entity: 1 }, { unique: true });

export const BookEntity = mongoose.models.BookEntity || mongoose.model('BookEntity', bookEntitySchema);

import mongoose from 'mongoose';

const bookChunkSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    chapter: { type: Number, required: true, index: true },
    text: { type: String, required: true },
    position: { type: Number, required: true },
  },
  { timestamps: true },
);

bookChunkSchema.index({ bookId: 1, position: 1 }, { unique: true });

export const BookChunk = mongoose.model('BookChunk', bookChunkSchema);

import mongoose from 'mongoose';

const bookChunkSchema = new mongoose.Schema(
  {
    bookKey: { type: String, required: true, index: true },
    chapterIndex: { type: Number, default: null },
    text: { type: String, required: true },
    vector: { type: [Number], required: true },
    sourceSignature: { type: String, required: true, index: true },
  },
  {
    collection: 'book_chunks',
    timestamps: true,
  },
);

bookChunkSchema.index({ bookKey: 1, chapterIndex: 1 });

export const BookChunk = mongoose.models.BookChunk || mongoose.model('BookChunk', bookChunkSchema);

import mongoose from 'mongoose';

const bookFriendSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  bookId: { type: String, required: true, index: true },
  sessionId: { type: String, default: null },
  status: { type: String, enum: ['active', 'stale', 'ended'], default: 'active' },
  stale: { type: Boolean, default: false },
  lastSuccessfulMessageAt: { type: Date, default: null },
}, { timestamps: true });

bookFriendSessionSchema.index({ userId: 1, bookId: 1 }, { unique: true });

export const BookFriendSession = mongoose.models.BookFriendSession || mongoose.model('BookFriendSession', bookFriendSessionSchema);

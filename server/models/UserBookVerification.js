import mongoose from 'mongoose';

const userBookVerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      index: true,
    },
    isbn: {
      type: String,
      trim: true,
      index: true,
    },
    verified: {
      type: Boolean,
      default: true,
    },
    verifiedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

userBookVerificationSchema.index({ userId: 1, bookId: 1 }, { unique: true, sparse: true });
userBookVerificationSchema.index({ userId: 1, isbn: 1 }, { unique: true, sparse: true });

export const UserBookVerification = mongoose.model('UserBookVerification', userBookVerificationSchema);

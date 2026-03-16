import mongoose from 'mongoose';

const questionSnapshotSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctIndex: { type: Number, required: true },
  },
  { _id: false },
);

const verificationAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isbn: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    questions: [questionSnapshotSchema],
  },
  { timestamps: true },
);

verificationAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1800 });

export const VerificationAttempt = mongoose.model('VerificationAttempt', verificationAttemptSchema);

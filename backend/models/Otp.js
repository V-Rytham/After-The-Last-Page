import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  otpCodeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  resendCount: { type: Number, default: 0 },
  consumedAt: { type: Date, default: null },
  attemptCount: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  blockedUntil: { type: Date, default: null },
  requestIp: { type: String, default: '', index: true },
}, { timestamps: true });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });


export const Otp = mongoose.model('Otp', otpSchema);

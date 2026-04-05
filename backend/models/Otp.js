import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  otpCodeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  resendCount: { type: Number, default: 0 },
  consumedAt: { type: Date, default: null },
}, { timestamps: true });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = mongoose.model('Otp', otpSchema);

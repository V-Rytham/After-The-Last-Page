import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  userAgent: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
}, { timestamps: true });

if (!refreshTokenSchema.indexes().some(([index]) => index.expiresAt === 1)) {
  refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

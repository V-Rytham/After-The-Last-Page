import mongoose from 'mongoose';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true, maxlength: 80 },
  username: {
    type: String,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: USERNAME_RE,
    sparse: true,
  },
  usernameLower: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
  bio: { type: String, trim: true, maxlength: 160, default: '' },
  email: { type: String, trim: true, lowercase: true, required: true, unique: true },
  passwordHash: { type: String, default: null },
  isVerified: { type: Boolean, default: false, index: true },
  profileImageUrl: { type: String, trim: true, default: '' },
  provider: { type: String, enum: ['local', 'google'], default: 'local', index: true },
  role: { type: String, enum: ['user'], default: 'user' },
  rating: { type: Number, default: 5.0, min: 0, max: 5 },
  preferences: {
    theme: { type: String, enum: ['light', 'dark', 'sepia', 'mocha'], default: 'dark' },
    defaultMatchMedium: { type: String, enum: ['text', 'voice', 'video'], default: 'text' },
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

userSchema.pre('save', async function normalizeUsername() {
  if (this.isModified('username')) {
    this.usernameLower = this.username ? String(this.username).trim().toLowerCase() : undefined;
  }
});

export const User = mongoose.model('User', userSchema);

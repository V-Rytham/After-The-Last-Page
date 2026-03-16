import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  anonymousId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true,
  },
  password: {
    type: String,
  },
  isAnonymous: {
    type: Boolean,
    default: false,
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 0,
    max: 5,
  },
  booksRead: [{
    bookId: { type: String, required: true },
    hoursSimulated: Number,
    completedAt: Date,
  }],
  preferences: {
    theme: { type: String, default: 'dark' },
    defaultMatchMedium: { type: String, enum: ['text', 'voice', 'video'], default: 'text' },
  },
}, { timestamps: true });

userSchema.pre('save', async function save() {
  if (!this.isModified('password') || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function matchPassword(enteredPassword) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model('User', userSchema);

import { z } from 'zod';
import { User } from '../models/User.js';
import {
  clearAuthCookie,
  createSessionToken,
  hashPassword,
  setAuthCookie,
  verifyPassword,
} from '../middleware/auth.js';
import { success, error } from '../utils/apiResponse.js';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  username: z.string().trim().regex(/^[a-zA-Z0-9_]{3,20}$/).optional().or(z.literal('')),
  email: z.string().trim().email(),
  password: z.string().min(8).max(120),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(120),
});

const serializeUser = (user) => ({
  _id: user._id,
  name: user.name,
  username: user.username || '',
  email: user.email,
  role: user.role || 'user',
  preferences: user.preferences || { theme: 'dark' },
});

const issueSession = (res, user) => {
  const token = createSessionToken({ userId: user._id, role: user.role || 'user' });
  setAuthCookie(res, token);
};

export const register = async (req, res) => {
  try {
    const payload = registerSchema.parse(req.body ?? {});
    const email = payload.email.toLowerCase();

    const existing = await User.findOne({ email }).select('_id');
    if (existing) return error(res, 'Email already in use.', 'EMAIL_TAKEN', 409);

    const user = await User.create({
      name: payload.name,
      username: payload.username || undefined,
      email,
      passwordHash: hashPassword(payload.password),
      provider: 'local',
      isVerified: true,
      role: 'user',
    });

    issueSession(res, user);
    return success(res, { user: serializeUser(user) }, 201);
  } catch (err) {
    if (err?.name === 'ZodError') {
      return error(res, 'Invalid registration payload.', 'VALIDATION_ERROR', 400, { issues: err.issues });
    }
    if (err?.code === 11000) {
      return error(res, 'Email or username already in use.', 'CONFLICT', 409);
    }
    return error(res, 'Failed to register user.', 'REGISTER_FAILED', 500);
  }
};

export const login = async (req, res) => {
  try {
    const payload = loginSchema.parse(req.body ?? {});
    const email = payload.email.toLowerCase();
    const user = await User.findOne({ email });

    if (!user || !verifyPassword(payload.password, user.passwordHash)) {
      return error(res, 'Invalid email or password.', 'INVALID_CREDENTIALS', 401);
    }

    issueSession(res, user);
    return success(res, { user: serializeUser(user) });
  } catch (err) {
    if (err?.name === 'ZodError') {
      return error(res, 'Invalid login payload.', 'VALIDATION_ERROR', 400, { issues: err.issues });
    }
    return error(res, 'Failed to sign in.', 'LOGIN_FAILED', 500);
  }
};

export const me = async (req, res) => {
  if (!req.user?._id) {
    return error(res, 'Not authenticated.', 'UNAUTHORIZED', 401);
  }

  return success(res, { user: serializeUser(req.user) });
};

export const logout = async (_req, res) => {
  clearAuthCookie(res);
  return success(res, { loggedOut: true });
};

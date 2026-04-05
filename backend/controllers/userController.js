import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { buildSafeErrorBody } from '../utils/runtime.js';
import {
  clearAuthCookies,
  hashToken,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  tokenDurations,
  verifyRefreshToken,
} from '../utils/authTokens.js';
import { issueEmailOtp, verifyEmailOtp } from '../services/otpService.js';
import { uploadProfileImage } from '../utils/profileImage.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || undefined);

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(120),
  username: z.string().trim().regex(/^[a-zA-Z0-9_]{3,20}$/).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const otpVerifySchema = z.object({
  email: z.string().trim().email(),
  otpCode: z.string().trim().regex(/^\d{6}$/),
});

const themeSchema = z.object({ theme: z.enum(['light', 'dark', 'sepia', 'mocha']) });

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  username: z.string().trim().regex(/^[a-zA-Z0-9_]{3,20}$/).optional().or(z.literal('')),
  bio: z.string().trim().max(160).optional(),
});

const buildUserResponse = (user) => ({
  _id: user._id,
  name: user.name,
  username: user.username || '',
  bio: user.bio || '',
  email: user.email,
  isVerified: Boolean(user.isVerified),
  role: user.role || 'user',
  provider: user.provider || 'local',
  profileImageUrl: user.profileImageUrl || '',
  preferences: user.preferences || { theme: 'dark' },
  joinedAt: user.createdAt,
});

const issueSession = async (req, res, user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const tokenHash = hashToken(refreshToken);

  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt: new Date(Date.now() + tokenDurations.refreshMaxAgeMs),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ipAddress: req.ip || '',
  });

  setAuthCookies(res, accessToken, refreshToken);
};

export const registerUser = async (req, res) => {
  try {
    const payload = signupSchema.parse(req.body);
    const email = payload.email.toLowerCase();

    const existing = await User.findOne({ email }).select('_id isVerified');
    if (existing?.isVerified) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);

    const user = existing
      ? await User.findByIdAndUpdate(existing._id, {
          $set: {
            name: payload.name,
            email,
            passwordHash,
            provider: 'local',
            isVerified: false,
            username: payload.username || undefined,
          },
        }, { new: true })
      : await User.create({
          name: payload.name,
          email,
          passwordHash,
          provider: 'local',
          isVerified: false,
          username: payload.username || undefined,
        });

    await issueEmailOtp(user);

    return res.status(201).json({ message: 'Signup successful. OTP sent to email.' });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid signup payload.', errors: error.issues });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Email or username already in use.' });
    }
    return res.status(error.statusCode || 500).json(buildSafeErrorBody(error.message || 'Server error', error));
  }
};

export const verifySignupOtp = async (req, res) => {
  try {
    const payload = otpVerifySchema.parse(req.body);
    const user = await User.findOne({ email: payload.email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    await verifyEmailOtp({ userId: user._id, otpCode: payload.otpCode });
    user.isVerified = true;
    await user.save();

    await issueSession(req, res, user);
    return res.json({ user: buildUserResponse(user) });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid verification payload.', errors: error.issues });
    }
    return res.status(error.statusCode || 500).json(buildSafeErrorBody(error.message || 'Server error', error));
  }
};

export const resendOtp = async (req, res) => {
  try {
    const email = z.string().trim().email().parse(req.body?.email).toLowerCase();
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.isVerified) return res.status(400).json({ message: 'User is already verified.' });

    await issueEmailOtp(user);
    return res.json({ message: 'OTP resent.' });
  } catch (error) {
    return res.status(error.statusCode || 400).json(buildSafeErrorBody(error.message || 'Server error', error));
  }
};

export const loginUser = async (req, res) => {
  try {
    const payload = loginSchema.parse(req.body);
    const user = await User.findOne({ email: payload.email.toLowerCase() });
    if (!user || !user.passwordHash || !(await bcrypt.compare(payload.password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    await issueSession(req, res, user);
    return res.json({ user: buildUserResponse(user) });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid login payload.', errors: error.issues });
    }
    return res.status(500).json(buildSafeErrorBody('Server error', error));
  }
};

export const loginWithGoogle = async (req, res) => {
  try {
    const idToken = z.string().min(20).parse(req.body?.idToken);
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = String(payload?.email || '').toLowerCase();
    if (!email) return res.status(400).json({ message: 'Google account email unavailable.' });

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: payload?.name || email.split('@')[0],
        email,
        provider: 'google',
        isVerified: true,
        profileImageUrl: payload?.picture || '',
      });
    } else if (user.provider !== 'google') {
      user.provider = 'google';
      user.isVerified = true;
      user.profileImageUrl = user.profileImageUrl || payload?.picture || '';
      await user.save();
    }

    await issueSession(req, res, user);
    return res.json({ user: buildUserResponse(user) });
  } catch (error) {
    return res.status(400).json(buildSafeErrorBody(error.message || 'Google login failed.', error));
  }
};

export const refreshSession = async (req, res) => {
  try {
    const refreshToken = req.cookies?.atlp_refresh;
    if (!refreshToken) return res.status(401).json({ message: 'Missing refresh token.' });

    const decoded = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const storedToken = await RefreshToken.findOne({ tokenHash, revokedAt: null });

    if (!storedToken || storedToken.expiresAt.getTime() < Date.now()) {
      return res.status(401).json({ message: 'Refresh token invalid or expired.' });
    }

    const user = await User.findById(decoded.sub);
    if (!user) return res.status(401).json({ message: 'User not found.' });

    storedToken.revokedAt = new Date();
    await storedToken.save();
    await issueSession(req, res, user);

    return res.json({ user: buildUserResponse(user) });
  } catch (_error) {
    return res.status(401).json({ message: 'Session refresh failed.' });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const refreshToken = req.cookies?.atlp_refresh;
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await RefreshToken.findOneAndUpdate({ tokenHash, revokedAt: null }, { $set: { revokedAt: new Date() } });
    }

    clearAuthCookies(res);
    return res.json({ message: 'Signed out successfully.' });
  } catch (error) {
    return res.status(500).json(buildSafeErrorBody('Failed to logout.', error));
  }
};

export const getUserProfile = async (req, res) => res.json(buildUserResponse(req.user));

export const updateUserProfile = async (req, res) => {
  try {
    const payload = profileSchema.parse(req.body);
    req.user.name = payload.name;
    req.user.username = payload.username || undefined;
    req.user.bio = payload.bio || '';
    await req.user.save();
    return res.json(buildUserResponse(req.user));
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid profile payload.', errors: error.issues });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Username already in use.' });
    }
    return res.status(500).json(buildSafeErrorBody('Server error', error));
  }
};

export const updateThemePreference = async (req, res) => {
  try {
    const payload = themeSchema.parse(req.body);
    req.user.preferences = { ...(req.user.preferences || {}), theme: payload.theme };
    await req.user.save();
    return res.json({ theme: payload.theme });
  } catch (error) {
    return res.status(400).json(buildSafeErrorBody(error.message || 'Invalid theme payload.', error));
  }
};

export const updateUserProfileImage = async (req, res) => {
  try {
    const profileImageData = z.string().min(40).parse(req.body?.profileImageData);
    const imageUrl = await uploadProfileImage(profileImageData);
    req.user.profileImageUrl = imageUrl;
    await req.user.save();
    return res.json(buildUserResponse(req.user));
  } catch (error) {
    return res.status(400).json(buildSafeErrorBody(error.message || 'Profile image upload failed.', error));
  }
};

export const removeUserProfileImage = async (req, res) => {
  req.user.profileImageUrl = '';
  await req.user.save();
  return res.json(buildUserResponse(req.user));
};

export const checkUsernameAvailability = async (req, res) => {
  const username = String(req.query?.username || '').trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ available: false, message: 'Invalid username format.' });
  }

  const existing = await User.findOne({ usernameLower: username.toLowerCase() }).select('_id');
  return res.json({
    available: !existing,
    username,
    message: existing ? 'That username is already taken.' : 'Username is available.',
  });
};

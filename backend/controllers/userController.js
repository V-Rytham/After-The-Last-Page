import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
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
import { isDegradedMode } from '../utils/degradedMode.js';
import mongoose from 'mongoose';
import { error, success } from '../utils/apiResponse.js';

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

const assertAuthDatabaseReady = () => {
  if (!isDegradedMode()) return;
  const error = new Error('Authentication is temporarily unavailable while the database reconnects.');
  error.statusCode = 503;
  throw error;
};

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
    assertAuthDatabaseReady();
    const payload = signupSchema.parse(req.body);
    const email = payload.email.toLowerCase();
    console.log('SIGNUP DEBUG:', { email, ip: req.ip });

    const existing = await User.findOne({ email }).select('_id isVerified');
    if (existing?.isVerified) {
      return error(res, 'An account with this email already exists.', 'EMAIL_EXISTS', 409);
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
        }, { returnDocument: 'after' })
      : await User.create({
          name: payload.name,
          email,
          passwordHash,
          provider: 'local',
          isVerified: false,
          username: payload.username || undefined,
        });

    await issueEmailOtp(user, { requestIp: req.ip });

    return success(res, { message: 'Signup successful. OTP sent to email.' }, 201);
  } catch (err) {
    if (err.name === 'ZodError') {
      return error(res, 'Invalid signup payload.', 'VALIDATION_ERROR', 400, { errors: err.issues });
    }
    if (err?.code === 11000) {
      return error(res, 'Email or username already in use.', 'DUPLICATE_KEY', 409);
    }
    return error(res, err.message || 'Server error', err.code, err.statusCode || 500);
  }
};

export const verifySignupOtp = async (req, res) => {
  try {
    assertAuthDatabaseReady();
    const payload = otpVerifySchema.parse(req.body);
    console.log('OTP VERIFY DEBUG:', { email: payload.email.toLowerCase(), ip: req.ip });
    const user = await User.findOne({ email: payload.email.toLowerCase() });
    if (!user) return error(res, 'User not found.', 'USER_NOT_FOUND', 404);

    const dbSession = await mongoose.startSession();
    await dbSession.withTransaction(async () => {
      await verifyEmailOtp({ userId: user._id, otpCode: payload.otpCode });
      user.isVerified = true;
      await user.save({ session: dbSession });
    });
    dbSession.endSession();

    await issueSession(req, res, user);
    return success(res, { user: buildUserResponse(user) });
  } catch (err) {
    if (err.name === 'ZodError') {
      return error(res, 'Invalid verification payload.', 'VALIDATION_ERROR', 400, { errors: err.issues });
    }
    return error(res, err.message || 'Server error', err.code, err.statusCode || 500);
  }
};

export const resendOtp = async (req, res) => {
  try {
    assertAuthDatabaseReady();
    const email = z.string().trim().email().parse(req.body?.email).toLowerCase();
    const user = await User.findOne({ email });
    if (!user) return error(res, 'User not found.', 'USER_NOT_FOUND', 404);
    if (user.isVerified) return error(res, 'User is already verified.', 'ALREADY_VERIFIED', 400);

    await issueEmailOtp(user, { requestIp: req.ip });
    return success(res, { message: 'OTP resent.' });
  } catch (err) {
    return error(res, err.message || 'Server error', err.code, err.statusCode || 400);
  }
};

export const loginUser = async (req, res) => {
  try {
    assertAuthDatabaseReady();
    const payload = loginSchema.parse(req.body);
    const user = await User.findOne({ email: payload.email.toLowerCase() });
    console.log('LOGIN DEBUG:', {
      email: payload.email.toLowerCase(),
      userFound: Boolean(user),
      hasPasswordHash: Boolean(user?.passwordHash),
    });

    if (!user || !user.passwordHash) {
      return error(res, 'Invalid email or password.', 'INVALID_CREDENTIALS', 401);
    }

    if (!(await bcrypt.compare(payload.password, user.passwordHash))) {
      return error(res, 'Invalid email or password.', 'INVALID_CREDENTIALS', 401);
    }

    if (!user.isVerified) {
      return error(res, 'Please verify your email before logging in.', 'EMAIL_NOT_VERIFIED', 403);
    }

    await issueSession(req, res, user);
    return success(res, { user: buildUserResponse(user) });
  } catch (err) {
    if (err.name === 'ZodError') {
      return error(res, 'Invalid login payload.', 'VALIDATION_ERROR', 400, { errors: err.issues });
    }
    return error(res, 'Server error', err.code, 500);
  }
};


export const loginGuestUser = async (req, res) => {
  try {
    assertAuthDatabaseReady();

    const guestEmail = String(process.env.GUEST_USER_EMAIL || 'guest@afterthelastpage.dev').trim().toLowerCase();
    const guestName = String(process.env.GUEST_USER_NAME || 'Guest Reader').trim() || 'Guest Reader';

    let user = await User.findOne({ email: guestEmail });

    if (!user) {
      user = await User.create({
        name: guestName,
        email: guestEmail,
        provider: 'local',
        isVerified: true,
      });
    } else {
      let changed = false;
      if (!user.isVerified) {
        user.isVerified = true;
        changed = true;
      }
      if (!user.name) {
        user.name = guestName;
        changed = true;
      }
      if (changed) await user.save();
    }

    await issueSession(req, res, user);
    return success(res, { user: buildUserResponse(user), guest: true });
  } catch (err) {
    return error(res, err.message || 'Guest login failed.', err.code, err.statusCode || 500);
  }
};

export const loginWithGoogle = async (req, res) => {
  try {
    assertAuthDatabaseReady();
    const idToken = z.string().min(20).parse(req.body?.idToken);
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = String(payload?.email || '').toLowerCase();
    if (!email) return error(res, 'Google account email unavailable.', 'GOOGLE_EMAIL_MISSING', 400);

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
    return success(res, { user: buildUserResponse(user) });
  } catch (err) {
    return error(res, err.message || 'Google login failed.', err.code, 400);
  }
};

export const refreshSession = async (req, res) => {
  try {
    assertAuthDatabaseReady();
    console.log('REFRESH COOKIE:', req.cookies);
    const refreshToken = req.cookies?.atlp_refresh;
    if (!refreshToken) return error(res, 'Missing refresh token.', 'MISSING_REFRESH_TOKEN', 401);

    const decoded = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const storedToken = await RefreshToken.findOne({ tokenHash, revokedAt: null });

    if (!storedToken || storedToken.expiresAt.getTime() < Date.now()) {
      return error(res, 'Refresh token invalid or expired.', 'INVALID_REFRESH_TOKEN', 401);
    }

    const user = await User.findById(decoded.sub);
    if (!user) return error(res, 'User not found.', 'USER_NOT_FOUND', 401);

    const dbSession = await mongoose.startSession();
    await dbSession.withTransaction(async () => {
      storedToken.revokedAt = new Date();
      await storedToken.save({ session: dbSession });
      const accessToken = signAccessToken(user);
      const nextRefreshToken = signRefreshToken(user);
      await RefreshToken.create([{
        userId: user._id,
        tokenHash: hashToken(nextRefreshToken),
        expiresAt: new Date(Date.now() + tokenDurations.refreshMaxAgeMs),
        userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
        ipAddress: req.ip || '',
      }], { session: dbSession });
      setAuthCookies(res, accessToken, nextRefreshToken);
    });
    dbSession.endSession();

    return success(res, { user: buildUserResponse(user) });
  } catch (_error) {
    return error(res, 'Session refresh failed.', 'SESSION_REFRESH_FAILED', 401);
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
    return success(res, { message: 'Signed out successfully.' });
  } catch (err) {
    return error(res, 'Failed to logout.', err.code, 500);
  }
};

export const getUserProfile = async (req, res) => success(res, buildUserResponse(req.user));

export const updateUserProfile = async (req, res) => {
  try {
    const payload = profileSchema.parse(req.body);
    req.user.name = payload.name;
    req.user.username = payload.username || undefined;
    req.user.bio = payload.bio || '';
    await req.user.save();
    return success(res, buildUserResponse(req.user));
  } catch (err) {
    if (err.name === 'ZodError') {
      return error(res, 'Invalid profile payload.', 'VALIDATION_ERROR', 400, { errors: err.issues });
    }
    if (err?.code === 11000) {
      return error(res, 'Username already in use.', 'USERNAME_TAKEN', 409);
    }
    return error(res, 'Server error', err.code, 500);
  }
};

export const updateThemePreference = async (req, res) => {
  try {
    const payload = themeSchema.parse(req.body);
    req.user.preferences = { ...(req.user.preferences || {}), theme: payload.theme };
    await req.user.save();
    return success(res, { theme: payload.theme });
  } catch (err) {
    return error(res, err.message || 'Invalid theme payload.', err.code, 400);
  }
};

export const updateUserProfileImage = async (req, res) => {
  try {
    const imageUrl = await uploadProfileImage({
      dataUri: req.body?.profileImageData,
      file: req.file,
    });
    req.user.profileImageUrl = imageUrl;
    await req.user.save();
    return success(res, buildUserResponse(req.user));
  } catch (err) {
    return error(res, err.message || 'Profile image upload failed.', err.code, 400);
  }
};

export const removeUserProfileImage = async (req, res) => {
  req.user.profileImageUrl = '';
  await req.user.save();
  return success(res, buildUserResponse(req.user));
};

export const checkUsernameAvailability = async (req, res) => {
  const username = String(req.query?.username || '').trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return error(res, 'Invalid username format.', 'INVALID_USERNAME', 400, { available: false });
  }

  const existing = await User.findOne({ usernameLower: username.toLowerCase() }).select('_id');
  return success(res, {
    available: !existing,
    username,
    message: existing ? 'That username is already taken.' : 'Username is available.',
  });
};

import { z } from 'zod';
import { User } from '../models/User.js';
import { uploadProfileImage } from '../utils/profileImage.js';
import { error, success } from '../utils/apiResponse.js';

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

const ensureRequestUser = async (req) => {
  if (req.user?.save) {
    return req.user;
  }

  const devEmail = String(req.user?.email || 'dev-user@local.dev').toLowerCase();
  let user = await User.findOne({ email: devEmail });

  if (!user) {
    user = await User.create({
      name: req.user?.name || 'Dev User',
      email: devEmail,
      provider: 'local',
      isVerified: true,
    });
  }

  user.anonymousId = req.user?.anonymousId || 'dev-user';
  req.user = user;
  return user;
};

export const getUserProfile = async (req, res) => {
  const user = await ensureRequestUser(req);
  return success(res, buildUserResponse(user));
};

export const updateUserProfile = async (req, res) => {
  try {
    const user = await ensureRequestUser(req);
    const payload = profileSchema.parse(req.body);
    user.name = payload.name;
    user.username = payload.username || undefined;
    user.bio = payload.bio || '';
    await user.save();
    return success(res, buildUserResponse(user));
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
    const user = await ensureRequestUser(req);
    const payload = themeSchema.parse(req.body);
    user.preferences = { ...(user.preferences || {}), theme: payload.theme };
    await user.save();
    return success(res, { theme: payload.theme });
  } catch (err) {
    return error(res, err.message || 'Invalid theme payload.', err.code, 400);
  }
};

export const updateUserProfileImage = async (req, res) => {
  try {
    const user = await ensureRequestUser(req);
    const imageUrl = await uploadProfileImage({
      dataUri: req.body?.profileImageData,
      file: req.file,
    });
    user.profileImageUrl = imageUrl;
    await user.save();
    return success(res, buildUserResponse(user));
  } catch (err) {
    return error(res, err.message || 'Profile image upload failed.', err.code, 400);
  }
};

export const removeUserProfileImage = async (req, res) => {
  const user = await ensureRequestUser(req);
  user.profileImageUrl = '';
  await user.save();
  return success(res, buildUserResponse(user));
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

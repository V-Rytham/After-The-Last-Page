import { User } from '../models/User.js';
const normalizeSessionUserId = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const safe = raw.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 64);
  return safe || null;
};

const buildFallbackUser = (userId = 'dev-user') => ({
  _id: userId,
  name: 'Dev User',
  email: `${userId}@local.dev`,
  role: 'admin',
  anonymousId: userId,
  preferences: { theme: 'dark' },
});

export const attachDevUserContext = async (req, _res, next) => {
  try {
    const sessionUserId = normalizeSessionUserId(req.get('X-User-Id') || req.get('x-user-id')) || 'dev-user';
    if (req.user) {
      req.auth = { role: 'admin', sub: String(req.user?._id || sessionUserId) };
      return next();
    }

    let user = null;
    try {
      user = await User.findOne({ email: `${sessionUserId}@local.dev` });
      if (!user) {
        user = await User.create({
          name: 'Dev User',
          username: `devuser_${sessionUserId}`,
          email: `${sessionUserId}@local.dev`,
          provider: 'local',
          isVerified: true,
        });
      }
      user.role = 'admin';
      user.anonymousId = sessionUserId;
      req.user = user;
      req.auth = { role: 'admin', sub: String(user._id) };
    } catch {
      req.user = buildFallbackUser(sessionUserId);
      req.auth = { role: 'admin', sub: sessionUserId };
    }

    return next();
  } catch {
    req.user = buildFallbackUser();
    req.auth = { role: 'admin', sub: 'dev-user' };
    return next();
  }
};

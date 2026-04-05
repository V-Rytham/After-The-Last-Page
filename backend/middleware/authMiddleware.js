import { User } from '../models/User.js';
import { resolveRestAccessToken, verifyUserJwt } from '../utils/auth.js';
import { error } from '../utils/apiResponse.js';

const isDevBypassEnabled =
  process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === 'true';
const devBypassEmail = String(process.env.DEV_AUTH_USER_EMAIL || 'dev@local.test').trim().toLowerCase();

export const protect = async (req, res, next) => {
  try {
    if (isDevBypassEnabled) {
      let user = await User.findOne({ email: devBypassEmail });

      if (!user) {
        user = await User.create({
          name: 'Dev User',
          username: 'devuser',
          email: devBypassEmail,
          isVerified: true,
          provider: 'local',
        });
      }

      req.user = user;
      req.auth = { role: user.role || 'user', sub: String(user._id) };
      return next();
    }

    const token = resolveRestAccessToken(req);
    if (!token) return error(res, 'Not authorized.', 'UNAUTHORIZED', 401);

    const decoded = verifyUserJwt(token);
    const user = await User.findById(decoded.sub).select('-passwordHash');
    if (!user) return error(res, 'Not authorized.', 'UNAUTHORIZED', 401);

    req.user = user;
    req.auth = { role: decoded.role, sub: decoded.sub };
    return next();
  } catch (_err) {
    return error(res, 'Not authorized.', 'UNAUTHORIZED', 401);
  }
};

export const requireRole = (roles = ['user']) => (req, res, next) => {
  if (isDevBypassEnabled) {
    return next();
  }

  const userRole = req.auth?.role || req.user?.role;
  if (!roles.includes(userRole)) {
    return error(res, 'Forbidden.', 'FORBIDDEN', 403);
  }
  return next();
};

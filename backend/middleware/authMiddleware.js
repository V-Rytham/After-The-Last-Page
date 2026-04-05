import { User } from '../models/User.js';
import { resolveRestAccessToken, verifyUserJwt } from '../utils/auth.js';
import { error } from '../utils/apiResponse.js';

export const protect = async (req, res, next) => {
  try {
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
  const userRole = req.auth?.role || req.user?.role;
  if (!roles.includes(userRole)) {
    return error(res, 'Forbidden.', 'FORBIDDEN', 403);
  }
  return next();
};

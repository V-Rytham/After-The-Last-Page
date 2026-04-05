import { User } from '../models/User.js';
import { verifyAccessToken } from '../utils/authTokens.js';

export const protect = async (req, res, next) => {
  try {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;
    const token = req.cookies?.atlp_access || bearer;

    if (!token) return res.status(401).json({ message: 'Not authorized.' });

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub).select('-passwordHash');
    if (!user) return res.status(401).json({ message: 'Not authorized.' });

    req.user = user;
    req.auth = { role: decoded.role || 'user' };
    return next();
  } catch (_error) {
    return res.status(401).json({ message: 'Not authorized.' });
  }
};

export const requireRole = (roles = ['user']) => (req, res, next) => {
  const userRole = req.auth?.role || req.user?.role;
  if (!roles.includes(userRole)) {
    return res.status(403).json({ message: 'Forbidden.' });
  }
  return next();
};

import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AUTH_COOKIE_NAME } from '../utils/authCookies.js';

export const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded?.id).select('-password -otpHash -otpExpiry');
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized access' });
  }
};

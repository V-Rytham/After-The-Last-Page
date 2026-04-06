import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { isProd } from '../utils/runtime.js';
import { isDegradedMode } from '../utils/degradedMode.js';
import { AUTH_COOKIE_NAME } from '../utils/authCookies.js';

const getTokenFromRequest = (req) => {
  if (req?.cookies?.[AUTH_COOKIE_NAME]) {
    return req.cookies[AUTH_COOKIE_NAME];
  }

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }

  return null;
};

export const requireAuth = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tokenUserId = decoded?.id || decoded?._id;

    if (isDegradedMode()) {
      req.user = tokenUserId
        ? {
          _id: tokenUserId,
          anonymousId: decoded?.anonymousId || '',
          isAnonymous: Boolean(decoded?.isAnonymous),
        }
        : null;
    } else {
      req.user = await User.findById(tokenUserId).select('-password -otpHash');
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    return next();
  } catch (error) {
    if (!isProd()) {
      console.error('[AUTH] Token verification failed:', error);
    } else {
      console.error('[AUTH] Token verification failed:', error?.message || 'unknown error');
    }

    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Backward compatibility.
export const protect = requireAuth;

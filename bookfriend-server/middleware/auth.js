import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

const cookieNames = ['access_token', 'token', 'jwt'];

const extractToken = (req) => {
  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  for (const name of cookieNames) {
    const token = req.cookies?.[name];
    if (token) {
      return token;
    }
  }

  return null;
};

export const requireAuth = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    next(new UnauthorizedError('Authentication token is required.'));
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next(new UnauthorizedError('JWT secret is not configured.'));
    return;
  }

  try {
    const payload = jwt.verify(token, secret);
    const sub = String(payload?.sub || '').trim();
    const role = String(payload?.role || '').trim() || 'user';

    if (!sub) {
      throw new UnauthorizedError('Invalid token payload.');
    }

    req.user = { sub, role };
    next();
  } catch (error) {
    next(error instanceof UnauthorizedError ? error : new UnauthorizedError('Invalid or expired token.'));
  }
};

export const requireUserMatch = (req, _res, next) => {
  const bodyUserId = String(req.validatedBody?.user_id || '').trim();
  if (req.user?.role === 'admin' || req.user?.sub === bodyUserId) {
    next();
    return;
  }

  next(new ForbiddenError('Authenticated user does not match requested user_id.'));
};

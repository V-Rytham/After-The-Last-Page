import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { isProd } from './runtime.js';

const ACCESS_COOKIE = 'atlp_access';
const REFRESH_COOKIE = 'atlp_refresh';

const accessMaxAgeMs = 15 * 60 * 1000;
const refreshMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

export const cookieNames = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
};

export const tokenDurations = {
  accessMaxAgeMs,
  refreshMaxAgeMs,
};

export const signAccessToken = (user) => jwt.sign({
  sub: String(user._id),
  role: user.role || 'user',
  isVerified: Boolean(user.isVerified),
}, process.env.JWT_SECRET, { expiresIn: '15m' });

export const signRefreshToken = (user) => jwt.sign({
  sub: String(user._id),
  type: 'refresh',
}, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });

export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const baseCookieOptions = {
  httpOnly: true,
  secure: isProd(),
  sameSite: 'lax',
  path: '/',
};

export const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookieOptions, maxAge: accessMaxAgeMs });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookieOptions, maxAge: refreshMaxAgeMs });
};

export const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions);
};

export const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

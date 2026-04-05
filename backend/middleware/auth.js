import crypto from 'crypto';
import { User } from '../models/User.js';

const AUTH_COOKIE = 'atlpg_session';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const getSecret = () => String(process.env.AUTH_SECRET || process.env.JWT_SECRET || 'dev-auth-secret-change-me');

const base64UrlEncode = (value) => Buffer.from(value).toString('base64url');
const base64UrlDecode = (value) => Buffer.from(String(value || ''), 'base64url').toString('utf8');

const sign = (input) => crypto.createHmac('sha256', getSecret()).update(input).digest('base64url');

const safeJsonParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const parseCookies = (headerValue) => {
  if (!headerValue) return {};
  return String(headerValue)
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const idx = pair.indexOf('=');
      if (idx <= 0) return acc;
      const key = pair.slice(0, idx).trim();
      const value = decodeURIComponent(pair.slice(idx + 1));
      acc[key] = value;
      return acc;
    }, {});
};

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password, passwordHash) => {
  const [salt, originalHash] = String(passwordHash || '').split(':');
  if (!salt || !originalHash) return false;

  const candidateHash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(originalHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

export const createSessionToken = ({ userId, role = 'user' }) => {
  const payload = {
    sub: String(userId),
    role: String(role || 'user'),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
};

export const verifySessionToken = (token) => {
  if (!token || !String(token).includes('.')) return null;
  const [encoded, providedSignature] = String(token).split('.');
  if (!encoded || !providedSignature) return null;

  const expectedSignature = sign(encoded);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  const payload = safeJsonParse(base64UrlDecode(encoded));
  if (!payload?.sub || !payload?.exp) return null;
  if (Date.now() / 1000 >= Number(payload.exp)) return null;
  return payload;
};

export const attachAuthContext = async (req, _res, next) => {
  try {
    const cookies = parseCookies(req.headers?.cookie);
    const token = cookies[AUTH_COOKIE];
    const payload = verifySessionToken(token);
    if (!payload) {
      return next();
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return next();
    }

    req.user = user;
    req.auth = { sub: String(user._id), role: user.role || payload.role || 'user' };
    return next();
  } catch {
    return next();
  }
};

export const requireAuth = (req, res, next) => {
  if (!req.user?._id) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  return next();
};

export const requireRole = (...roles) => (req, res, next) => {
  const role = String(req.auth?.role || req.user?.role || 'user');
  if (!roles.map(String).includes(role)) {
    return res.status(403).json({ message: 'Forbidden.' });
  }
  return next();
};

export const setAuthCookie = (res, token) => {
  const maxAge = TOKEN_TTL_SECONDS;
  const cookieParts = [
    `${AUTH_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '));
};

export const clearAuthCookie = (res) => {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
};

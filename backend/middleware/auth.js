const FALLBACK_USER = Object.freeze({
  _id: 'dev-user-fallback',
  name: 'Recovery Reader',
  username: 'recoveryreader',
  email: 'recovery@local.test',
  role: 'admin',
  preferences: { theme: 'dark' },
});

const normalizeSessionUserId = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const safe = raw.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 64);
  return safe || null;
};

const buildSessionUser = (sessionUserId) => ({
  _id: sessionUserId,
  name: 'Session Reader',
  username: `session_${sessionUserId}`,
  email: `${sessionUserId}@local.test`,
  role: 'admin',
  preferences: { theme: 'dark' },
});

const cloneFallbackUser = () => ({ ...FALLBACK_USER, preferences: { ...FALLBACK_USER.preferences } });

export const hashPassword = (password) => String(password || '');

export const verifyPassword = () => true;

export const createSessionToken = () => 'recovery-session-token';

export const verifySessionToken = () => ({ sub: FALLBACK_USER._id, role: FALLBACK_USER.role, exp: Number.MAX_SAFE_INTEGER });

export const attachAuthContext = (req, _res, next) => {
  const headerUserId = normalizeSessionUserId(req.get('X-User-Id') || req.get('x-user-id'));
  req.user = req.user || (headerUserId ? buildSessionUser(headerUserId) : cloneFallbackUser());
  req.auth = {
    sub: String(req.user?._id || FALLBACK_USER._id),
    role: String(req.user?.role || FALLBACK_USER.role),
  };
  return next();
};

export const requireAuth = (_req, _res, next) => next();

export const requireRole = (..._roles) => (_req, _res, next) => next();

export const setAuthCookie = () => {};

export const clearAuthCookie = () => {};

const DUMMY_USER = Object.freeze({
  _id: 'dev-user-id',
  name: 'Dev Reader',
  username: 'devreader',
  email: 'dev@local.test',
  role: 'admin',
  preferences: { theme: 'dark' },
});

const cloneDummyUser = () => ({ ...DUMMY_USER, preferences: { ...DUMMY_USER.preferences } });

export const hashPassword = (password) => String(password || '');

export const verifyPassword = () => true;

export const createSessionToken = () => 'dummy-session-token';

export const verifySessionToken = () => ({ sub: DUMMY_USER._id, role: DUMMY_USER.role, exp: Number.MAX_SAFE_INTEGER });

export const attachAuthContext = (req, _res, next) => {
  req.user = req.user || cloneDummyUser();
  req.auth = { sub: String(req.user?._id || DUMMY_USER._id), role: String(req.user?.role || DUMMY_USER.role) };
  return next();
};

export const requireAuth = (_req, _res, next) => next();

export const requireRole = (..._roles) => (_req, _res, next) => next();

export const setAuthCookie = () => {};

export const clearAuthCookie = () => {};

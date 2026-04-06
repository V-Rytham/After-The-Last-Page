import { isProd } from './runtime.js';

export const AUTH_COOKIE_NAME = 'alp_auth';

export const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: isProd() ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

export const clearAuthCookieOptions = () => ({
  ...getAuthCookieOptions(),
  maxAge: 0,
});

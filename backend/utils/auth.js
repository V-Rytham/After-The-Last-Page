import { verifyAccessToken } from './authTokens.js';

export const extractBearerToken = (authorizationValue) => {
  if (!authorizationValue) return null;
  const raw = String(authorizationValue).trim();
  if (!raw.toLowerCase().startsWith('bearer ')) return null;
  const token = raw.slice(7).trim();
  return token || null;
};

export const resolveRestAccessToken = (req) => {
  const cookieToken = req.cookies?.atlp_access ? String(req.cookies.atlp_access) : null;
  const headerToken = extractBearerToken(req.headers?.authorization);
  return cookieToken || headerToken;
};

export const verifyUserJwt = (token) => {
  const decoded = verifyAccessToken(token);
  if (!decoded?.sub) {
    const error = new Error('Invalid token payload.');
    error.statusCode = 401;
    error.code = 'INVALID_TOKEN';
    throw error;
  }

  return {
    sub: String(decoded.sub),
    role: decoded.role || 'user',
  };
};

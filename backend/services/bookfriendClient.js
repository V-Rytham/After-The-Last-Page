import { isProd } from '../utils/runtime.js';
import { BookFriendUpstreamError, BOOKFRIEND_ERROR_CODES } from './bookfriendErrors.js';

const trimTrailingSlash = (value) => String(value || '').replace(/\/$/, '');

const normalizeBookFriendBaseUrl = (value) => {
  const trimmed = trimTrailingSlash(value);
  if (!trimmed) return '';
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/(api|agent|health)(?:\/.*)?$/i, '');
  }
};

const inferRenderBookFriendUrl = (req) => {
  if (!isProd()) return null;
  const hostCandidates = [req?.get?.('x-forwarded-host'), req?.get?.('host'), req?.headers?.host, process.env.RENDER_EXTERNAL_HOSTNAME, process.env.CLIENT_URL].filter(Boolean);
  for (const candidate of hostCandidates) {
    const normalized = String(candidate).trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (normalized.endsWith('-api.onrender.com')) return `https://${normalized.slice(0, -'-api.onrender.com'.length)}-bookfriend.onrender.com`;
  }
  return null;
};

const getBaseUrl = (req) => normalizeBookFriendBaseUrl(process.env.BOOKFRIEND_SERVER_URL) || inferRenderBookFriendUrl(req) || 'http://127.0.0.1:5050';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const doPost = async (req, path, payload, { timeoutMs = 20000 } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const targetBaseUrl = getBaseUrl(req);
  const targetUrl = `${targetBaseUrl}${path}`;
  try {
    const resp = await fetch(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-request-id': req.requestId || '' }, body: JSON.stringify(payload), signal: controller.signal });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const message = data?.message || 'BookFriend agent request failed.';
      if (resp.status === 404 && /session not found|expired/i.test(message)) {
        throw new BookFriendUpstreamError({ code: BOOKFRIEND_ERROR_CODES.SESSION_NOT_FOUND, message, statusCode: 404, details: { targetUrl, payload: data } });
      }
      if (resp.status >= 500) throw new BookFriendUpstreamError({ code: BOOKFRIEND_ERROR_CODES.BOOKFRIEND_5XX, message, statusCode: 502, details: { upstreamStatus: resp.status, targetUrl, payload: data }, retryable: true });
      throw new BookFriendUpstreamError({ code: BOOKFRIEND_ERROR_CODES.UPSTREAM_4XX, message, statusCode: resp.status, details: { targetUrl, payload: data } });
    }
    return data;
  } catch (error) {
    if (error instanceof BookFriendUpstreamError) throw error;
    if (error.name === 'AbortError') throw new BookFriendUpstreamError({ code: BOOKFRIEND_ERROR_CODES.UPSTREAM_TIMEOUT, message: 'BookFriend request timed out.', statusCode: 504, retryable: true });
    throw new BookFriendUpstreamError({ code: BOOKFRIEND_ERROR_CODES.UPSTREAM_UNAVAILABLE, message: 'BookFriend service is unavailable.', statusCode: 503, retryable: true, details: { reason: error.message } });
  } finally { clearTimeout(timeout); }
};

export const postWithRetry = async (req, path, payload) => {
  let attempt = 0;
  let lastError;
  while (attempt < 2) {
    try {
      return await doPost(req, path, payload);
    } catch (error) {
      lastError = error;
      const retryable = error.retryable && (error.code === BOOKFRIEND_ERROR_CODES.UPSTREAM_UNAVAILABLE || error.code === BOOKFRIEND_ERROR_CODES.BOOKFRIEND_5XX || error.code === BOOKFRIEND_ERROR_CODES.UPSTREAM_TIMEOUT);
      if (!retryable || attempt >= 1) throw error;
      await sleep(150 + Math.floor(Math.random() * 250));
      attempt += 1;
    }
  }
  throw lastError;
};

export const bookfriendClient = {
  startSession: (req, payload) => postWithRetry(req, '/agent/start', payload),
  sendMessage: (req, payload) => postWithRetry(req, '/agent/message', payload),
  endSession: (req, payload) => postWithRetry(req, '/agent/end', payload),
};

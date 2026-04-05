import axios from 'axios';
let rateLimitedUntil = 0;
const RECOVERY_MODE = String(import.meta.env.VITE_RECOVERY_MOCK_API ?? 'true').toLowerCase() !== 'false';
const REAL_ENDPOINTS = new Set(
  String(import.meta.env.VITE_RECOVERY_REAL_ENDPOINTS ?? '/health')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const parseRetryAfterMs = (retryAfterHeader) => {
  if (!retryAfterHeader) return null;
  const raw = String(retryAfterHeader).trim();
  if (!raw) return null;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);

  const dateMs = Date.parse(raw);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());

  return null;
};

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const mockUser = {
  _id: 'recovery-user',
  name: 'Recovery Mode User',
  email: 'recovery@local.dev',
  role: 'user',
  preferences: { theme: 'dark' },
};

const mockBooks = [
  { _id: 'mock-book-1', title: 'Recovery Placeholder Book', author: 'System', description: 'Mock data while backend stabilizes.' },
];

const buildMockResponse = (config) => {
  const url = String(config?.url || '');
  const method = String(config?.method || 'get').toLowerCase();
  const path = url.startsWith('/') ? url : `/${url}`;

  if (method === 'get' && path === '/auth/me') return { user: mockUser };
  if (method === 'post' && (path === '/auth/login' || path === '/auth/register')) return { user: mockUser, token: 'mock-token' };
  if (method === 'post' && path === '/auth/logout') return { ok: true };
  if (method === 'get' && (path === '/books' || path.startsWith('/books/search'))) return { books: mockBooks };
  if (method === 'get' && path.startsWith('/books/')) return { ...mockBooks[0], _id: path.split('/')[2] || mockBooks[0]._id };
  if (method === 'get' && path === '/session/status') return { active: false, state: 'IDLE' };
  if (method === 'post' && (path === '/session/start' || path === '/session/end' || path === '/matchmaking/join' || path === '/matchmaking/leave')) return { ok: true };
  if (method === 'post' && path === '/access/check-batch') return { access: [] };
  if (method === 'get' && path.startsWith('/access/check')) return { allowed: true };
  if (method === 'post' && path.startsWith('/quiz/')) return { ok: true, jobId: 'mock-job' };
  if (method === 'get' && path.startsWith('/quiz/status/')) return { status: 'done' };
  if (method === 'get' && path.startsWith('/quiz/result/')) return { result: { score: 0, questions: [] } };
  if (method === 'post' && path.startsWith('/agent/')) return { session_id: 'mock-session', reply: 'Recovery mode response.' };
  if (method === 'get' && path.startsWith('/threads/')) return { threads: [] };
  if (method === 'post' && path.startsWith('/threads')) return { thread: null, comment: null };
  if (method === 'post' && path === '/recommender') return { recommendations: [] };
  if (path === '/health') return { status: 'ok' };

  return { ok: true };
};

const isTransientNetworkFailure = (error) => {
  if (error?.response) return false;
  const code = String(error?.code || '').toUpperCase();
  return code === 'ERR_NETWORK' || code === 'ECONNREFUSED' || code === 'ECONNRESET';
};

api.interceptors.request.use(async (config) => {
  if (Date.now() < rateLimitedUntil) {
    await sleep(rateLimitedUntil - Date.now());
  }

  if (RECOVERY_MODE && !REAL_ENDPOINTS.has(String(config?.url || ''))) {
    config.adapter = async () => ({
      data: buildMockResponse(config),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: null,
    });
  }
  return config;
});

const shouldDispatchUnauthorized = (error, statusCode) => {
  if (statusCode !== 401 || typeof window === 'undefined') return false;

  const requestUrl = String(error?.config?.url || '');
  if (
    requestUrl.includes('/users/refresh')
  ) return false;

  return true;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config;
    if (config && isTransientNetworkFailure(error) && !config.__retryAfterNetworkFailure) {
      config.__retryAfterNetworkFailure = true;
      await sleep(350);
      return api.request(config);
    }

    const statusCode = Number(error?.response?.status || 0) || null;

    if (statusCode === 429) {
      const retryAfterMs = parseRetryAfterMs(error?.response?.headers?.['retry-after']);
      rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + (retryAfterMs ?? 4000));
    }

    if (shouldDispatchUnauthorized(error, statusCode)) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized', {
        detail: { status: statusCode, url: String(error?.config?.url || '') },
      }));
    }

    const isTimeout = error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message || ''));
    const mappedMessage = statusCode === 504
      ? 'This request is taking longer than expected.'
      : (isTimeout ? 'Still loading, please retry.' : null);

    return Promise.reject({
      ...error,
      uiMessage: mappedMessage || error?.response?.data?.message || error?.message || 'Request failed.',
      statusCode,
    });
  },
);

export default api;

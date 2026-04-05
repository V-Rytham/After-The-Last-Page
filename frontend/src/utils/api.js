import axios from 'axios';
let rateLimitedUntil = 0;

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

const isTransientNetworkFailure = (error) => {
  if (error?.response) return false;
  const code = String(error?.code || '').toUpperCase();
  return code === 'ERR_NETWORK' || code === 'ECONNREFUSED' || code === 'ECONNRESET';
};

api.interceptors.request.use(async (config) => {
  if (Date.now() < rateLimitedUntil) {
    await sleep(rateLimitedUntil - Date.now());
  }
  return config;
});

const shouldDispatchUnauthorized = (error, statusCode) => {
  if (statusCode !== 401 || typeof window === 'undefined') return false;

  const requestUrl = String(error?.config?.url || '');
  if (
    requestUrl.includes('/users/refresh')
    || requestUrl.includes('/users/login')
    || requestUrl.includes('/users/signup')
    || requestUrl.includes('/users/verify-otp')
    || requestUrl.includes('/users/resend-otp')
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

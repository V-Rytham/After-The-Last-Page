import crypto from 'node:crypto';
import { getCache } from '../config/cache.js';
import { AppError } from '../lib/errors.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const responseToData = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return { text };
};

export const cachedRequest = async ({ cacheKey, cacheTtlSeconds = 60, ...requestOptions }) => {
  const cache = getCache();
  if (cacheKey) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  const data = await requestWithRetry(requestOptions);

  if (cacheKey) {
    await cache.set(cacheKey, JSON.stringify(data), 'EX', cacheTtlSeconds);
  }

  return data;
};

export const hashRequestBody = (body) => crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

export const requestWithRetry = async ({ url, method = 'GET', headers, body, timeoutMs = 8000, retries = 2 }) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await responseToData(response);

      if (!response.ok) {
        throw new AppError(`External request failed with status ${response.status}.`, {
          statusCode: 502,
          code: 'EXTERNAL_REQUEST_FAILED',
          details: data,
        });
      }

      clearTimeout(timeout);
      return data;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      if (attempt >= retries) {
        break;
      }

      await sleep(250 * (attempt + 1));
    }
  }

  if (lastError?.name === 'AbortError') {
    throw new AppError('External request timed out.', { statusCode: 504, code: 'EXTERNAL_TIMEOUT' });
  }

  throw lastError instanceof AppError
    ? lastError
    : new AppError('External request failed.', { statusCode: 502, code: 'EXTERNAL_REQUEST_FAILED' });
};

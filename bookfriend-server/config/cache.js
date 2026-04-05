import { logger } from '../lib/logger.js';

const store = new Map();
const expiryTimers = new Map();

const getNow = () => Date.now();

const clearExpiryTimer = (key) => {
  const timer = expiryTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    expiryTimers.delete(key);
  }
};

const scheduleExpiry = (key, ttlMs) => {
  clearExpiryTimer(key);

  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    return;
  }

  const timeout = setTimeout(() => {
    const record = store.get(key);
    if (record?.expiresAt && record.expiresAt <= getNow()) {
      store.delete(key);
    }
    expiryTimers.delete(key);
  }, ttlMs);

  timeout.unref?.();
  expiryTimers.set(key, timeout);
};

const parseTtlArgs = (args = []) => {
  if (!Array.isArray(args) || args.length < 2) {
    return null;
  }

  const mode = String(args[0] || '').toUpperCase();
  const rawValue = Number.parseInt(String(args[1] || ''), 10);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return null;
  }

  if (mode === 'EX') {
    return rawValue * 1000;
  }

  if (mode === 'PX') {
    return rawValue;
  }

  return null;
};

const isExpired = (record) => Boolean(record?.expiresAt && record.expiresAt <= getNow());

const memoryCacheClient = {
  status: 'ready',
  async connect() {
    return this;
  },
  on(_eventName, _handler) {
    return this;
  },
  async get(key) {
    const record = store.get(key);
    if (!record) {
      return null;
    }

    if (isExpired(record)) {
      clearExpiryTimer(key);
      store.delete(key);
      return null;
    }

    return record.value;
  },
  async set(key, value, ...args) {
    const ttlMs = parseTtlArgs(args);
    const expiresAt = ttlMs ? getNow() + ttlMs : null;

    store.set(key, { value, expiresAt });
    scheduleExpiry(key, ttlMs);
    return 'OK';
  },
  async del(key) {
    clearExpiryTimer(key);
    const existed = store.delete(key);
    return existed ? 1 : 0;
  },
  async incr(key) {
    const current = await this.get(key);
    const numericValue = Number.parseInt(current ?? '0', 10);
    const nextValue = Number.isFinite(numericValue) ? numericValue + 1 : 1;

    const record = store.get(key);
    store.set(key, { value: String(nextValue), expiresAt: record?.expiresAt || null });
    return nextValue;
  },
  async pexpire(key, ttlMs) {
    const record = store.get(key);
    if (!record) {
      return 0;
    }

    const parsed = Number.parseInt(String(ttlMs), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }

    record.expiresAt = getNow() + parsed;
    store.set(key, record);
    scheduleExpiry(key, parsed);
    return 1;
  },
};

let cacheClient;

export const getCache = () => {
  if (!cacheClient) {
    cacheClient = memoryCacheClient;
  }

  return cacheClient;
};

export const connectCache = async () => {
  const client = getCache();
  await client.connect();
  logger.info('Using in-memory cache (Redis not required)');
  return client;
};

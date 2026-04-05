import { createClient } from 'redis';
import { logger } from './logger.js';

let client;
let connectPromise;

export const getRedisClient = () => {
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is required for production-grade state management.');
  }

  client = createClient({ url, socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 2000) } });
  client.on('error', (err) => {
    logger.error({ error: err.message, code: 'REDIS_ERROR' }, 'Redis client error');
  });

  return client;
};

export const connectRedis = async () => {
  const redis = getRedisClient();
  if (redis.isOpen) return redis;
  if (!connectPromise) {
    connectPromise = redis.connect().finally(() => {
      connectPromise = null;
    });
  }
  await connectPromise;
  return redis;
};

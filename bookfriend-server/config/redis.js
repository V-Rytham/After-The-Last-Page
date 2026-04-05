import Redis from 'ioredis';
import { logger } from '../lib/logger.js';

let redisClient;

export const getRedis = () => {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required.');
  }

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redisClient.on('error', (error) => {
    logger.error({ error }, 'Redis connection error');
  });

  return redisClient;
};

export const connectRedis = async () => {
  const client = getRedis();
  if (client.status === 'ready') {
    return client;
  }

  await client.connect();
  logger.info('Connected to Redis');
  return client;
};

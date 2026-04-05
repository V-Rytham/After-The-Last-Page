import { connectRedis } from '../utils/redisClient.js';

const getKey = (req, keyGenerator) => {
  if (typeof keyGenerator === 'function') {
    return String(keyGenerator(req) || 'unknown');
  }
  return String(req.ip || req.connection?.remoteAddress || 'unknown');
};

export const rateLimit = ({
  windowMs = 60_000,
  max = 120,
  keyGenerator,
  message = 'Too many requests. Please try again shortly.',
  prefix = 'rate_limit',
} = {}) => async (req, res, next) => {
  try {
    const key = `${prefix}:${getKey(req, keyGenerator)}`;
    const redis = await connectRedis();
    if (!redis) {
      next();
      return;
    }

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }

    if (count > max) {
      const ttlMs = await redis.pttl(key);
      const retryAfterSeconds = Math.max(1, Math.ceil(Math.max(ttlMs, 0) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message,
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
};

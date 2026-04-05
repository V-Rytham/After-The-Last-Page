import { getCache } from '../config/cache.js';

const windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const maxRequests = Number.parseInt(process.env.RATE_LIMIT_MAX || '180', 10);

export const memoryRateLimit = async (req, res, next) => {
  try {
    const ip = String(req.ip || 'unknown');
    const bucket = Math.floor(Date.now() / windowMs);
    const key = `bookfriend:ratelimit:${ip}:${bucket}`;
    const cache = getCache();
    const count = await cache.incr(key);

    if (count === 1) {
      await cache.pexpire(key, windowMs);
    }

    if (count > maxRequests) {
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again shortly.',
        code: 'RATE_LIMITED',
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

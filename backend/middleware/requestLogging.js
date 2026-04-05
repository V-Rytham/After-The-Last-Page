import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

const SLOW_REQUEST_THRESHOLD_MS = 1200;
const getClientIp = (req) => String(req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown');

export const requestTracing = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  res.on('finish', () => {
    const finishedAt = process.hrtime.bigint();
    const elapsedMs = Number(finishedAt - startedAt) / 1_000_000;
    const status = Number(res.statusCode || 0);

    const level = status >= 500 ? 'error' : (status >= 400 || elapsedMs >= SLOW_REQUEST_THRESHOLD_MS ? 'warn' : 'info');

    logger[level]({
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      elapsedMs: Number(elapsedMs.toFixed(2)),
      ip: getClientIp(req),
      userId: req.auth?.sub || req.user?._id?.toString?.(),
    }, 'HTTP request');
  });

  next();
};

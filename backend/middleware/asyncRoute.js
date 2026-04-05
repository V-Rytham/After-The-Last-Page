import { logger } from '../utils/logger.js';

export const asyncRoute = (handler, label = 'route') => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    logger.error({
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      route: label,
      error: error?.message,
      stack: error?.stack,
    }, 'Async route failure');
    console.error(`[RouteError] ${req.method} ${req.originalUrl}`, error);
    next(error);
  }
};


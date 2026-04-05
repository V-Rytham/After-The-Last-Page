import { AppError } from '../lib/errors.js';
import { logger, withRequestContext } from '../lib/logger.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
    code: 'ROUTE_NOT_FOUND',
  });
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';
  const message = isAppError ? err.message : 'Server error.';

  logger.error(withRequestContext({ req, errorCode: code, err }), message);

  res.status(statusCode).json({
    success: false,
    message,
    code,
  });
};

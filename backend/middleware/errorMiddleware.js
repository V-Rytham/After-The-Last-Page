import { error as errorResponse } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

export const notFound = (req, res) => errorResponse(res, 'Not found.', 'NOT_FOUND', 404);

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = Number(err?.statusCode || err?.status || 500);
  const code = err?.code ? String(err.code) : (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');

  logger.error({
    requestId: req.requestId,
    userId: req.auth?.sub || req.user?._id?.toString?.(),
    errorCode: code,
    status,
    error: err?.message,
  }, 'Request failed');

  errorResponse(res, err?.message || 'Server error.', code, status);
};

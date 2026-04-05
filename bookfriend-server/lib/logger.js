import pino from 'pino';

const level = process.env.LOG_LEVEL || (String(process.env.NODE_ENV).toLowerCase() === 'production' ? 'info' : 'debug');

export const logger = pino({
  level,
  base: undefined,
  redact: {
    paths: ['req.headers.authorization', 'req.cookies', 'token', 'password'],
    censor: '[REDACTED]',
  },
});

export const withRequestContext = ({ req, userId, errorCode, ...fields } = {}) => ({
  requestId: req?.id,
  userId: userId || req?.user?.sub || null,
  errorCode: errorCode || null,
  ...fields,
});

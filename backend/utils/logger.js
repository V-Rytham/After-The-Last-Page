import pino from 'pino';

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = pino({
  level,
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const childLogger = (fields = {}) => logger.child(fields);

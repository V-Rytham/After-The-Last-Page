export const BOOKFRIEND_ERROR_CODES = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  INVALID_BOOKFRIEND_RESPONSE: 'INVALID_BOOKFRIEND_RESPONSE',
  BOOKFRIEND_5XX: 'BOOKFRIEND_5XX',
  UPSTREAM_4XX: 'UPSTREAM_4XX',
};

export class BookFriendUpstreamError extends Error {
  constructor({ code, message, statusCode = 502, details = {}, retryable = false }) {
    super(message);
    this.name = 'BookFriendUpstreamError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.retryable = retryable;
  }
}

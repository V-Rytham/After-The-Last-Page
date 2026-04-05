export const sendSuccess = (res, data, statusCode = 200) => res.status(statusCode).json({ success: true, data });

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

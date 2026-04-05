export const success = (res, data, status = 200) => res.status(status).json({ success: true, data });

export const error = (res, message, code, status = 500, extra = {}) => {
  const payload = {
    success: false,
    message: String(message || 'Server error.'),
    ...(code ? { code: String(code) } : {}),
    ...extra,
  };
  return res.status(status).json(payload);
};

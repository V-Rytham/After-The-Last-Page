import { isDegradedMode } from '../utils/degradedMode.js';

export const requireDatabase = ({ status = 200, feature = 'Feature' } = {}) => (req, res, next) => {
  if (!isDegradedMode()) {
    next();
    return;
  }

  res.status(status).json({
    fallback: true,
    message: `${feature} unavailable in degraded mode`,
  });
};

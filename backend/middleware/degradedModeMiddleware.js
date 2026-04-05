import { isDegradedMode } from '../utils/degradedMode.js';
import { error } from '../utils/apiResponse.js';

export const requireDatabase = ({ status = 503, feature = 'Feature' } = {}) => (req, res, next) => {
  if (!isDegradedMode()) {
    next();
    return;
  }

  error(res, `${feature} unavailable in degraded mode`, 'SERVICE_UNAVAILABLE', status);
};

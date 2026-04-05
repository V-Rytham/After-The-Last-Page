import { User } from '../models/User.js';

const DEV_EMAIL = 'dev-user@local.dev';

const buildFallbackUser = () => ({
  _id: 'dev-user',
  name: 'Dev User',
  email: DEV_EMAIL,
  role: 'admin',
  anonymousId: 'dev-user',
  preferences: { theme: 'dark' },
});

export const attachDevUserContext = async (req, _res, next) => {
  try {
    if (req.user) {
      req.auth = { role: 'admin', sub: String(req.user?._id || 'dev-user') };
      return next();
    }

    let user = null;
    try {
      user = await User.findOne({ email: DEV_EMAIL });
      if (!user) {
        user = await User.create({
          name: 'Dev User',
          username: 'devuser',
          email: DEV_EMAIL,
          provider: 'local',
          isVerified: true,
        });
      }
      user.role = 'admin';
      user.anonymousId = 'dev-user';
      req.user = user;
      req.auth = { role: 'admin', sub: String(user._id) };
    } catch {
      req.user = buildFallbackUser();
      req.auth = { role: 'admin', sub: 'dev-user' };
    }

    return next();
  } catch {
    req.user = buildFallbackUser();
    req.auth = { role: 'admin', sub: 'dev-user' };
    return next();
  }
};

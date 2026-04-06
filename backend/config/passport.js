import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User.js';
import { issueAuthToken } from '../utils/generateToken.js';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const generateAnonymousId = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `Reader #${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = await User.findOne({ anonymousId: candidate }).select('_id');
    if (!existing) {
      return candidate;
    }
  }

  return `Reader #${Date.now().toString().slice(-6)}`;
};

const normalizeUsernameSeed = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_]/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '');

const ensureUsernameLength = (value) => {
  const trimmed = String(value || '').slice(0, 20);
  if (trimmed.length >= 3) {
    return trimmed;
  }

  return `${trimmed}${'reader'.slice(0, 3 - trimmed.length)}`;
};

const generateGoogleUsername = async ({ email, profile }) => {
  const emailLocalPart = String(email || '').split('@')[0] || '';
  const profileIdTail = String(profile?.id || '').slice(-4);
  const candidates = [
    normalizeUsernameSeed(emailLocalPart),
    normalizeUsernameSeed(profile?.displayName),
    normalizeUsernameSeed(`reader_${profileIdTail}`),
    'reader',
  ].filter(Boolean);

  for (const seed of candidates) {
    const base = ensureUsernameLength(seed);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = attempt === 0 ? '' : `_${Math.floor(10 + Math.random() * 90)}`;
      const candidate = ensureUsernameLength(`${base}${suffix}`.slice(0, 20));
      const existing = await User.findOne({ usernameLower: candidate.toLowerCase() }).select('_id');
      if (!existing) {
        return candidate;
      }
    }
  }

  return `reader_${Date.now().toString().slice(-6)}`;
};

export const configurePassport = () => {
  const clientID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const callbackURL = String(process.env.GOOGLE_CALLBACK_URL || '').trim();

  if (!clientID || !clientSecret || !callbackURL) {
    return;
  }

  passport.use(new GoogleStrategy({
    clientID,
    clientSecret,
    callbackURL,
    passReqToCallback: false,
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const primaryEmail = profile?.emails?.[0];
      const verified = Boolean(primaryEmail?.verified);
      const normalizedEmail = normalizeEmail(primaryEmail?.value);

      if (!normalizedEmail || !verified) {
        return done(null, false, { message: 'Google account email must be verified.' });
      }

      let user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        user = await User.create({
          anonymousId: await generateAnonymousId(),
          email: normalizedEmail,
          provider: 'google',
          isVerified: true,
          isAnonymous: false,
          name: profile?.displayName || normalizedEmail,
          username: await generateGoogleUsername({ email: normalizedEmail, profile }),
          bio: '',
          rating: 5,
          preferences: {
            theme: 'dark',
            defaultMatchMedium: 'text',
          },
        });
      } else {
        user.provider = 'google';
        user.isVerified = true;
        await user.save();
      }

      const token = issueAuthToken(user._id, { isAnonymous: user.isAnonymous, anonymousId: user.anonymousId });
      return done(null, { userId: user._id, token });
    } catch (error) {
      return done(error);
    }
  }));
};

export default passport;

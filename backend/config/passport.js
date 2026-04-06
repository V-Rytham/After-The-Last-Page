import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User.js';

const randomReaderId = () => `Reader #${Math.floor(1000 + Math.random() * 9000)}`;

const resolveVerifiedEmail = (profile) => {
  const emails = Array.isArray(profile?.emails) ? profile.emails : [];
  const primary = emails.find((entry) => entry?.verified && entry?.value)?.value;
  return (primary || emails[0]?.value || '').trim().toLowerCase();
};

export const configurePassport = () => {
  const clientID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const callbackURL = String(process.env.GOOGLE_CALLBACK_URL || '').trim();

  if (!clientID || !clientSecret || !callbackURL) {
    console.warn('[AUTH] Google OAuth is not fully configured. /auth/google is disabled.');
    return;
  }

  passport.use(new GoogleStrategy(
    {
      clientID,
      clientSecret,
      callbackURL,
      scope: ['profile', 'email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = resolveVerifiedEmail(profile);
        if (!email) {
          return done(new Error('Google account email is missing or unverified.'));
        }

        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            email,
            anonymousId: randomReaderId(),
            name: profile?.displayName || '',
            isVerified: true,
            provider: 'google',
            isAnonymous: false,
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));
};

export default passport;

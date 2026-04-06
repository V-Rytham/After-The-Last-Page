import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { sendOtpEmail } from '../services/emailService.js';
import { buildAuthCookieOptions, clearAuthCookieOptions } from '../utils/authCookies.js';
import { generateOtp, hashOtp, OTP_EXPIRY_MS } from '../utils/otp.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_ATTEMPT_LIMIT = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

const randomReaderId = () => `Reader #${Math.floor(1000 + Math.random() * 9000)}`;

const issueToken = (userId) => jwt.sign({ id: String(userId) }, process.env.JWT_SECRET, { expiresIn: '7d' });

const sanitizeAuthUser = (user) => ({
  _id: user._id,
  email: user.email,
  anonymousId: user.anonymousId,
  isVerified: Boolean(user.isVerified),
  provider: user.provider,
  name: user.name || '',
});

export const signup = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!EMAIL_RE.test(email) || password.length < 8) {
      return res.status(400).json({ message: 'Valid email and password (min 8 chars) are required.' });
    }

    let user = await User.findOne({ email });
    const now = Date.now();
    if (user?.otpLastSentAt && (now - new Date(user.otpLastSentAt).getTime()) < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ message: 'Please wait 60 seconds before requesting another OTP.' });
    }

    if (user && user.isVerified) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);

    if (!user) {
      user = new User({
        email,
        password: hashedPassword,
        anonymousId: randomReaderId(),
        isVerified: false,
        provider: 'local',
        isAnonymous: false,
        otpHash,
        otpExpiry,
        otpAttempts: 0,
        otpLastSentAt: new Date(),
      });
    } else {
      user.password = hashedPassword;
      user.otpHash = otpHash;
      user.otpExpiry = otpExpiry;
      user.otpAttempts = 0;
      user.otpLastSentAt = new Date();
      user.provider = 'local';
      user.isVerified = false;
    }

    await user.save();
    await sendOtpEmail(email, otp);

    return res.status(200).json({ message: 'OTP sent' });
  } catch (error) {
    console.error('[AUTH] signup failed:', error?.message || error);
    return res.status(500).json({ message: 'Could not process signup right now.' });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();

    const user = await User.findOne({ email });
    if (!user || user.provider !== 'local') {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if ((user.otpAttempts || 0) >= OTP_ATTEMPT_LIMIT) {
      return res.status(429).json({ message: 'Maximum OTP attempts reached. Please request a new OTP.' });
    }

    if (!user.otpHash || !user.otpExpiry || new Date(user.otpExpiry).getTime() < Date.now()) {
      return res.status(400).json({ message: 'Expired OTP' });
    }

    const incomingHash = hashOtp(otp);
    const isMatch = incomingHash === user.otpHash;

    if (!isMatch) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    user.isVerified = true;
    user.otpHash = undefined;
    user.otpExpiry = undefined;
    user.otpAttempts = 0;
    await user.save();

    const token = issueToken(user._id);
    res.cookie('alp_auth', token, buildAuthCookieOptions());
    return res.status(200).json({ token, user: sanitizeAuthUser(user) });
  } catch (error) {
    console.error('[AUTH] verifyOtp failed:', error?.message || error);
    return res.status(500).json({ message: 'Could not verify OTP right now.' });
  }
};

export const login = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const user = await User.findOne({ email });
    if (!user || user.provider !== 'local') {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password || '');
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Account not verified. Please verify OTP first.' });
    }

    const token = issueToken(user._id);
    res.cookie('alp_auth', token, buildAuthCookieOptions());
    return res.status(200).json({ token, user: sanitizeAuthUser(user) });
  } catch (error) {
    console.error('[AUTH] login failed:', error?.message || error);
    return res.status(500).json({ message: 'Could not login right now.' });
  }
};

export const googleSuccess = async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Google login failed' });
  }

  const token = issueToken(user._id);
  res.cookie('alp_auth', token, buildAuthCookieOptions());

  const clientUrl = String(process.env.CLIENT_URL || 'http://localhost:5173');
  const safe = encodeURIComponent(JSON.stringify(sanitizeAuthUser(user)));
  return res.redirect(`${clientUrl}/#/auth/login?google=success&user=${safe}`);
};

export const googleFailure = (_req, res) => res.status(401).json({ message: 'Google login failed' });

export const logout = async (_req, res) => {
  res.clearCookie('alp_auth', clearAuthCookieOptions());
  return res.status(200).json({ message: 'Logged out' });
};

export const me = async (req, res) => {
  return res.status(200).json({ user: sanitizeAuthUser(req.user) });
};

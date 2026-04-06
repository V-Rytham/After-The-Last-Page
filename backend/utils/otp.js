import crypto from 'crypto';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

export const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp || '')).digest('hex');

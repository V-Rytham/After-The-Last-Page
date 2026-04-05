import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { Otp } from '../models/Otp.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 45 * 1000;
const OTP_MAX_RESENDS = 5;

const buildTransport = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return null;
};

const transporter = buildTransport();

const generateOtpCode = () => String(crypto.randomInt(100000, 999999));

export const issueEmailOtp = async (user) => {
  const existing = await Otp.findOne({ userId: user._id, consumedAt: null }).sort({ createdAt: -1 });
  if (existing) {
    const elapsed = Date.now() - new Date(existing.createdAt).getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      const err = new Error('Please wait before requesting another OTP.');
      err.statusCode = 429;
      throw err;
    }

    if (existing.resendCount >= OTP_MAX_RESENDS) {
      const err = new Error('Maximum OTP resend limit reached. Please try again later.');
      err.statusCode = 429;
      throw err;
    }
  }

  const otpCode = generateOtpCode();
  const otpCodeHash = await bcrypt.hash(otpCode, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await Otp.create({
    userId: user._id,
    otpCodeHash,
    expiresAt,
    resendCount: existing ? existing.resendCount + 1 : 0,
  });

  await Otp.updateMany({ userId: user._id, _id: { $ne: undefined }, consumedAt: null, expiresAt: { $lt: new Date() } }, { $set: { consumedAt: new Date() } });

  if (transporter) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: 'Your After The Last Page verification code',
      text: `Your OTP code is ${otpCode}. It expires in 10 minutes.`,
    });
  } else {
    console.info(`[OTP] Verification code for ${user.email}: ${otpCode}`);
  }

  return { expiresAt };
};

export const verifyEmailOtp = async ({ userId, otpCode }) => {
  const otp = await Otp.findOne({ userId, consumedAt: null }).sort({ createdAt: -1 });
  if (!otp) {
    const error = new Error('No active OTP found.');
    error.statusCode = 400;
    throw error;
  }

  if (otp.expiresAt.getTime() < Date.now()) {
    const error = new Error('OTP has expired.');
    error.statusCode = 400;
    throw error;
  }

  const valid = await bcrypt.compare(String(otpCode), otp.otpCodeHash);
  if (!valid) {
    const error = new Error('Invalid OTP code.');
    error.statusCode = 400;
    throw error;
  }

  otp.consumedAt = new Date();
  await otp.save();
};

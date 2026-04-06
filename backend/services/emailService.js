import { Resend } from 'resend';

const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
const fromEmail = String(process.env.RESEND_FROM_EMAIL || '').trim();

const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

export const sendOtpEmail = async (email, otp) => {
  if (!resendClient || !fromEmail) {
    console.warn('[AUTH] Resend not configured. OTP delivery skipped for', email);
    return;
  }

  await resendClient.emails.send({
    from: fromEmail,
    to: email,
    subject: 'Your verification code',
    html: `<p>Your After The Last Page OTP is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
  });
};

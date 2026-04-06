import { Resend } from 'resend';

const resendKey = String(process.env.RESEND_API_KEY || '').trim();
const fromEmail = String(process.env.RESEND_FROM_EMAIL || '').trim();

const resendClient = resendKey ? new Resend(resendKey) : null;

export const sendOtpEmail = async (email, otp) => {
  if (!resendClient || !fromEmail) {
    console.warn('[AUTH] Resend is not configured. OTP delivery is skipped.');
    return;
  }

  await resendClient.emails.send({
    from: fromEmail,
    to: [email],
    subject: 'Your After The Last Page verification code',
    text: `Your verification code is ${otp}. This code expires in 5 minutes.`,
  });
};

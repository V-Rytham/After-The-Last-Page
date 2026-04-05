import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LogIn, UserPlus } from 'lucide-react';
import api from '../utils/api';
import { saveAuthSession } from '../utils/auth';
import './AuthPage.css';

const initialSignupState = { name: '', username: '', email: '', password: '', confirmPassword: '' };
const initialLoginState = { email: '', password: '' };

export default function AuthPage({ onAuthSuccess, currentUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState(initialLoginState);
  const [signupForm, setSignupForm] = useState(initialSignupState);
  const [otpForm, setOtpForm] = useState({ email: '', otpCode: '' });
  const [needsVerification, setNeedsVerification] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectPath = location.state?.from || '/desk';

  useEffect(() => {
    if (currentUser?._id) {
      navigate(redirectPath, { replace: true });
    }
  }, [currentUser?._id, navigate, redirectPath]);

  const introCopy = useMemo(() => 'Create an account or sign in to keep your reading identity with you.', []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const { data } = await api.post('/users/login', loginForm);
      const user = saveAuthSession(data.user);
      onAuthSuccess(user);
      navigate(redirectPath, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign in right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setError('');

    if (signupForm.password !== signupForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/users/signup', {
        name: signupForm.name,
        username: signupForm.username,
        email: signupForm.email,
        password: signupForm.password,
      });
      setNeedsVerification(true);
      setOtpForm({ email: signupForm.email, otpCode: '' });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create your account right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const { data } = await api.post('/users/verify-otp', otpForm);
      const user = saveAuthSession(data.user);
      onAuthSuccess(user);
      navigate(redirectPath, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'OTP verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    setError('');
    try {
      await api.post('/users/resend-otp', { email: otpForm.email });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to resend OTP right now.');
    }
  };

  return (
    <div className="auth-page animate-fade-in">
      <div className="auth-shell">
        <section className="auth-copy glass-panel">
          <h1 className="font-serif auth-title">Keep your reading world with you.</h1>
          <p className="auth-subtitle">{introCopy}</p>
        </section>

        <section className="auth-card glass-panel">
          <div className="auth-tabs">
            <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>
              <LogIn size={18} /> Login
            </button>
            <button className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')}>
              <UserPlus size={18} /> Sign up
            </button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          {needsVerification ? (
            <form className="auth-form" onSubmit={handleOtpSubmit}>
              <label className="auth-label">
                <span>Email</span>
                <input type="email" className="auth-input" value={otpForm.email} onChange={(e) => setOtpForm((prev) => ({ ...prev, email: e.target.value }))} required />
              </label>
              <label className="auth-label">
                <span>OTP Code</span>
                <input type="text" className="auth-input" maxLength={6} value={otpForm.otpCode} onChange={(e) => setOtpForm((prev) => ({ ...prev, otpCode: e.target.value.replace(/\D/g, '') }))} required />
              </label>
              <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
                {submitting ? 'Verifying...' : 'Verify & Continue'} <ArrowRight size={18} />
              </button>
              <button type="button" className="auth-tab" onClick={resendOtp}>Resend OTP</button>
            </form>
          ) : mode === 'login' ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <label className="auth-label">
                <span>Email</span>
                <input name="email" type="email" value={loginForm.email} onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))} className="auth-input" required />
              </label>
              <label className="auth-label">
                <span>Password</span>
                <input name="password" type="password" value={loginForm.password} onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))} className="auth-input" required />
              </label>
              <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
                {submitting ? 'Signing in...' : 'Login'} <ArrowRight size={18} />
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleSignup}>
              <label className="auth-label"><span>Name</span><input name="name" type="text" value={signupForm.name} onChange={(e) => setSignupForm((prev) => ({ ...prev, name: e.target.value }))} className="auth-input" required /></label>
              <label className="auth-label"><span>Username</span><input name="username" type="text" value={signupForm.username} onChange={(e) => setSignupForm((prev) => ({ ...prev, username: e.target.value }))} className="auth-input" /></label>
              <label className="auth-label"><span>Email</span><input name="email" type="email" value={signupForm.email} onChange={(e) => setSignupForm((prev) => ({ ...prev, email: e.target.value }))} className="auth-input" required /></label>
              <label className="auth-label"><span>Password</span><input name="password" type="password" value={signupForm.password} onChange={(e) => setSignupForm((prev) => ({ ...prev, password: e.target.value }))} className="auth-input" required /></label>
              <label className="auth-label"><span>Confirm password</span><input name="confirmPassword" type="password" value={signupForm.confirmPassword} onChange={(e) => setSignupForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} className="auth-input" required /></label>
              <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
                {submitting ? 'Creating account...' : 'Sign up'} <ArrowRight size={18} />
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

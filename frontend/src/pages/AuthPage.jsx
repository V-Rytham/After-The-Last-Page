import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LogIn, UserPlus } from 'lucide-react';
import { DEV_USER, saveAuthSession } from '../utils/auth';
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
  const [googleBusy] = useState(false);
  const googleButtonRef = useRef(null);
  const googleClientId = '';

  const redirectPath = location.state?.from || '/desk';

  useEffect(() => {
    if (currentUser?._id) {
      navigate(redirectPath, { replace: true });
    }
  }, [currentUser?._id, navigate, redirectPath]);

  const introCopy = useMemo(() => 'Development mode is active. Continue with a local reader profile.', []);

  const continueWithDevUser = () => {
    const formSource = mode === 'signup' ? signupForm : loginForm;
    const user = saveAuthSession({
      ...DEV_USER,
      name: String(formSource.name || '').trim() || DEV_USER.name,
      email: String(formSource.email || '').trim() || DEV_USER.email,
      username: String(signupForm.username || '').trim() || DEV_USER.username,
    });
    onAuthSuccess(user);
    navigate(redirectPath, { replace: true });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    continueWithDevUser();
    setSubmitting(false);
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setError('');

    if (signupForm.password !== signupForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setNeedsVerification(true);
    setOtpForm({ email: signupForm.email, otpCode: '000000' });
    setSubmitting(false);
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    continueWithDevUser();
    setSubmitting(false);
  };

  const resendOtp = async () => {
    setError('In development mode, OTP is mocked. Use 000000.');
  };

  const handleGuestLogin = async () => {
    setError('');
    setSubmitting(true);
    const user = saveAuthSession({ ...DEV_USER, name: 'Guest Reader', username: 'guestreader' });
    onAuthSuccess(user);
    navigate('/desk', { replace: true });
    setSubmitting(false);
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
                <input name="email" type="email" autoComplete="email" value={loginForm.email} onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))} className="auth-input" required />
              </label>
              <label className="auth-label">
                <span>Password</span>
                <input name="password" type="password" autoComplete="current-password" value={loginForm.password} onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))} className="auth-input" required />
              </label>
              <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
                {submitting ? 'Signing in...' : 'Login'} <ArrowRight size={18} />
              </button>
              <button type="button" className="auth-tab" onClick={handleGuestLogin} disabled={submitting || googleBusy}>
                Continue as guest
              </button>
              {googleClientId ? (
                <div className="auth-social">
                  <span className="auth-social-divider">or</span>
                  <div ref={googleButtonRef} className={`auth-google-btn ${googleBusy ? 'is-busy' : ''}`} />
                </div>
              ) : null}
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleSignup}>
              <label className="auth-label"><span>Name</span><input name="name" type="text" autoComplete="name" value={signupForm.name} onChange={(e) => setSignupForm((prev) => ({ ...prev, name: e.target.value }))} className="auth-input" required /></label>
              <label className="auth-label"><span>Username</span><input name="username" type="text" autoComplete="username" value={signupForm.username} onChange={(e) => setSignupForm((prev) => ({ ...prev, username: e.target.value }))} className="auth-input" /></label>
              <label className="auth-label"><span>Email</span><input name="email" type="email" autoComplete="email" value={signupForm.email} onChange={(e) => setSignupForm((prev) => ({ ...prev, email: e.target.value }))} className="auth-input" required /></label>
              <label className="auth-label"><span>Password</span><input name="password" type="password" autoComplete="new-password" value={signupForm.password} onChange={(e) => setSignupForm((prev) => ({ ...prev, password: e.target.value }))} className="auth-input" required /></label>
              <label className="auth-label"><span>Confirm password</span><input name="confirmPassword" type="password" autoComplete="new-password" value={signupForm.confirmPassword} onChange={(e) => setSignupForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} className="auth-input" required /></label>
              <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
                {submitting ? 'Creating account...' : 'Sign up'} <ArrowRight size={18} />
              </button>
              <button type="button" className="auth-tab" onClick={handleGuestLogin} disabled={submitting || googleBusy}>
                Continue as guest
              </button>
              {googleClientId ? (
                <div className="auth-social">
                  <span className="auth-social-divider">or</span>
                  <div ref={googleButtonRef} className={`auth-google-btn ${googleBusy ? 'is-busy' : ''}`} />
                </div>
              ) : null}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

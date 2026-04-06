import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const SignupPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/signup', { email, password });
      navigate('/auth/otp', { state: { email } });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="glass-panel" style={{ maxWidth: 420, margin: '2rem auto', padding: 20 }}>
      <h2>Create account</h2>
      <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input placeholder="Password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p>{error}</p>}
      <button type="submit" disabled={loading}>{loading ? 'Sending OTP...' : 'Sign up'}</button>
      <p><Link to="/auth/login">Already have an account?</Link></p>
    </form>
  );
};

export default SignupPage;

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuthContext } from '../../context/AuthContext';

const OtpPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultEmail = location.state?.email || '';
  const [email, setEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshAuth } = useAuthContext();

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { email, otp });
      await refreshAuth();
      navigate('/desk', { replace: true });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="glass-panel" style={{ maxWidth: 420, margin: '2rem auto', padding: 20 }}>
      <h2>Verify OTP</h2>
      <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input placeholder="6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} required />
      {error && <p>{error}</p>}
      <button type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify OTP'}</button>
      <p><Link to="/auth/signup">Back to signup</Link></p>
    </form>
  );
};

export default OtpPage;

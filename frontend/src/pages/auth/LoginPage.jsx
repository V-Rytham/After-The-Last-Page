import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuthContext } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../utils/serviceUrls';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshAuth } = useAuthContext();

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('google') === 'success') {
      refreshAuth().then(() => {
        navigate('/desk', { replace: true });
      });
    }
  }, [navigate, refreshAuth]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/login', { email, password });
      await refreshAuth();
      navigate(location.state?.from || '/desk', { replace: true });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const authBase = String(getApiBaseUrl() || '').replace(/\/$/, '');
  const googleUrl = `${authBase}/auth/google`;

  return (
    <form onSubmit={onSubmit} className="glass-panel" style={{ maxWidth: 420, margin: '2rem auto', padding: 20 }}>
      <h2>Login</h2>
      <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p>{error}</p>}
      <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</button>
      <a href={googleUrl}>Continue with Google</a>
      <p><Link to="/auth/signup">Create account</Link></p>
    </form>
  );
};

export default LoginPage;

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { authUser, authReady } = useAuthContext();
  const location = useLocation();

  if (!authReady) {
    return <div className="glass-panel" style={{ padding: 16 }}>Checking your session…</div>;
  }

  if (!authUser) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default PrivateRoute;

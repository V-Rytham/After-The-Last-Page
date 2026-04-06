import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const refreshAuth = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setAuthUser(data?.user || null);
      return data?.user || null;
    } catch {
      setAuthUser(null);
      return null;
    } finally {
      setAuthReady(true);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const value = useMemo(() => ({ authUser, authReady, setAuthUser, refreshAuth }), [authUser, authReady]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }

  return ctx;
};

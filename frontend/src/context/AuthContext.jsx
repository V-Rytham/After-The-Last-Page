/* eslint-disable react-refresh/only-export-components */
import React, { createContext } from 'react';

export const AuthContext = createContext(null);

export const AuthProvider = ({ value, children }) => (
  <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
);

import React from 'react';
import { AuthContext } from '../../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { authLoading } = React.useContext(AuthContext) || {};

  if (authLoading) {
    return null;
  }

  return children;
}

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import api from '../../utils/api';

const VerificationGate = ({ children }) => {
  const { bookId } = useParams();
  const location = useLocation();
  const [state, setState] = useState({ loading: true, allowed: false, isbn: null });

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await api.get(`/verification/status/book/${bookId}`);
        setState({ loading: false, allowed: Boolean(data.verified), isbn: data.isbn || null });
      } catch {
        setState({ loading: false, allowed: false, isbn: null });
      }
    };

    run();
  }, [bookId]);

  if (state.loading) {
    return <div className="text-center p-10 mt-20">Checking book verification...</div>;
  }

  if (!state.allowed) {
    return <Navigate to={`/verify-reading/book/${encodeURIComponent(bookId)}`} replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default VerificationGate;

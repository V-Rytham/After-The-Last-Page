import axios from 'axios';

// Get backend URL from env; otherwise infer host (helps when testing from iPad/tablet on LAN).
const baseURL = (() => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    const normalized = envUrl.trim();
    if (!normalized) {
      return '/api';
    }

    const isAbsolute = /^https?:\/\//i.test(normalized);
    if (isAbsolute || normalized.startsWith('/')) {
      return normalized;
    }

    // Allow `VITE_API_URL=api` (common misconfig) by normalizing to a root-relative path.
    return `/${normalized}`;
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:5000/api';
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
    return `${window.location.protocol}//${host}:5000/api`;
  }

  return 'http://127.0.0.1:5000/api';
})();

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to inject token if we have one
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;

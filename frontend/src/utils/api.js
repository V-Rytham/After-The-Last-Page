import axios from 'axios';
import { getApiBaseUrl } from './serviceUrls';

const baseURL = getApiBaseUrl();

const api = axios.create({
  baseURL,
  timeout: 15000,
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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message
      || (error?.code === 'ECONNABORTED' ? 'Request timed out. Please try again.' : null)
      || error?.message
      || 'Request failed.';

    return Promise.reject({
      ...error,
      uiMessage: message,
      statusCode: Number(error?.response?.status || 0) || null,
    });
  },
);

export default api;

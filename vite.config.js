import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:5000';

// https://vite.dev/config/
export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: backendTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});

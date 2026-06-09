import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4000,
    proxy: {
      '/orgs':     'http://localhost:3000',
      '/channels': 'http://localhost:3000',
      '/orders':   'http://localhost:3000',
      '/health':   'http://localhost:3000',
      '/admin':    'http://localhost:3000',
    },
  },
});

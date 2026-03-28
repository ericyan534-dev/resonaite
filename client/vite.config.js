import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
      '/audio': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
      '/eeg-stream': {
        target: 'http://localhost:3002',
        rewrite: (path) => '/stream',
      },
      '/eeg-health': {
        target: 'http://localhost:3002',
        rewrite: (path) => '/health',
      },
    }
  }
});

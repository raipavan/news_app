import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:4000',
      '/static': 'http://localhost:4000',
      '/kn/news': 'http://localhost:4000',
      '/en/news': 'http://localhost:4000',
      '/sitemap.xml': 'http://localhost:4000',
      '/robots.txt': 'http://localhost:4000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});

/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, proxy: { '/api': 'http://localhost:3200' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false },
});

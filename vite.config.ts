import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devApi } from './vite-plugin-dev-api';

export default defineConfig({
  plugins: [react(), devApi()],
  server: { host: true, port: 5173 },
});

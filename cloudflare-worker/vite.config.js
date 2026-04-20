import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Point Vite at the existing frontend source so the worker project
// doesn't duplicate all the React components.
const FRONTEND_SRC = path.resolve(__dirname, '../../frontend/src');

export default defineConfig({
  plugins: [react(), cloudflare()],
  root: __dirname,           // keep index.html here
  resolve: {
    alias: {
      // Any absolute import starting with /src is resolved from the real frontend
      '@': FRONTEND_SRC,
    },
  },
  // Vite will look for source files in the real frontend directory
  // while keeping index.html in this project's root.
  server: {
    port: 5173,
  },
});
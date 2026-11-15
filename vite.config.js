import { defineConfig } from 'vite';

// Automatic JSX runtime keeps components readable without a React default import.
// base: './' → build ke saare file paths relative banenge, taaki app
// GitHub Pages ke sub-folder (username.github.io/clientflow-crm/) mein bhi chale.
// server.proxy: dev mein "/api" calls backend server (npm run server, port 4000) par jaati hain.
export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic' },
  server: { proxy: { '/api': process.env.API_PROXY || 'http://localhost:4000' } },
});

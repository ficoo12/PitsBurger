import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served under /employee on Vercel (see vercel.json); dev and E2E use the
  // same path, so they behave like production.
  base: '/employee/',
  build: {
    // Vercel passes /employee/... paths to this service unchanged, so the
    // files must sit under dist/employee/ (the service's outputDirectory is dist).
    outDir: 'dist/employee',
  },
  server: {
    // The owner app uses 5173.
    port: 5174,
    strictPort: true,
    // App and API share one origin in development, so the session cookie needs
    // no CORS setup. The backend mounts its routes under /api too, so the path
    // is forwarded unchanged.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    // Component tests need a DOM. The setup file adds the jest-dom matchers
    // (toBeInTheDocument, …) and unmounts rendered components after each test.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The backend's CORS_ORIGIN and APP_URL (email links) point at this port.
    port: 5173,
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

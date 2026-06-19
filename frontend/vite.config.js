import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Auth always goes to backend
      '/auth': 'http://localhost:8000',

      // /family is both an API prefix AND SPA routes (e.g. /family/:id, /family/:id/search).
      // Browser navigations send Accept: text/html → bypass to SPA (prevents 405 on GET).
      // API fetch() calls send Accept: */* or application/json → proxy to backend.
      '/family': {
        target: 'http://localhost:8000',
        bypass: (req) => {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      },

      // /people is both API prefix and SPA routes (e.g. /people/:id, /people/:id/add-memory)
      '/people': {
        target: 'http://localhost:8000',
        bypass: (req) => {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      },

      // All other API prefixes — forward unconditionally
      '/memories': 'http://localhost:8000',
      '/upload': 'http://localhost:8000',
      '/user': 'http://localhost:8000',
      '/relationships': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/home': 'http://localhost:8000',
      '/graph': 'http://localhost:8000',
    },
  },
})

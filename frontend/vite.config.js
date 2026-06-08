import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/family': 'http://localhost:8000',
      '/people': 'http://localhost:8000',
      '/memories': 'http://localhost:8000',
      '/upload': 'http://localhost:8000',
      '/user': 'http://localhost:8000',
      '/relationships': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})

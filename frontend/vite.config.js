import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/sign_up': 'http://localhost:8000',
      '/login': 'http://localhost:8000',
      '/home': 'http://localhost:8000',
    },
  },
})

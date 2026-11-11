import react from '@vitejs/plugin-react'
 import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    proxy: {
      '/admin': 'http://localhost:8000',
      '/login': 'http://localhost:8000',
      '/logout': 'http://localhost:8000',
      '/me': 'http://localhost:8000',
      '/media': 'http://localhost:8000',
      '/photos': 'http://localhost:8000',
      '/upload': 'http://localhost:8000',
    },
  },
})


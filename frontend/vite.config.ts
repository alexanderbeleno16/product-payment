import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/products': 'http://localhost:3000',
      '/checkout': 'http://localhost:3000',
      '/checkouts': 'http://localhost:3000',
      '/transactions': 'http://localhost:3000',
    },
  },
})

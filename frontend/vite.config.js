import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    // allow any host to connect - use only for local testing
    allowedHosts: 'all',
    host: true
  }
})

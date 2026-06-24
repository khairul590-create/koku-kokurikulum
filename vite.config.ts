import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local dev: proxy /api to the Vercel dev server (run `vercel dev`) OR a local
// node api. For day-to-day local work we run `vercel dev` which serves both.
// When running plain `vite`, set VITE_API_PROXY to point at your api host.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: process.env.VITE_API_PROXY
      ? { '/api': { target: process.env.VITE_API_PROXY, changeOrigin: true } }
      : undefined,
  },
})

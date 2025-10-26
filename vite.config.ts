import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    // Proxy configuration for development to bypass CORS
    proxy: {
      '/api/token': {
        // Live API endpoints (AWS IVS) - proxy to localhost in development
        target: process.env.VITE_LIVE_API_URL || 'http://localhost:3005',
        changeOrigin: true,
        secure: false,
      },
      '/api/viewer': {
        // Live API endpoints (AWS IVS) - proxy to localhost in development
        target: process.env.VITE_LIVE_API_URL || 'http://localhost:3005',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        // Main API - default proxy
        target: 'https://api.bjr8888.com',
        changeOrigin: true,
        secure: false,
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // WebSocket proxy for Socket.IO
      '/socket.io': {
        target: 'https://api.bjr8888.com',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
      },
    },
    headers: {
      // Security headers
      'Content-Security-Policy':
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.line-scdn.net https://cdn.socket.io https://cdn.jsdelivr.net https://web-broadcast.live-video.net; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https: blob:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' wss: ws: https:; " +
        "media-src 'self' https: blob:; " +
        "frame-src 'self' https:;",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          socket: ['socket.io-client'],
        },
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/HerlevHjorten/' : '/',
  root: resolve(__dirname, '.'),
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  preview: {
    host: '127.0.0.1',
    port: 4173
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})

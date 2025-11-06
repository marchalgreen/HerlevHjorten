import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

// Plugin to ensure CSP includes Supabase URLs
const cspPlugin = (): Plugin => {
  return {
    name: 'csp-supabase',
    transformIndexHtml(html) {
      // Ensure CSP includes Supabase URLs - check if it's missing and add it
      if (html.includes('connect-src') && !html.includes('https://*.supabase.co')) {
        return html.replace(
          /(connect-src[^"]*)/,
          "$1 https://*.supabase.co"
        )
      }
      return html
    }
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/HerlevHjorten/' : '/'),
  root: resolve(__dirname, '.'),
  plugins: [react(), cspPlugin()],
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

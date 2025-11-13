import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'
import type { Plugin } from 'vite'

// Plugin to ensure CSP includes database URLs
const cspPlugin = (): Plugin => {
  return {
    name: 'csp-database',
    transformIndexHtml(html) {
      // Ensure CSP includes database URLs (Supabase and Neon)
      if (html.includes('connect-src')) {
        let updated = html
        if (!html.includes('https://*.supabase.co')) {
          updated = updated.replace(
            /(connect-src[^"]*)/,
            "$1 https://*.supabase.co"
          )
        }
        if (!html.includes('https://*.neon.tech')) {
          updated = updated.replace(
            /(connect-src[^"]*)/,
            "$1 https://*.neon.tech wss://*.neon.tech"
          )
        }
        return updated
      }
      return html
    }
  }
}

// Plugin to copy tenant config files to dist
const copyTenantConfigsPlugin = (): Plugin => {
  return {
    name: 'copy-tenant-configs',
    writeBundle() {
      const srcDir = resolve(__dirname, 'src/config/tenants')
      const destDir = resolve(__dirname, 'dist/config/tenants')
      
      try {
        // Create destination directory
        mkdirSync(destDir, { recursive: true })
        
        // Copy all JSON files from src/config/tenants to dist/config/tenants
        const files = readdirSync(srcDir)
        for (const file of files) {
          if (file.endsWith('.json')) {
            const srcPath = resolve(srcDir, file)
            const destPath = resolve(destDir, file)
            copyFileSync(srcPath, destPath)
            console.log(`✅ Copied tenant config: ${file}`)
          }
        }
      } catch (error) {
        console.warn('⚠️  Failed to copy tenant configs:', error)
      }
    }
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/HerlevHjorten/' : '/'),
  root: resolve(__dirname, '.'),
  plugins: [
    react(), 
    cspPlugin(), 
    copyTenantConfigsPlugin()
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
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

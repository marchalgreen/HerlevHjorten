import type { TenantConfig } from '@rundeklar/common'

/**
 * Extracts tenant ID from URL path.
 * @param pathname - Current pathname (e.g., "/demo/check-in" or "/check-in")
 * @returns Tenant ID or "herlev-hjorten" if no tenant in path
 * @example
 * extractTenantId("/demo/check-in") // "demo"
 * extractTenantId("/check-in") // "herlev-hjorten"
 */
export const extractTenantId = (pathname: string): string => {
  // Remove leading slash and split by "/"
  const parts = pathname.replace(/^\/+/, '').split('/')
  
  // First part is tenant ID if it exists and is not a known route
  const knownRoutes = ['coach', 'check-in', 'match-program', 'players', 'statistics', 'admin']
  const firstPart = parts[0]
  
  // If first part is a known route, it's the herlev-hjorten tenant
  if (knownRoutes.includes(firstPart)) {
    return 'herlev-hjorten'
  }
  
  // Otherwise, first part is the tenant ID
  return firstPart || 'herlev-hjorten'
}

/**
 * Loads tenant configuration from config file.
 * Falls back to environment variables if postgresUrl is not set in config.
 * @param tenantId - Tenant ID to load config for
 * @returns Tenant configuration
 * @throws Error if tenant config not found
 */
export const loadTenantConfig = async (tenantId: string): Promise<TenantConfig> => {
  try {
    // In development, use dynamic import
    // In production, config files are copied to dist
    const config = await import(`../config/tenants/${tenantId}.json`)
    const tenantConfig = config.default as TenantConfig
    
    // If postgresUrl is not set in config, try to get it from environment variables
    if (!tenantConfig.postgresUrl) {
      // Check both import.meta.env (Vite) and process.env (Node.js scripts)
      // Vite exposes env vars prefixed with VITE_ to client code
      const viteEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}
      const nodeEnv = typeof process !== 'undefined' && process.env ? process.env : {}
      
      const dbUrl = (viteEnv as any).VITE_DATABASE_URL || 
                    (viteEnv as any).DATABASE_URL ||
                    (viteEnv as any).VITE_DATABASE_URL_UNPOOLED ||
                    (viteEnv as any).DATABASE_URL_UNPOOLED ||
                    nodeEnv.DATABASE_URL ||
                    nodeEnv.VITE_DATABASE_URL ||
                    nodeEnv.DATABASE_URL_UNPOOLED ||
                    nodeEnv.VITE_DATABASE_URL_UNPOOLED
      
      if (dbUrl) {
        console.log(`Using DATABASE_URL from environment variables for tenant "${tenantId}"`)
        return {
          ...tenantConfig,
          postgresUrl: dbUrl
        }
      }
    }
    
    return tenantConfig
  } catch (error) {
    // Fallback to herlev-hjorten if tenant not found
    if (tenantId !== 'herlev-hjorten') {
      console.warn(`Tenant config not found for "${tenantId}", falling back to herlev-hjorten`)
      return loadTenantConfig('herlev-hjorten')
    }
    throw new Error(`Failed to load tenant config for "${tenantId}": ${error}`)
  }
}

/**
 * Gets tenant ID from current location.
 * Prioritizes subdomain detection over path-based detection.
 * @returns Tenant ID
 */
export const getCurrentTenantId = (): string => {
  if (typeof window === 'undefined') {
    return 'herlev-hjorten' // Fallback for SSR
  }
  
  const hostname = window.location.hostname.toLowerCase()
  
  // 1. Demo subdomain: demo.rundeklar.dk → demo
  if (hostname === 'demo.rundeklar.dk') {
    return 'demo'
  }
  
  // 2. Tenant subdomain: herlev-hjorten.rundeklar.dk → herlev-hjorten
  if (hostname.endsWith('.rundeklar.dk')) {
    const subdomain = hostname.replace('.rundeklar.dk', '')
    if (subdomain && subdomain !== 'www' && subdomain !== 'demo') {
      return subdomain // e.g., herlev-hjorten
    }
  }
  
  // 3. Marketing site (rundeklar.dk) - returner 'marketing' eller håndter særskilt
  if (hostname === 'rundeklar.dk' || hostname === 'www.rundeklar.dk') {
    return 'marketing' // Eller håndter særskilt
  }
  
  // 4. Fallback (development/localhost) - use herlev-hjorten instead of default
  // For HashRouter, pathname is like "/#/demo/check-in" or "/#/check-in"
  // For BrowserRouter, pathname is like "/demo/check-in" or "/check-in"
  const pathname = window.location.pathname
  const hash = window.location.hash
  
  // Extract path from hash if using HashRouter
  const actualPath = hash ? hash.replace(/^#/, '') : pathname
  
  const pathTenantId = extractTenantId(actualPath)
  
  // Map 'default' to 'herlev-hjorten' for backward compatibility
  return pathTenantId === 'default' ? 'herlev-hjorten' : pathTenantId
}

/**
 * Builds a tenant-aware path.
 * @param tenantId - Tenant ID
 * @param path - Route path (e.g., "/check-in")
 * @returns Full path with tenant prefix (e.g., "/demo/check-in" or "/check-in" for herlev-hjorten)
 */
export const buildTenantPath = (tenantId: string, path: string): string => {
  // Remove leading slash from path
  const cleanPath = path.replace(/^\/+/, '')
  
  // For herlev-hjorten tenant (main tenant), don't add prefix
  if (tenantId === 'herlev-hjorten' || tenantId === 'default') {
    return `/${cleanPath}`
  }
  
  // For other tenants, add tenant prefix
  return `/${tenantId}/${cleanPath}`
}


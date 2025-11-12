import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { TenantConfig } from '@herlev-hjorten/common'

/**
 * Cache of Supabase clients by tenant ID to avoid creating duplicate instances.
 */
const clientCache = new Map<string, SupabaseClient>()

/**
 * Creates a Supabase client for a specific tenant.
 * Caches clients by tenant ID to avoid creating duplicate instances.
 * @param config - Tenant configuration containing Supabase credentials
 * @returns Supabase client instance
 */
export const createTenantSupabaseClient = (config: TenantConfig): SupabaseClient => {
  // Skip creating client for placeholder/loading state
  if (config.id === 'loading' || config.supabaseUrl === 'https://placeholder.supabase.co') {
    // Return a cached placeholder or create one if needed
    if (!clientCache.has('loading')) {
      // Create a minimal client that won't actually be used
      const placeholderClient = createClient('https://placeholder.supabase.co', 'placeholder-key')
      clientCache.set('loading', placeholderClient)
    }
    return clientCache.get('loading')!
  }

  // Check cache first
  if (clientCache.has(config.id)) {
    return clientCache.get(config.id)!
  }

  if (!config.supabaseUrl || !config.supabaseKey) {
    console.error('Missing Supabase credentials in tenant config:', {
      tenantId: config.id,
      url: config.supabaseUrl ? '✓ Set' : '✗ Missing',
      key: config.supabaseKey ? '✓ Set' : '✗ Missing'
    })
    throw new Error(
      `Missing Supabase credentials for tenant "${config.id}". Please configure supabaseUrl and supabaseKey in the tenant config file.`
    )
  }

  // Log connection info in development (only for real tenants)
  if (import.meta.env.DEV) {
    console.log(`Supabase client initialized for tenant "${config.id}":`, {
      url: config.supabaseUrl,
      keyPrefix: config.supabaseKey?.substring(0, 20) + '...'
    })
  }

  const client = createClient(config.supabaseUrl, config.supabaseKey)
  clientCache.set(config.id, client)
  return client
}

/**
 * Current tenant Supabase client (updated by TenantProvider).
 * This is a module-level variable that gets updated when tenant context is initialized.
 */
let currentTenantSupabaseClient: SupabaseClient | null = null

/**
 * Sets the current tenant Supabase client.
 * @param client - Supabase client to set
 * @internal Used by TenantProvider
 */
export const setCurrentTenantSupabaseClient = (client: SupabaseClient | null) => {
  currentTenantSupabaseClient = client
}

/**
 * Gets the current tenant Supabase client.
 * @returns Current tenant Supabase client
 * @throws Error if no tenant client is set
 */
export const getCurrentTenantSupabaseClient = (): SupabaseClient => {
  if (!currentTenantSupabaseClient) {
    throw new Error('No tenant Supabase client available. Make sure TenantProvider is initialized.')
  }
  return currentTenantSupabaseClient
}

/**
 * Current tenant config (updated by TenantProvider).
 * This is a module-level variable that gets updated when tenant context is initialized.
 */
let currentTenantConfig: TenantConfig | null = null

/**
 * Sets the current tenant config.
 * @param config - Tenant config to set
 * @internal Used by TenantProvider
 */
export const setCurrentTenantConfig = (config: TenantConfig | null) => {
  currentTenantConfig = config
}

/**
 * Gets the current tenant config.
 * @returns Current tenant config
 * @throws Error if no tenant config is set
 */
export const getCurrentTenantConfig = (): TenantConfig => {
  if (!currentTenantConfig) {
    throw new Error('No tenant config available. Make sure TenantProvider is initialized.')
  }
  return currentTenantConfig
}

/**
 * Legacy Supabase client for backward compatibility.
 * @deprecated Use createTenantSupabaseClient with tenant config instead.
 * This will be removed in a future version.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let legacySupabase: SupabaseClient | null = null

if (supabaseUrl && supabaseAnonKey) {
  legacySupabase = createClient(supabaseUrl, supabaseAnonKey)
  
  if (import.meta.env.DEV) {
    console.log('Legacy Supabase client initialized (from env vars):', {
    url: supabaseUrl,
    keyPrefix: supabaseAnonKey?.substring(0, 20) + '...'
  })
}
}

/**
 * Legacy Supabase client export.
 * @deprecated Use TenantContext to get tenant-aware Supabase client instead.
 */
export const supabase = legacySupabase

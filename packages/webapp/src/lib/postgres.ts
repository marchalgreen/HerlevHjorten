// Note: postgres.js doesn't work in browsers - it's Node.js only
// We use an API proxy approach: browser calls Vercel API routes, which use postgres.js
// This type is just for compatibility - actual queries go through API routes
import type { TenantConfig } from '@herlev-hjorten/common'

export type PostgresClient = {
  // Placeholder type - actual implementation is in api/postgres.ts
  [key: string]: any
}

/**
 * Cache of Postgres clients by tenant ID to avoid creating duplicate instances.
 */
const clientCache = new Map<string, PostgresClient>()

/**
 * Creates a Postgres client for a specific tenant.
 * Caches clients by tenant ID to avoid creating duplicate instances.
 * @param config - Tenant configuration containing Postgres connection string
 * @returns Postgres client instance
 */
export const createTenantPostgresClient = (config: TenantConfig): PostgresClient => {
  // Reject placeholder/loading state
  if (config.id === 'loading') {
    throw new Error('Cannot create Postgres client for loading/placeholder state')
  }

  // Check cache first
  if (clientCache.has(config.id)) {
    return clientCache.get(config.id)!
  }

  // Log connection info in development
  if (import.meta.env.DEV) {
    console.log(`Postgres client proxy initialized for tenant "${config.id}"`)
    console.log('Note: Actual queries are proxied through Vercel API routes to Neon database')
  }

  // Return a placeholder client object
  // Actual queries are handled by api/postgres.ts which calls the API route
  const client = {} as PostgresClient

  clientCache.set(config.id, client)
  return client
}

/**
 * Current tenant Postgres client (updated by TenantProvider).
 * This is a module-level variable that gets updated when tenant context is initialized.
 */
let currentTenantPostgresClient: PostgresClient | null = null

/**
 * Sets the current tenant Postgres client.
 * @param client - Postgres client to set
 * @internal Used by TenantProvider
 */
export const setCurrentTenantPostgresClient = (client: PostgresClient | null) => {
  currentTenantPostgresClient = client
}

/**
 * Gets the current tenant Postgres client.
 * @returns Current tenant Postgres client
 * @throws Error if no tenant client is set
 */
export const getCurrentTenantPostgresClient = (): PostgresClient => {
  if (!currentTenantPostgresClient) {
    throw new Error('No tenant Postgres client available. Make sure TenantProvider is initialized.')
  }
  return currentTenantPostgresClient
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


import { readdir, readFile, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { TenantConfig } from '@rundeklar/common'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Convert tenant name to valid subdomain
 * @param name - Tenant name (e.g., "Herlev Hjorten")
 * @returns Valid subdomain (e.g., "herlev-hjorten")
 */
export function nameToSubdomain(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

/**
 * Validate subdomain format
 * @param subdomain - Subdomain to validate
 * @returns Object with isValid and errors
 */
export function validateSubdomain(subdomain: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!subdomain || subdomain.length === 0) {
    errors.push('Subdomain is required')
  }

  if (subdomain.length < 3) {
    errors.push('Subdomain must be at least 3 characters')
  }

  if (subdomain.length > 63) {
    errors.push('Subdomain must be less than 63 characters')
  }

  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    errors.push('Subdomain can only contain lowercase letters, numbers, and hyphens')
  }

  if (subdomain.startsWith('-') || subdomain.endsWith('-')) {
    errors.push('Subdomain cannot start or end with a hyphen')
  }

  // Reserved subdomains
  const reserved = ['www', 'demo', 'api', 'admin', 'mail', 'ftp', 'localhost', 'marketing']
  if (reserved.includes(subdomain)) {
    errors.push(`Subdomain "${subdomain}" is reserved`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Check if subdomain is available (not already used)
 * @param subdomain - Subdomain to check
 * @returns True if available
 */
export async function isSubdomainAvailable(subdomain: string): Promise<boolean> {
  try {
    const tenantsDir = join(process.cwd(), 'packages/webapp/src/config/tenants')
    const files = await readdir(tenantsDir)
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const tenantId = file.replace('.json', '')
        if (tenantId === subdomain) {
          return false
        }
        
        // Also check subdomain field in config
        try {
          const configPath = join(tenantsDir, file)
          const configContent = await readFile(configPath, 'utf-8')
          const config = JSON.parse(configContent) as TenantConfig & { subdomain?: string }
          if (config.subdomain && config.subdomain === subdomain) {
            return false
          }
        } catch {
          // Ignore errors reading config
        }
      }
    }
    
    return true
  } catch {
    // If we can't check, assume available (will fail later during creation)
    return true
  }
}

/**
 * Create tenant config file
 * @param tenantData - Tenant configuration data
 * @returns Created tenant config
 */
export async function createTenantConfig(tenantData: {
  id: string
  name: string
  subdomain: string
  logo?: string
  maxCourts?: number
  features?: Record<string, any>
  postgresUrl?: string
}): Promise<TenantConfig> {
  const config: TenantConfig = {
    id: tenantData.id,
    name: tenantData.name,
    subdomain: tenantData.subdomain,
    logo: tenantData.logo || 'fulllogo_transparent_nobuffer_horizontal.png',
    maxCourts: tenantData.maxCourts || 8,
    features: tenantData.features || {},
    ...(tenantData.postgresUrl && { postgresUrl: tenantData.postgresUrl })
  }

  // Write config file
  const configPath = join(
    process.cwd(),
    'packages/webapp/src/config/tenants',
    `${tenantData.id}.json`
  )
  
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
  
  return config
}

/**
 * Get all tenant configs
 * @returns Array of tenant configs
 */
export async function getAllTenantConfigs(): Promise<TenantConfig[]> {
  try {
    // Try multiple possible paths for tenant configs directory
    const possiblePaths = [
      join(process.cwd(), 'packages/webapp/src/config/tenants'),
      join(process.cwd(), 'src/config/tenants'),
      join(__dirname, '../../config/tenants'),
      join(__dirname, '../../../config/tenants')
    ]
    
    let tenantsDir: string | null = null
    for (const path of possiblePaths) {
      try {
        await readdir(path)
        tenantsDir = path
        break
      } catch {
        // Try next path
      }
    }
    
    if (!tenantsDir) {
      console.warn('Tenant configs directory not found. Tried:', possiblePaths)
      return []
    }
    
    const files = await readdir(tenantsDir)
    const configs: TenantConfig[] = []
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const configPath = join(tenantsDir, file)
          const configContent = await readFile(configPath, 'utf-8')
          const config = JSON.parse(configContent) as TenantConfig
          configs.push(config)
        } catch (error) {
          console.warn(`Failed to read tenant config ${file}:`, error)
          // Ignore errors reading config
        }
      }
    }
    
    return configs
  } catch (error) {
    console.error('Failed to get tenant configs:', error)
    return []
  }
}

/**
 * Get tenant config by ID
 * @param tenantId - Tenant ID
 * @returns Tenant config or null
 */
export async function getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
  try {
    // Try multiple possible paths for tenant configs directory
    const possiblePaths = [
      join(process.cwd(), 'packages/webapp/src/config/tenants'),
      join(process.cwd(), 'src/config/tenants'),
      join(__dirname, '../../config/tenants'),
      join(__dirname, '../../../config/tenants')
    ]
    
    for (const basePath of possiblePaths) {
      try {
        const configPath = join(basePath, `${tenantId}.json`)
        const configContent = await readFile(configPath, 'utf-8')
        return JSON.parse(configContent) as TenantConfig
      } catch {
        // Try next path
        continue
      }
    }
    
    return null
  } catch (error) {
    console.error(`Failed to get tenant config for ${tenantId}:`, error)
    return null
  }
}


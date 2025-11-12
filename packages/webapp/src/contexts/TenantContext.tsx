import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import type { TenantConfig } from '@herlev-hjorten/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadTenantConfig, getCurrentTenantId, buildTenantPath } from '../lib/tenant'
import { createTenantSupabaseClient, setCurrentTenantSupabaseClient, setCurrentTenantConfig } from '../lib/supabase'

interface TenantContextValue {
  tenantId: string
  config: TenantConfig
  supabase: SupabaseClient // Non-null when context is provided (guarded by null check)
  buildPath: (path: string) => string
}

const TenantContext = createContext<TenantContextValue | null>(null)

interface TenantProviderProps {
  tenantId: string
  children: React.ReactNode
}

/**
 * Tenant context provider that supplies tenant configuration and Supabase client.
 * @remarks Loads tenant config and creates tenant-specific Supabase client.
 */
export const TenantProvider: React.FC<TenantProviderProps> = ({ tenantId, children }) => {
  const [config, setConfig] = useState<TenantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadConfig = async () => {
      try {
        setLoading(true)
        setError(null)
        const tenantConfig = await loadTenantConfig(tenantId)
        
        if (!cancelled) {
          setConfig(tenantConfig)
        }
      } catch (err) {
        if (!cancelled) {
          console.error(`Failed to load tenant config for "${tenantId}":`, err)
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadConfig()

    return () => {
      cancelled = true
    }
  }, [tenantId])

  const supabase = useMemo(() => {
    if (!config) {
      // Don't create a client during loading - return null and handle in render
      // The loading state will prevent children from rendering anyway
      return null
    }
    const client = createTenantSupabaseClient(config)
    // Update module-level client and config for API access
    setCurrentTenantSupabaseClient(client)
    setCurrentTenantConfig(config)
    return client
  }, [config])

  // Clean up module-level client and config when component unmounts
  useEffect(() => {
    return () => {
      setCurrentTenantSupabaseClient(null)
      setCurrentTenantConfig(null)
    }
  }, [])

  const buildPath = useMemo(() => {
    return (path: string) => buildTenantPath(tenantId, path)
  }, [tenantId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-[hsl(var(--foreground))]">Loading tenant configuration...</p>
        </div>
      </div>
    )
  }

  if (error || !config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-red-500">Failed to load tenant configuration</p>
          <p className="text-sm text-[hsl(var(--muted))] mt-2">{error || 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  // Ensure supabase client is available before providing context
  if (!supabase) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-[hsl(var(--foreground))]">Loading tenant configuration...</p>
        </div>
      </div>
    )
  }

  const value: TenantContextValue = {
    tenantId,
    config,
    supabase,
    buildPath
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

/**
 * Hook to access tenant context.
 * @returns Tenant context value
 * @throws Error if used outside TenantProvider
 */
export const useTenant = (): TenantContextValue => {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider')
  }
  return context
}


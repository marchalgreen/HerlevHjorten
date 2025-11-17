import React, { useState, useEffect } from 'react'
import { PageCard } from '../../components/ui'
import { Button } from '../../components/ui'
import TenantDetailsPage from './TenantDetails'

interface Tenant {
  id: string
  name: string
  subdomain: string
  userCount: number
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)

  useEffect(() => {
    fetchTenants()
  }, [])

  const fetchTenants = async () => {
    try {
      const token = localStorage.getItem('auth_access_token')
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/admin/tenants'
        : '/api/admin/tenants'
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch tenants')
      }

      const data = await response.json()
      setTenants(data.tenants || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }

  if (selectedTenantId) {
    return (
      <TenantDetailsPage
        tenantId={selectedTenantId}
        onClose={() => setSelectedTenantId(null)}
      />
    )
  }

  if (loading) {
    return (
      <PageCard>
        <p>Indlæser tenants...</p>
      </PageCard>
    )
  }

  return (
    <PageCard>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Tenants</h2>
        <Button onClick={() => {/* TODO: Open create tenant modal */}}>
          Opret Tenant
        </Button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {tenants.length === 0 ? (
          <p className="text-[hsl(var(--muted))]">Ingen tenants fundet.</p>
        ) : (
          tenants.map((tenant) => (
            <div
              key={tenant.id}
              className="p-4 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))] hover:bg-[hsl(var(--surface-2))] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{tenant.name}</h3>
                  <p className="text-sm text-[hsl(var(--muted))]">
                    {tenant.subdomain}.rundeklar.dk • {tenant.userCount} brugere
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setSelectedTenantId(tenant.id)}
                  >
                    Detaljer
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </PageCard>
  )
}


import React, { useState, useEffect } from 'react'
import { PageCard } from '../../components/ui'
import { Button } from '../../components/ui'

interface TenantDetails {
  id: string
  name: string
  subdomain: string
  logo?: string
  maxCourts?: number
  features?: Record<string, any>
  userCount: number
}

interface Admin {
  id: string
  email: string
  role: string
  emailVerified: boolean
  createdAt: string
  lastLogin?: string
}

interface TenantDetailsPageProps {
  tenantId: string
  onClose: () => void
}

export default function TenantDetailsPage({ tenantId, onClose }: TenantDetailsPageProps) {
  const [tenant, setTenant] = useState<TenantDetails | null>(null)
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'admins'>('details')

  useEffect(() => {
    fetchTenantDetails()
    fetchAdmins()
  }, [tenantId])

  const fetchTenantDetails = async () => {
    try {
      const token = localStorage.getItem('auth_access_token')
      const apiUrl = import.meta.env.DEV 
        ? `http://127.0.0.1:3000/api/admin/tenants/${tenantId}`
        : `/api/admin/tenants/${tenantId}`
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch tenant details')
      }

      const data = await response.json()
      setTenant(data.tenant)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant details')
    } finally {
      setLoading(false)
    }
  }

  const fetchAdmins = async () => {
    try {
      const token = localStorage.getItem('auth_access_token')
      const apiUrl = import.meta.env.DEV 
        ? `http://127.0.0.1:3000/api/admin/tenants/${tenantId}/admins`
        : `/api/admin/tenants/${tenantId}/admins`
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setAdmins(data.admins || [])
      }
    } catch (err) {
      console.error('Failed to fetch admins:', err)
    }
  }

  const handleDeleteTenant = async () => {
    if (!confirm(`Er du sikker på, at du vil slette tenant "${tenant?.name}"? Dette vil markere tenanten som slettet, men data vil blive bevaret.`)) {
      return
    }

    try {
      const token = localStorage.getItem('auth_access_token')
      const apiUrl = import.meta.env.DEV 
        ? `http://127.0.0.1:3000/api/admin/tenants/${tenantId}`
        : `/api/admin/tenants/${tenantId}`
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete tenant')
      }

      alert('Tenant slettet')
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete tenant')
    }
  }

  if (loading) {
    return (
      <PageCard>
        <p>Indlæser tenant detaljer...</p>
      </PageCard>
    )
  }

  if (error || !tenant) {
    return (
      <PageCard>
        <div className="mb-4">
          <Button variant="secondary" onClick={onClose}>
            ← Tilbage
          </Button>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error || 'Tenant ikke fundet'}</p>
        </div>
      </PageCard>
    )
  }

  return (
    <PageCard>
      <div className="mb-6">
        <Button variant="secondary" onClick={onClose} className="mb-4">
          ← Tilbage til tenants
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{tenant.name}</h2>
            <p className="text-sm text-[hsl(var(--muted))]">
              {tenant.subdomain}.rundeklar.dk
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => {/* TODO: Open edit modal */}}>
              Rediger
            </Button>
            <Button variant="secondary" onClick={handleDeleteTenant}>
              Slet
            </Button>
          </div>
        </div>
      </div>

      <div className="border-b border-[hsl(var(--line))] mb-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                : 'border-transparent text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            Detaljer
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'admins'
                ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                : 'border-transparent text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            Administratorer ({admins.length})
          </button>
        </div>
      </div>

      {activeTab === 'details' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-[hsl(var(--muted))] mb-1">Navn</h3>
              <p className="text-lg">{tenant.name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[hsl(var(--muted))] mb-1">Subdomain</h3>
              <p className="text-lg">{tenant.subdomain}.rundeklar.dk</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[hsl(var(--muted))] mb-1">Antal brugere</h3>
              <p className="text-lg">{tenant.userCount}</p>
            </div>
            {tenant.maxCourts && (
              <div>
                <h3 className="text-sm font-medium text-[hsl(var(--muted))] mb-1">Max baner</h3>
                <p className="text-lg">{tenant.maxCourts}</p>
              </div>
            )}
            {tenant.logo && (
              <div>
                <h3 className="text-sm font-medium text-[hsl(var(--muted))] mb-1">Logo</h3>
                <p className="text-lg">{tenant.logo}</p>
              </div>
            )}
          </div>

          {tenant.features && Object.keys(tenant.features).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[hsl(var(--muted))] mb-2">Features</h3>
              <div className="bg-[hsl(var(--surface-2))] p-4 rounded-md">
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(tenant.features, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'admins' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Administratorer</h3>
            <Button variant="secondary" onClick={() => {/* TODO: Open create admin modal */}}>
              Opret Administrator
            </Button>
          </div>

          {admins.length === 0 ? (
            <p className="text-[hsl(var(--muted))]">Ingen administratorer fundet.</p>
          ) : (
            <div className="space-y-2">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="p-4 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{admin.email}</p>
                      <p className="text-sm text-[hsl(var(--muted))]">
                        {admin.role} • {admin.emailVerified ? 'Email verificeret' : 'Email ikke verificeret'}
                      </p>
                      {admin.lastLogin && (
                        <p className="text-xs text-[hsl(var(--muted))] mt-1">
                          Sidst aktiv: {new Date(admin.lastLogin).toLocaleString('da-DK')}
                        </p>
                      )}
                    </div>
                    <Button variant="secondary" size="sm">
                      Rediger
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PageCard>
  )
}


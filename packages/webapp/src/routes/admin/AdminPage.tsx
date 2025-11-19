import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { UserRole } from '../../lib/auth/roles'
import TenantsPage from './Tenants'
import CoachesPage from '../[tenantId]/admin/Coaches'
import AnalyticsPage from './Analytics'
import { PageCard } from '../../components/ui'
import { Building2, Users, BarChart3 } from 'lucide-react'

type AdminTab = 'tenants' | 'coaches' | 'analytics'

export default function AdminPage() {
  const { club } = useAuth()
  const clubRole = (club as any)?.role as string | undefined
  const isSuperAdmin = clubRole === UserRole.SYSADMIN || clubRole === 'sysadmin' || clubRole === 'super_admin' // Backward compatibility
  const [activeTab, setActiveTab] = useState<AdminTab>(isSuperAdmin ? 'analytics' : 'coaches')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Administration</h1>
        {isSuperAdmin && (
          <div className="flex gap-1 p-1 bg-[hsl(var(--surface-2)/.5)] rounded-lg ring-1 ring-[hsl(var(--line)/.12)]">
            <button
              type="button"
              onClick={() => setActiveTab('tenants')}
              className={`
                flex-1 px-4 py-2.5 text-sm font-medium rounded-md
                transition-all duration-200 ease-out
                flex items-center justify-center gap-2
                ${
                  activeTab === 'tenants'
                    ? 'bg-[hsl(var(--surface))] text-[hsl(var(--foreground))] shadow-sm ring-1 ring-[hsl(var(--line)/.2)]'
                    : 'text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2)/.3)]'
                }
              `}
            >
              <Building2 className="w-4 h-4" />
              <span>Tenants</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`
                flex-1 px-4 py-2.5 text-sm font-medium rounded-md
                transition-all duration-200 ease-out
                flex items-center justify-center gap-2
                ${
                  activeTab === 'analytics'
                    ? 'bg-[hsl(var(--surface))] text-[hsl(var(--foreground))] shadow-sm ring-1 ring-[hsl(var(--line)/.2)]'
                    : 'text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2)/.3)]'
                }
              `}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('coaches')}
              className={`
                flex-1 px-4 py-2.5 text-sm font-medium rounded-md
                transition-all duration-200 ease-out
                flex items-center justify-center gap-2
                ${
                  activeTab === 'coaches'
                    ? 'bg-[hsl(var(--surface))] text-[hsl(var(--foreground))] shadow-sm ring-1 ring-[hsl(var(--line)/.2)]'
                    : 'text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2)/.3)]'
                }
              `}
            >
              <Users className="w-4 h-4" />
              <span>Trænere</span>
            </button>
          </div>
        )}
      </div>

      {isSuperAdmin && activeTab === 'tenants' && <TenantsPage />}
      {isSuperAdmin && activeTab === 'analytics' && <AnalyticsPage />}
      {activeTab === 'coaches' && <CoachesPage />}
      
      {!isSuperAdmin && (
        <PageCard>
          <p className="text-[hsl(var(--muted))]">
            Du har adgang til træner-administration. Brug fanen ovenfor for at skifte.
          </p>
        </PageCard>
      )}
    </div>
  )
}


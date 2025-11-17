import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { UserRole } from '../../lib/auth/roles'
import TenantsPage from './Tenants'
import CoachesPage from '../[tenantId]/admin/Coaches'
import { PageCard } from '../../components/ui'
import { Button } from '../../components/ui'

type AdminTab = 'tenants' | 'coaches'

export default function AdminPage() {
  const { club } = useAuth()
  const clubRole = (club as any)?.role as string | undefined
  const isSuperAdmin = clubRole === UserRole.SUPER_ADMIN || clubRole === 'super_admin'
  const [activeTab, setActiveTab] = useState<AdminTab>(isSuperAdmin ? 'tenants' : 'coaches')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Administration</h1>
        {isSuperAdmin && (
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'tenants' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('tenants')}
            >
              Tenants
            </Button>
            <Button
              variant={activeTab === 'coaches' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('coaches')}
            >
              Trænere
            </Button>
          </div>
        )}
      </div>

      {isSuperAdmin && activeTab === 'tenants' && <TenantsPage />}
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


import React, { useState, useEffect } from 'react'
import { useTenant } from '../../../contexts/TenantContext'
import { PageCard } from '../../../components/ui'
import { Button } from '../../../components/ui'
import CreateCoachForm from '../../../components/admin/CreateCoachForm'

interface Coach {
  id: string
  email: string
  username: string
  role: string
  emailVerified: boolean
  createdAt: string
  lastLogin: string | null
}

export default function CoachesPage() {
  const { tenantId } = useTenant()
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    fetchCoaches()
  }, [tenantId])

  const fetchCoaches = async () => {
    try {
      const token = localStorage.getItem('auth_access_token')
      const apiUrl = import.meta.env.DEV 
        ? `http://127.0.0.1:3000/api/${tenantId}/admin/coaches`
        : `/api/${tenantId}/admin/coaches`
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch coaches')
      }

      const data = await response.json()
      setCoaches(data.coaches || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coaches')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCoach = async (coachId: string) => {
    if (!confirm('Er du sikker på, at du vil slette denne træner?')) {
      return
    }

    try {
      const token = localStorage.getItem('auth_access_token')
      const apiUrl = import.meta.env.DEV 
        ? `http://127.0.0.1:3000/api/${tenantId}/admin/coaches/${coachId}`
        : `/api/${tenantId}/admin/coaches/${coachId}`
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete coach')
      }

      await fetchCoaches()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete coach')
    }
  }

  const handleResetPIN = async (coachId: string) => {
    try {
      const token = localStorage.getItem('auth_access_token')
      const apiUrl = import.meta.env.DEV 
        ? `http://127.0.0.1:3000/api/${tenantId}/admin/coaches/${coachId}`
        : `/api/${tenantId}/admin/coaches/${coachId}`
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'reset-pin' })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reset PIN')
      }

      alert('PIN reset email sent successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset PIN')
    }
  }

  if (loading) {
    return (
      <PageCard>
        <p>Indlæser trænere...</p>
      </PageCard>
    )
  }

  return (
      <PageCard>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Trænere</h1>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Annuller' : 'Opret træner'}
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {showCreateForm && (
          <div className="mb-6">
            <CreateCoachForm
              onSuccess={() => {
                setShowCreateForm(false)
                fetchCoaches()
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}

        <div className="space-y-4">
          {coaches.length === 0 ? (
            <p className="text-[hsl(var(--muted))]">Ingen trænere fundet.</p>
          ) : (
            coaches.map((coach) => (
              <div
                key={coach.id}
                className="p-4 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{coach.username}</h3>
                    <p className="text-sm text-[hsl(var(--muted))]">{coach.email}</p>
                    {coach.lastLogin && (
                      <p className="text-xs text-[hsl(var(--muted))]">
                        Sidst aktiv: {new Date(coach.lastLogin).toLocaleDateString('da-DK')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleResetPIN(coach.id)}
                    >
                      Nulstil PIN
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDeleteCoach(coach.id)}
                    >
                      Slet
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


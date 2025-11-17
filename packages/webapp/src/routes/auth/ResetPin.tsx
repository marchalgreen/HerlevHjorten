import React, { useState, useEffect } from 'react'
import { useNavigation } from '../../contexts/NavigationContext'
import { getCurrentTenantId } from '../../lib/tenant'
import { Button } from '../../components/ui'
import { PageCard } from '../../components/ui'

export default function ResetPinPage() {
  const { navigateToAuth } = useNavigation()
  const [token, setToken] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string>('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Extract token and tenantId from URL
    // URL format: /#/${tenantId}/reset-pin?token=...
    const hash = window.location.hash.replace(/^#/, '')
    
    // Split hash into path and query string
    const [pathPart, queryPart] = hash.split('?')
    const parts = pathPart.split('/')
    
    // Find tenantId (should be before 'reset-pin')
    const resetPinIndex = parts.findIndex(part => part === 'reset-pin')
    if (resetPinIndex > 0) {
      setTenantId(parts[resetPinIndex - 1])
    } else {
      // Fallback to current tenant
      setTenantId(getCurrentTenantId())
    }
    
    // Extract token from query params in hash
    if (queryPart) {
      const params = new URLSearchParams(queryPart)
      const tokenParam = params.get('token')
      setToken(tokenParam)
      
      if (!tokenParam) {
        setError('Ingen nulstillings-token fundet')
      }
    } else {
      setError('Ingen nulstillings-token fundet')
    }
  }, [])

  const validatePIN = (pinValue: string): string[] => {
    const errors: string[] = []
    if (!/^\d+$/.test(pinValue)) {
      errors.push('PIN skal kun indeholde tal')
    }
    if (pinValue.length !== 6) {
      errors.push('PIN skal være præcis 6 cifre')
    }
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Ingen nulstillings-token fundet')
      return
    }

    if (!tenantId) {
      setError('Ingen tenant ID fundet')
      return
    }

    if (pin !== confirmPin) {
      setError('PIN-koderne matcher ikke')
      return
    }

    const errors = validatePIN(pin)
    if (errors.length > 0) {
      setError(errors.join(', '))
      return
    }

    setLoading(true)

    try {
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/auth/reset-pin?action=reset'
        : '/api/auth/reset-pin?action=reset'

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          pin,
          tenantId
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          navigateToAuth('login')
        }, 3000)
      } else {
        setError(data.error || 'Nulstilling fejlede')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nulstilling fejlede')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <PageCard className="w-full max-w-md">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-4 text-green-600 dark:text-green-400">
              PIN nulstillet!
            </h1>
            <p className="text-[hsl(var(--muted))] mb-4">
              Din PIN er blevet nulstillet. Du kan nu logge ind med din nye PIN.
            </p>
            <p className="text-sm text-[hsl(var(--muted))]">
              Omdirigerer til login...
            </p>
          </div>
        </PageCard>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <PageCard className="w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-6 text-center">Nulstil PIN</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pin" className="block text-sm font-medium mb-1">
              Ny PIN (6 cifre)
            </label>
            <input
              id="pin"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '') // Only allow digits
                setPin(value)
              }}
              required
              className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] text-center text-2xl tracking-widest"
              disabled={loading}
              placeholder="000000"
            />
            {pin && validatePIN(pin).length > 0 && (
              <ul className="mt-1 text-xs text-[hsl(var(--muted))] list-disc list-inside">
                {validatePIN(pin).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="confirmPin" className="block text-sm font-medium mb-1">
              Bekræft PIN
            </label>
            <input
              id="confirmPin"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '') // Only allow digits
                setConfirmPin(value)
              }}
              required
              className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] text-center text-2xl tracking-widest"
              disabled={loading}
              placeholder="000000"
            />
            {confirmPin && pin !== confirmPin && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                PIN-koderne matcher ikke
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Nulstil PIN
          </Button>
        </form>
      </PageCard>
    </div>
  )
}


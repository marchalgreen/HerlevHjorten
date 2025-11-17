import React, { useState, useEffect, useRef } from 'react'
import { useNavigation } from '../../contexts/NavigationContext'
import { getCurrentTenantId } from '../../lib/tenant'
import { Button, PINInput } from '../../components/ui'
import type { PINInputRef } from '../../components/auth/PINInput'
import { PageCard } from '../../components/ui'
import { User, Lock } from 'lucide-react'

export default function ResetPinPage() {
  const { navigateToAuth } = useNavigation()
  const [token, setToken] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string>('')
  const [username, setUsername] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const pinInputRef = useRef<PINInputRef>(null)
  const confirmPinInputRef = useRef<PINInputRef>(null)

  useEffect(() => {
    // Extract token and tenantId from URL
    // URL format: /#/${tenantId}/reset-pin?token=...
    const hash = window.location.hash.replace(/^#/, '')
    const search = window.location.search
    
    let foundToken: string | null = null
    let foundTenantId: string = ''
    
    // Try hash first (primary format)
    if (hash) {
      const [pathPart, queryPart] = hash.split('?')
      const parts = pathPart.split('/').filter(p => p)
      
      // Find tenantId (should be before 'reset-pin')
      const resetPinIndex = parts.findIndex(part => part === 'reset-pin')
      if (resetPinIndex > 0) {
        foundTenantId = parts[resetPinIndex - 1]
      }
      
      // Extract token from query params in hash
      if (queryPart) {
        const params = new URLSearchParams(queryPart)
        foundToken = params.get('token')
      }
    }
    
    // Fallback to window.location.search
    if (!foundToken && search) {
      const params = new URLSearchParams(search)
      foundToken = params.get('token')
    }
    
    // Set tenantId (fallback to current if not found)
    if (!foundTenantId) {
      foundTenantId = getCurrentTenantId()
    }
    
    setTenantId(foundTenantId)
    
    if (foundToken) {
      setToken(foundToken)
      // Validate token and get username
      validateToken(foundToken, foundTenantId)
    } else {
      setError('Ingen nulstillings-token fundet. Tjek om linket i emailen er korrekt.')
    }
  }, [])

  const validateToken = async (tokenValue: string, tenantIdValue: string) => {
    try {
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/auth/reset-pin?action=validate'
        : '/api/auth/reset-pin?action=validate'

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: tokenValue,
          tenantId: tenantIdValue
        })
      })

      const data = await response.json()

      if (response.ok && data.username) {
        setUsername(data.username)
        setError(null)
      } else {
        setError(data.error || 'Ugyldig eller udløbet nulstillings-token')
      }
    } catch (err) {
      setError('Kunne ikke validere token. Tjek om linket er korrekt.')
    }
  }

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
      <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-app-gradient">
        <PageCard className="w-full max-w-md u-glass ring-1 ring-[hsl(var(--line)/.12)] shadow-lg">
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <svg 
                  className="w-8 h-8 text-green-600 dark:text-green-400" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
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
    <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-app-gradient">
      <PageCard className="w-full max-w-md u-glass ring-1 ring-[hsl(var(--line)/.12)] shadow-lg">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <img 
              src="/fulllogo_transparent_nobuffer_horizontal.png" 
              alt="Rundeklar" 
              className="h-12 sm:h-14 object-contain"
            />
          </div>
          <h1 className="text-3xl font-semibold mb-2 text-[hsl(var(--foreground))]">
            Nulstil PIN
          </h1>
          {username && (
            <p className="text-sm text-[hsl(var(--muted))]">
              For bruger: <span className="font-medium text-[hsl(var(--foreground))]">{username}</span>
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div 
            className="mb-6 p-4 bg-[hsl(var(--destructive)/.08)] border border-[hsl(var(--destructive)/.2)] rounded-lg flex items-start gap-3 animate-swap-in"
            role="alert"
          >
            <div className="flex-shrink-0 mt-0.5">
              <svg 
                className="w-5 h-5 text-[hsl(var(--destructive))]" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-[hsl(var(--destructive))] flex-1">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* New PIN Input */}
          <div className="space-y-2">
            <label 
              htmlFor="pin" 
              className="block text-sm font-medium text-[hsl(var(--foreground))] text-center"
            >
              Ny PIN (6 cifre)
            </label>
            <PINInput
              ref={pinInputRef}
              value={pin}
              onChange={setPin}
              length={6}
              disabled={loading || !token}
              error={!!error && pin.length > 0}
              autoFocus={!!token && !error}
              aria-label="New PIN code"
            />
          </div>

          {/* Confirm PIN Input */}
          <div className="space-y-2">
            <label 
              htmlFor="confirmPin" 
              className="block text-sm font-medium text-[hsl(var(--foreground))] text-center"
            >
              Bekræft PIN
            </label>
            <PINInput
              ref={confirmPinInputRef}
              value={confirmPin}
              onChange={setConfirmPin}
              length={6}
              disabled={loading || !token}
              error={pin !== confirmPin && confirmPin.length > 0}
              autoFocus={false}
              aria-label="Confirm PIN code"
            />
            {confirmPin && pin !== confirmPin && (
              <p className="text-xs text-center text-[hsl(var(--destructive))] mt-2">
                PIN-koderne matcher ikke
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full py-3 text-base font-medium shadow-sm hover:shadow-md transition-shadow duration-200" 
            loading={loading}
            disabled={!token || pin.length !== 6 || confirmPin.length !== 6}
          >
            Nulstil PIN
          </Button>
        </form>

        {/* Footer Links */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => navigateToAuth('login')}
            className="text-sm text-[hsl(var(--primary))] hover:text-[hsl(var(--primary)/.8)] hover:underline transition-colors duration-200"
          >
            Tilbage til login
          </button>
        </div>
      </PageCard>
    </div>
  )
}

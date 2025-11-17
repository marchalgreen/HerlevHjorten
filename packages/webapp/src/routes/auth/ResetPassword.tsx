import React, { useState, useEffect } from 'react'
import { useNavigation } from '../../contexts/NavigationContext'
import { Button } from '../../components/ui'
import { PageCard } from '../../components/ui'

export default function ResetPasswordPage() {
  const { navigateToAuth } = useNavigation()
  // Get token from URL query params
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])

  useEffect(() => {
    // Extract token from URL hash (hash routing format: /#/${tenantId}/reset-password?token=...)
    const hash = window.location.hash.replace(/^#/, '')
    
    // Split hash into path and query string
    const [pathPart, queryPart] = hash.split('?')
    
    // Extract token from query params in hash
    if (queryPart) {
      const params = new URLSearchParams(queryPart)
      const tokenParam = params.get('token')
      setToken(tokenParam)
      if (!tokenParam) {
        setError('Ingen nulstillings-token fundet')
      }
    } else {
      // Fallback to window.location.search for backward compatibility
      const params = new URLSearchParams(window.location.search)
      const tokenParam = params.get('token')
      setToken(tokenParam)
      if (!tokenParam) {
        setError('Ingen nulstillings-token fundet')
      }
    }
  }, [])

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = []
    if (pwd.length < 8) errors.push('Mindst 8 tegn')
    if (pwd.length > 128) errors.push('Maksimalt 128 tegn')
    if (!/[a-z]/.test(pwd)) errors.push('Mindst ét lille bogstav')
    if (!/[A-Z]/.test(pwd)) errors.push('Mindst ét stort bogstav')
    if (!/[0-9]/.test(pwd)) errors.push('Mindst ét tal')
    if (!/[^a-zA-Z0-9]/.test(pwd)) errors.push('Mindst ét specialtegn')
    return errors
  }

  const handlePasswordChange = (pwd: string) => {
    setPassword(pwd)
    setPasswordErrors(validatePassword(pwd))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Ingen nulstillings-token fundet')
      return
    }

    if (password !== confirmPassword) {
      setError('Adgangskoderne matcher ikke')
      return
    }

    const errors = validatePassword(password)
    if (errors.length > 0) {
      setError('Adgangskoden opfylder ikke kravene')
      return
    }

    setLoading(true)

    try {
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/auth/reset-password'
        : '/api/auth/reset-password'

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          password
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
              Adgangskode nulstillet!
            </h1>
            <p className="text-[hsl(var(--muted))] mb-4">
              Din adgangskode er blevet nulstillet. Du kan nu logge ind med din nye adgangskode.
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
        <h1 className="text-2xl font-semibold mb-6 text-center">Nulstil adgangskode</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Ny adgangskode
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              disabled={loading}
            />
            {passwordErrors.length > 0 && (
              <ul className="mt-1 text-xs text-[hsl(var(--muted))] list-disc list-inside">
                {passwordErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
              Bekræft adgangskode
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              disabled={loading}
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Adgangskoderne matcher ikke
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Nulstil adgangskode
          </Button>
        </form>
      </PageCard>
    </div>
  )
}


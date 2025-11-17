import React, { useState } from 'react'
import { useTenant } from '../../contexts/TenantContext'
import { Button } from '../ui'
import { generateRandomPIN } from '../../lib/auth/pin'

interface CreateCoachFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function CreateCoachForm({ onSuccess, onCancel }: CreateCoachFormProps) {
  const { tenantId } = useTenant()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [autoGeneratePIN, setAutoGeneratePIN] = useState(true)
  const [sendEmail, setSendEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGeneratePIN = () => {
    const newPIN = generateRandomPIN()
    setPin(newPIN)
    setAutoGeneratePIN(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const token = localStorage.getItem('auth_access_token')
      const finalPIN = autoGeneratePIN ? undefined : pin
      const apiUrl = import.meta.env.DEV 
        ? `http://127.0.0.1:3000/api/${tenantId}/admin/coaches`
        : `/api/${tenantId}/admin/coaches`

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          username,
          pin: finalPIN,
          sendEmail
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create coach')
      }

      if (!sendEmail && data.coach?.pin) {
        alert(`Træner oprettet! PIN: ${data.coach.pin}`)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create coach')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))]">
      <h2 className="text-xl font-semibold mb-4">Opret ny træner</h2>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email *
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium mb-1">
          Brugernavn *
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={50}
          className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          disabled={loading}
        />
        <p className="text-xs text-[hsl(var(--muted))] mt-1">
          Minimum 3 tegn, maksimum 50 tegn
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="pin" className="block text-sm font-medium">
            PIN (6 cifre) *
          </label>
          <button
            type="button"
            onClick={handleGeneratePIN}
            className="text-sm text-[hsl(var(--primary))] hover:underline"
          >
            Generer automatisk
          </button>
        </div>
        <input
          id="pin"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
            setAutoGeneratePIN(false)
          }}
          required={!autoGeneratePIN}
          maxLength={6}
          placeholder={autoGeneratePIN ? 'Genereres automatisk' : '000000'}
          className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] text-center text-xl tracking-widest"
          disabled={loading || autoGeneratePIN}
        />
        {autoGeneratePIN && (
          <p className="text-xs text-[hsl(var(--muted))] mt-1">
            PIN genereres automatisk ved oprettelse
          </p>
        )}
      </div>

      <div className="flex items-center">
        <input
          id="sendEmail"
          type="checkbox"
          checked={sendEmail}
          onChange={(e) => setSendEmail(e.target.checked)}
          className="mr-2"
          disabled={loading}
        />
        <label htmlFor="sendEmail" className="text-sm">
          Send velkomstemail med PIN til træneren
        </label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" loading={loading}>
          Opret træner
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Annuller
        </Button>
      </div>
    </form>
  )
}


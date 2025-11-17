import React, { useState } from 'react'
import { useTenant } from '../../contexts/TenantContext'
import { useNavigation } from '../../contexts/NavigationContext'
import { Button } from '../../components/ui'
import { PageCard } from '../../components/ui'
import { User, Mail } from 'lucide-react'

export default function ForgotPinPage() {
  const { tenantId } = useTenant()
  const { navigateToAuth } = useNavigation()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate that at least one field is filled
    if (!email && !username) {
      setError('Indtast enten email eller brugernavn')
      return
    }

    setLoading(true)

    try {
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/auth/reset-pin?action=request'
        : '/api/auth/reset-pin?action=request'

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email || undefined,
          username: username || undefined,
          tenantId
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
      } else {
        setError(data.error || 'Anmodning fejlede')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmodning fejlede')
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
              <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold mb-4 text-[hsl(var(--foreground))]">
              Email sendt!
            </h1>
            <p className="text-[hsl(var(--muted))] mb-4">
              Hvis en konto med den angivne email eller brugernavn findes, har vi sendt et link til nulstilling af PIN.
            </p>
            <p className="text-sm text-[hsl(var(--muted))] mb-6">
              Tjek din email og klik på linket for at nulstille din PIN.
            </p>
            <Button
              type="button"
              onClick={() => navigateToAuth('login')}
              className="w-full"
            >
              Tilbage til login
            </Button>
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
            Glemt PIN?
          </h1>
          <p className="text-sm text-[hsl(var(--muted))]">
            Indtast din email eller brugernavn for at få sendt et nulstillingslink
          </p>
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
          {/* Email Field */}
          <div className="space-y-2">
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-[hsl(var(--foreground))]"
            >
              Email <span className="text-[hsl(var(--muted))] font-normal">(valgfrit)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-[hsl(var(--muted))]" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5
                  bg-[hsl(var(--surface))] 
                  border border-[hsl(var(--line)/.3)]
                  ring-1 ring-[hsl(var(--line)/.12)]
                  rounded-lg
                  text-[hsl(var(--foreground))]
                  placeholder:text-[hsl(var(--muted)/.5)]
                  focus:outline-none 
                  focus:ring-2 focus:ring-[hsl(var(--ring))]
                  focus:ring-offset-0
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  disabled:bg-[hsl(var(--surface-2))]
                "
                placeholder="din@email.dk"
                disabled={loading}
              />
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[hsl(var(--line)/.3)]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[hsl(var(--surface))] text-[hsl(var(--muted))]">eller</span>
            </div>
          </div>

          {/* Username Field */}
          <div className="space-y-2">
            <label 
              htmlFor="username" 
              className="block text-sm font-medium text-[hsl(var(--foreground))]"
            >
              Brugernavn <span className="text-[hsl(var(--muted))] font-normal">(valgfrit)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="w-5 h-5 text-[hsl(var(--muted))]" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5
                  bg-[hsl(var(--surface))] 
                  border border-[hsl(var(--line)/.3)]
                  ring-1 ring-[hsl(var(--line)/.12)]
                  rounded-lg
                  text-[hsl(var(--foreground))]
                  placeholder:text-[hsl(var(--muted)/.5)]
                  focus:outline-none 
                  focus:ring-2 focus:ring-[hsl(var(--ring))]
                  focus:ring-offset-0
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  disabled:bg-[hsl(var(--surface-2))]
                "
                placeholder="Dit brugernavn"
                disabled={loading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full py-3 text-base font-medium shadow-sm hover:shadow-md transition-shadow duration-200" 
            loading={loading}
          >
            Send nulstillingslink
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


import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigation } from '../../contexts/NavigationContext'
import { Button, PINInput } from '../../components/ui'
import type { PINInputRef } from '../../components/auth/PINInput'
import { PageCard } from '../../components/ui'
import { User, Lock, Mail } from 'lucide-react'

export default function LoginPage() {
  const { login, loginWithPIN } = useAuth()
  const { navigate, navigateToAuth } = useNavigation()
  const [loginMethod, setLoginMethod] = useState<'pin' | 'email'>('pin') // Default to PIN for coaches
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [requires2FA, setRequires2FA] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pinInputRef = useRef<PINInputRef>(null)
  
  // Auto-focus username field when PIN login method is selected (only once)
  useEffect(() => {
    if (loginMethod === 'pin' && username === '') {
      const timer = setTimeout(() => {
        const usernameInput = document.getElementById('username')
        if (usernameInput && document.activeElement !== usernameInput) {
          usernameInput.focus()
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [loginMethod, username])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (loginMethod === 'pin') {
        if (pin.length !== 6) {
          setError('PIN skal være 6 cifre')
          setPin('') // Clear PIN on validation error
          setLoading(false)
          return
        }
        await loginWithPIN(username, pin)
      } else {
        await login(email, password, totpCode || undefined)
      }
      navigate('coach')
    } catch (err) {
      if (err instanceof Error && err.message === '2FA_REQUIRED') {
        setRequires2FA(true)
        setError(null)
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Login fejlede'
        setError(errorMessage)
        // Clear PIN on login error for PIN method
        if (loginMethod === 'pin') {
          setPin('')
          // Auto-focus and clear PIN input after error
          setTimeout(() => {
            pinInputRef.current?.focus()
          }, 100)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleMethodChange = (method: 'pin' | 'email') => {
    setLoginMethod(method)
    setError(null)
    setPin('')
    setPassword('')
    setTotpCode('')
    setRequires2FA(false)
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
            Log ind
          </h1>
          <p className="text-sm text-[hsl(var(--muted))]">
            {loginMethod === 'pin' 
              ? 'Log ind med dit brugernavn og PIN' 
              : 'Log ind med din email og adgangskode'}
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

        {/* Method Tabs */}
        <div className="mb-8 flex gap-1 p-1 bg-[hsl(var(--surface-2)/.5)] rounded-lg ring-1 ring-[hsl(var(--line)/.12)]">
          <button
            type="button"
            onClick={() => handleMethodChange('pin')}
            className={`
              flex-1 px-4 py-2.5 text-sm font-medium rounded-md
              transition-all duration-200 ease-out
              flex items-center justify-center gap-2
              ${
                loginMethod === 'pin'
                  ? 'bg-[hsl(var(--surface))] text-[hsl(var(--foreground))] shadow-sm ring-1 ring-[hsl(var(--line)/.2)]'
                  : 'text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2)/.3)]'
              }
            `}
          >
            <User className="w-4 h-4" />
            <span>Træner</span>
          </button>
          <button
            type="button"
            onClick={() => handleMethodChange('email')}
            className={`
              flex-1 px-4 py-2.5 text-sm font-medium rounded-md
              transition-all duration-200 ease-out
              flex items-center justify-center gap-2
              ${
                loginMethod === 'email'
                  ? 'bg-[hsl(var(--surface))] text-[hsl(var(--foreground))] shadow-sm ring-1 ring-[hsl(var(--line)/.2)]'
                  : 'text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2)/.3)]'
              }
            `}
          >
            <Mail className="w-4 h-4" />
            <span>Administrator</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {loginMethod === 'pin' ? (
            <>
              {/* Username Field */}
              <div className="space-y-2">
                <label 
                  htmlFor="username" 
                  className="block text-sm font-medium text-[hsl(var(--foreground))]"
                >
                  Brugernavn
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
                    required
                    autoFocus
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 
                      bg-[hsl(var(--surface))] 
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
                    placeholder="Indtast dit brugernavn"
                  />
                </div>
              </div>

              {/* PIN Input */}
              <div className="space-y-2">
                <PINInput
                  ref={pinInputRef}
                  value={pin}
                  onChange={setPin}
                  length={6}
                  disabled={loading}
                  error={!!error && pin.length > 0}
                  autoFocus={false}
                  aria-label="PIN code"
                />
                <p className="text-xs text-center text-[hsl(var(--muted))] mt-2">
                  PIN (6 cifre)
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Email Field */}
              <div className="space-y-2">
                <label 
                  htmlFor="email" 
                  className="block text-sm font-medium text-[hsl(var(--foreground))]"
                >
                  Email
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
                    required
                    autoFocus
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 
                      bg-[hsl(var(--surface))] 
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
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label 
                  htmlFor="password" 
                  className="block text-sm font-medium text-[hsl(var(--foreground))]"
                >
                  Adgangskode
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-[hsl(var(--muted))]" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 
                      bg-[hsl(var(--surface))] 
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
                    placeholder="Indtast din adgangskode"
                  />
                </div>
              </div>
            </>
          )}

          {/* 2FA Code */}
          {requires2FA && (
            <div className="space-y-2 animate-swap-in">
              <label 
                htmlFor="totp" 
                className="block text-sm font-medium text-[hsl(var(--foreground))] text-center"
              >
                To-faktor autentificeringskode
              </label>
              <PINInput
                value={totpCode}
                onChange={setTotpCode}
                length={6}
                disabled={loading}
                autoFocus={true}
                aria-label="Two-factor authentication code"
              />
            </div>
          )}

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full py-3 text-base font-medium shadow-sm hover:shadow-md transition-shadow duration-200" 
            loading={loading}
          >
            Log ind
          </Button>
        </form>

        {/* Footer Links */}
        <div className="mt-8 text-center">
          {loginMethod === 'pin' ? (
            <button
              type="button"
              onClick={() => navigateToAuth('forgot-pin')}
              className="text-sm text-[hsl(var(--primary))] hover:text-[hsl(var(--primary)/.8)] hover:underline transition-colors duration-200"
            >
              Glemt PIN?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigateToAuth('forgot-password')}
              className="text-sm text-[hsl(var(--primary))] hover:text-[hsl(var(--primary)/.8)] hover:underline transition-colors duration-200"
            >
              Glemt adgangskode?
            </button>
          )}
        </div>
      </PageCard>
    </div>
  )
}

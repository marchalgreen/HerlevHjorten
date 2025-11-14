import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTenant } from '../../contexts/TenantContext'
import { Button } from '../../components/ui'
import { PageCard } from '../../components/ui'

export default function AccountSettingsPage() {
  const { club, logout } = useAuth()
  const { config } = useTenant()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changePasswordLoading, setChangePasswordLoading] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null)
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])

  // 2FA state
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [disablePassword, setDisablePassword] = useState('')
  const [disableLoading, setDisableLoading] = useState(false)

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

  const handleNewPasswordChange = (pwd: string) => {
    setNewPassword(pwd)
    setPasswordErrors(validatePassword(pwd))
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangePasswordError(null)
    setChangePasswordSuccess(false)

    if (newPassword !== confirmPassword) {
      setChangePasswordError('Adgangskoderne matcher ikke')
      return
    }

    const errors = validatePassword(newPassword)
    if (errors.length > 0) {
      setChangePasswordError('Adgangskoden opfylder ikke kravene')
      return
    }

    setChangePasswordLoading(true)

    try {
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/auth/change-password'
        : '/api/auth/change-password'

      const token = localStorage.getItem('auth_access_token')
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        setChangePasswordSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setPasswordErrors([])
      } else {
        setChangePasswordError(data.error || 'Skift af adgangskode fejlede')
      }
    } catch (err) {
      setChangePasswordError(err instanceof Error ? err.message : 'Skift af adgangskode fejlede')
    } finally {
      setChangePasswordLoading(false)
    }
  }

  const handleSetup2FA = async () => {
    setTwoFactorError(null)
    setTwoFactorLoading(true)

    try {
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/auth/setup-2fa'
        : '/api/auth/setup-2fa'

      const token = localStorage.getItem('auth_access_token')
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok) {
        setQrCode(data.qrCode)
        setTwoFactorSecret(data.secret)
      } else {
        setTwoFactorError(data.error || '2FA opsætning fejlede')
      }
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : '2FA opsætning fejlede')
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setTwoFactorError(null)

    try {
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/auth/verify-2fa-setup'
        : '/api/auth/verify-2fa-setup'

      const token = localStorage.getItem('auth_access_token')
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code: verificationCode
        })
      })

      const data = await response.json()

      if (response.ok) {
        setBackupCodes(data.backupCodes)
        setQrCode(null)
        setVerificationCode('')
        setTwoFactorSecret(null)
        // Refresh club info
        window.location.reload()
      } else {
        setTwoFactorError(data.error || '2FA verifikation fejlede')
      }
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : '2FA verifikation fejlede')
    }
  }

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setTwoFactorError(null)
    setDisableLoading(true)

    try {
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/auth/disable-2fa'
        : '/api/auth/disable-2fa'

      const token = localStorage.getItem('auth_access_token')
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          password: disablePassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        setDisablePassword('')
        // Refresh club info
        window.location.reload()
      } else {
        setTwoFactorError(data.error || 'Deaktivering af 2FA fejlede')
      }
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'Deaktivering af 2FA fejlede')
    } finally {
      setDisableLoading(false)
    }
  }

  if (!club) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-semibold">Kontoindstillinger</h1>

      {/* Profile Section */}
      <PageCard>
        <h2 className="text-xl font-semibold mb-4">Profil</h2>
        <div className="space-y-2">
          <div>
            <label className="text-sm font-medium text-[hsl(var(--muted))]">Email</label>
            <p className="text-[hsl(var(--foreground))]">{club.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-[hsl(var(--muted))]">Klub</label>
            <p className="text-[hsl(var(--foreground))]">{config.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-[hsl(var(--muted))]">Email verificeret</label>
            <p className={club.emailVerified ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {club.emailVerified ? 'Ja' : 'Nej'}
            </p>
          </div>
        </div>
      </PageCard>

      {/* Change Password Section */}
      <PageCard>
        <h2 className="text-xl font-semibold mb-4">Skift adgangskode</h2>
        {changePasswordSuccess && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-sm text-green-600 dark:text-green-400">Adgangskode ændret!</p>
          </div>
        )}
        {changePasswordError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{changePasswordError}</p>
          </div>
        )}
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
              Nuværende adgangskode
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              disabled={changePasswordLoading}
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
              Ny adgangskode
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => handleNewPasswordChange(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              disabled={changePasswordLoading}
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
              disabled={changePasswordLoading}
            />
          </div>
          <Button type="submit" loading={changePasswordLoading}>
            Skift adgangskode
          </Button>
        </form>
      </PageCard>

      {/* 2FA Section */}
      <PageCard>
        <h2 className="text-xl font-semibold mb-4">To-faktor autentificering</h2>
        {twoFactorError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{twoFactorError}</p>
          </div>
        )}
        
        {club.twoFactorEnabled ? (
          <div className="space-y-4">
            <p className="text-green-600 dark:text-green-400">2FA er aktiveret</p>
            {backupCodes.length > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-sm font-medium mb-2">Gem disse backup-koder:</p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="p-2 bg-white dark:bg-gray-800 rounded">
                      {code}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[hsl(var(--muted))] mt-2">
                  Disse koder vises kun én gang. Gem dem et sikkert sted.
                </p>
              </div>
            )}
            <form onSubmit={handleDisable2FA} className="space-y-4">
              <div>
                <label htmlFor="disablePassword" className="block text-sm font-medium mb-1">
                  Bekræft med adgangskode for at deaktivere 2FA
                </label>
                <input
                  id="disablePassword"
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                  disabled={disableLoading}
                />
              </div>
              <Button type="submit" variant="destructive" loading={disableLoading}>
                Deaktiver 2FA
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {qrCode ? (
              <div className="space-y-4">
                <p className="text-sm text-[hsl(var(--muted))]">
                  Scan QR-koden med din autentificeringsapp (f.eks. Google Authenticator):
                </p>
                <div className="flex justify-center">
                  <img src={qrCode} alt="2FA QR Code" className="w-64 h-64" />
                </div>
                <p className="text-xs text-[hsl(var(--muted))]">
                  Eller indtast denne nøgle manuelt: <code className="font-mono">{twoFactorSecret}</code>
                </p>
                <form onSubmit={handleVerify2FA} className="space-y-4">
                  <div>
                    <label htmlFor="verificationCode" className="block text-sm font-medium mb-1">
                      Verifikationskode
                    </label>
                    <input
                      id="verificationCode"
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] text-center text-2xl tracking-widest"
                    />
                  </div>
                  <Button type="submit">Aktiver 2FA</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setQrCode(null)
                      setTwoFactorSecret(null)
                      setVerificationCode('')
                    }}
                  >
                    Annuller
                  </Button>
                </form>
              </div>
            ) : (
              <Button onClick={handleSetup2FA} loading={twoFactorLoading}>
                Aktiver 2FA
              </Button>
            )}
          </div>
        )}
      </PageCard>

      {/* Logout Section */}
      <PageCard>
        <h2 className="text-xl font-semibold mb-4">Log ud</h2>
        <Button variant="destructive" onClick={logout}>
          Log ud
        </Button>
      </PageCard>
    </div>
  )
}


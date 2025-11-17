import React, { useState, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTenant } from '../../contexts/TenantContext'
import { useNavigation } from '../../contexts/NavigationContext'
import { Button, PageCard, Badge, PINInput } from '../../components/ui'
import type { PINInputRef } from '../../components/auth/PINInput'
import { 
  User, 
  Lock, 
  Shield, 
  LogOut, 
  Mail, 
  Building2, 
  CheckCircle2, 
  XCircle,
  KeyRound,
  QrCode,
  Copy,
  AlertCircle,
  ArrowLeft
} from 'lucide-react'

export default function AccountSettingsPage() {
  const { club, logout } = useAuth()
  const { config } = useTenant()
  const { navigate } = useNavigation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changePasswordLoading, setChangePasswordLoading] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null)
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])

  // PIN change state (for coaches)
  const [currentPIN, setCurrentPIN] = useState('')
  const [newPIN, setNewPIN] = useState('')
  const [confirmPIN, setConfirmPIN] = useState('')
  const [changePINLoading, setChangePINLoading] = useState(false)
  const [changePINError, setChangePINError] = useState<string | null>(null)
  const [changePINSuccess, setChangePINSuccess] = useState(false)
  const [pinErrors, setPinErrors] = useState<string[]>([])
  const currentPINRef = useRef<PINInputRef>(null)
  const newPINRef = useRef<PINInputRef>(null)
  const confirmPINRef = useRef<PINInputRef>(null)

  // 2FA state
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [disablePassword, setDisablePassword] = useState('')
  const [disableLoading, setDisableLoading] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

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

  const validatePIN = (pin: string): string[] => {
    const errors: string[] = []
    if (!/^\d+$/.test(pin)) {
      errors.push('PIN skal kun indeholde tal')
    }
    if (pin.length !== 6) {
      errors.push('PIN skal være præcis 6 cifre')
    }
    return errors
  }

  const handleNewPINChange = (pin: string) => {
    setNewPIN(pin)
    setPinErrors(validatePIN(pin))
  }

  const handleChangePIN = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangePINError(null)
    setChangePINSuccess(false)

    if (newPIN !== confirmPIN) {
      setChangePINError('PIN-koderne matcher ikke')
      return
    }

    const errors = validatePIN(newPIN)
    if (errors.length > 0) {
      setChangePINError('PIN opfylder ikke kravene')
      return
    }

    setChangePINLoading(true)

    try {
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/auth/change-pin'
        : '/api/auth/change-pin'

      const token = localStorage.getItem('auth_access_token')
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPIN,
          newPIN
        })
      })

      const data = await response.json()

      if (response.ok) {
        setChangePINSuccess(true)
        setCurrentPIN('')
        setNewPIN('')
        setConfirmPIN('')
        setPinErrors([])
        // Clear all PIN inputs
        currentPINRef.current?.clear()
        newPINRef.current?.clear()
        confirmPINRef.current?.clear()
        // Clear success message after 5 seconds
        setTimeout(() => setChangePINSuccess(false), 5000)
      } else {
        setChangePINError(data.error || 'Skift af PIN fejlede')
        // Focus first input on error
        currentPINRef.current?.focus()
      }
    } catch (err) {
      setChangePINError(err instanceof Error ? err.message : 'Skift af PIN fejlede')
    } finally {
      setChangePINLoading(false)
    }
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
        // Clear success message after 5 seconds
        setTimeout(() => setChangePasswordSuccess(false), 5000)
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

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCode(type)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedCode(type)
      setTimeout(() => setCopiedCode(null), 2000)
    }
  }

  if (!club) {
    return null
  }

  const isCoach = club.role === 'coach'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header with back button */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('coach')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Tilbage</span>
          </Button>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--foreground))]">
            Kontoindstillinger
          </h1>
          <p className="text-sm sm:text-base text-[hsl(var(--muted))]">
            Administrer din konto, sikkerhed og indstillinger
          </p>
        </div>
      </div>

      {/* Profile Section */}
      <PageCard className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--primary)/.1)]">
            <User className="w-5 h-5 text-[hsl(var(--primary))]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))]">
              Profil
            </h2>
            <p className="text-xs sm:text-sm text-[hsl(var(--muted))]">
              Din kontoinformation
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-2">
          {isCoach && club.username ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted))] uppercase tracking-wide">
                Brugernavn
              </label>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[hsl(var(--muted))]" />
                <p className="text-sm sm:text-base font-medium text-[hsl(var(--foreground))]">
                  {club.username}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted))] uppercase tracking-wide">
                Email
              </label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[hsl(var(--muted))]" />
                <p className="text-sm sm:text-base font-medium text-[hsl(var(--foreground))]">
                  {club.email}
                </p>
              </div>
            </div>
          )}
          
          {isCoach && club.email && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted))] uppercase tracking-wide">
                Email
              </label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[hsl(var(--muted))]" />
                <p className="text-sm sm:text-base font-medium text-[hsl(var(--foreground))]">
                  {club.email}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted))] uppercase tracking-wide">
              Klub
            </label>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[hsl(var(--muted))]" />
              <p className="text-sm sm:text-base font-medium text-[hsl(var(--foreground))]">
                {config.name}
              </p>
            </div>
          </div>

          {!isCoach && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted))] uppercase tracking-wide">
                Email Status
              </label>
              <div className="flex items-center gap-2">
                {club.emailVerified ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    <Badge variant="success">Verificeret</Badge>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-[hsl(var(--danger))]" />
                    <Badge variant="danger">Ikke verificeret</Badge>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </PageCard>

      {/* Change Password Section - Only for admins */}
      {!isCoach && (
        <PageCard className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--primary)/.1)]">
              <Lock className="w-5 h-5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))]">
                Skift adgangskode
              </h2>
              <p className="text-xs sm:text-sm text-[hsl(var(--muted))]">
                Opdater din adgangskode for bedre sikkerhed
              </p>
            </div>
          </div>

        {changePasswordSuccess && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-[hsl(var(--success)/.1)] ring-1 ring-[hsl(var(--success)/.2)]">
            <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[hsl(var(--success))]">
                Adgangskode ændret!
              </p>
              <p className="text-xs text-[hsl(var(--muted))] mt-1">
                Din adgangskode er blevet opdateret succesfuldt.
              </p>
            </div>
          </div>
        )}

        {changePasswordError && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-[hsl(var(--danger)/.1)] ring-1 ring-[hsl(var(--danger)/.2)]">
            <AlertCircle className="w-5 h-5 text-[hsl(var(--danger))] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[hsl(var(--danger))]">
                Fejl
              </p>
              <p className="text-xs text-[hsl(var(--muted))] mt-1">
                {changePasswordError}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="currentPassword" className="block text-sm font-medium text-[hsl(var(--foreground))]">
              Nuværende adgangskode
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="w-4 h-4 text-[hsl(var(--muted))]" />
              </div>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5
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
                placeholder="Indtast nuværende adgangskode"
                disabled={changePasswordLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="newPassword" className="block text-sm font-medium text-[hsl(var(--foreground))]">
              Ny adgangskode
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-[hsl(var(--muted))]" />
              </div>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => handleNewPasswordChange(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5
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
                placeholder="Indtast ny adgangskode"
                disabled={changePasswordLoading}
              />
            </div>
            {passwordErrors.length > 0 && (
              <div className="mt-2 space-y-1">
                {passwordErrors.map((err, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[hsl(var(--muted))]">
                    <div className="w-1 h-1 rounded-full bg-[hsl(var(--muted))]" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[hsl(var(--foreground))]">
              Bekræft adgangskode
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-[hsl(var(--muted))]" />
              </div>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5
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
                placeholder="Bekræft ny adgangskode"
                disabled={changePasswordLoading}
              />
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" loading={changePasswordLoading} className="w-full sm:w-auto">
              <Lock className="w-4 h-4" />
              Opdater adgangskode
            </Button>
          </div>
        </form>
      </PageCard>
      )}

      {/* Change PIN Section - Only for coaches */}
      {isCoach && (
        <PageCard className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--primary)/.1)]">
              <KeyRound className="w-5 h-5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))]">
                Skift PIN
              </h2>
              <p className="text-xs sm:text-sm text-[hsl(var(--muted))]">
                Opdater din 6-cifrede PIN-kode
              </p>
            </div>
          </div>

          {changePINSuccess && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-[hsl(var(--success)/.1)] ring-1 ring-[hsl(var(--success)/.2)]">
              <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[hsl(var(--success))]">
                  PIN ændret!
                </p>
                <p className="text-xs text-[hsl(var(--muted))] mt-1">
                  Din PIN er blevet opdateret succesfuldt.
                </p>
              </div>
            </div>
          )}

          {changePINError && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-[hsl(var(--danger)/.1)] ring-1 ring-[hsl(var(--danger)/.2)]">
              <AlertCircle className="w-5 h-5 text-[hsl(var(--danger))] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[hsl(var(--danger))]">
                  Fejl
                </p>
                <p className="text-xs text-[hsl(var(--muted))] mt-1">
                  {changePINError}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleChangePIN} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[hsl(var(--foreground))] text-center">
                Nuværende PIN
              </label>
              <div className="flex justify-center">
                <PINInput
                  ref={currentPINRef}
                  value={currentPIN}
                  onChange={setCurrentPIN}
                  length={6}
                  disabled={changePINLoading}
                  error={!!changePINError && currentPIN.length > 0}
                  aria-label="Nuværende PIN"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[hsl(var(--foreground))] text-center">
                Ny PIN
              </label>
              <div className="flex justify-center">
                <PINInput
                  ref={newPINRef}
                  value={newPIN}
                  onChange={handleNewPINChange}
                  length={6}
                  disabled={changePINLoading}
                  error={pinErrors.length > 0 && newPIN.length > 0}
                  aria-label="Ny PIN"
                />
              </div>
              {pinErrors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {pinErrors.map((err, i) => (
                    <div key={i} className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--muted))]">
                      <div className="w-1 h-1 rounded-full bg-[hsl(var(--muted))]" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[hsl(var(--foreground))] text-center">
                Bekræft PIN
              </label>
              <div className="flex justify-center">
                <PINInput
                  ref={confirmPINRef}
                  value={confirmPIN}
                  onChange={setConfirmPIN}
                  length={6}
                  disabled={changePINLoading}
                  error={!!changePINError && confirmPIN.length > 0 && newPIN !== confirmPIN}
                  aria-label="Bekræft PIN"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" loading={changePINLoading} className="w-full sm:w-auto">
                <KeyRound className="w-4 h-4" />
                Opdater PIN
              </Button>
            </div>
          </form>
        </PageCard>
      )}

      {/* 2FA Section */}
      <PageCard className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--primary)/.1)]">
            <Shield className="w-5 h-5 text-[hsl(var(--primary))]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))]">
                To-faktor autentificering
              </h2>
              {club.twoFactorEnabled && (
                <Badge variant="success">Aktiveret</Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[hsl(var(--muted))]">
              Tilføj et ekstra lag af sikkerhed til din konto
            </p>
          </div>
        </div>

        {twoFactorError && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-[hsl(var(--danger)/.1)] ring-1 ring-[hsl(var(--danger)/.2)]">
            <AlertCircle className="w-5 h-5 text-[hsl(var(--danger))] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[hsl(var(--danger))]">
                Fejl
              </p>
              <p className="text-xs text-[hsl(var(--muted))] mt-1">
                {twoFactorError}
              </p>
            </div>
          </div>
        )}
        
        {club.twoFactorEnabled ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-[hsl(var(--success)/.1)] ring-1 ring-[hsl(var(--success)/.2)]">
              <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[hsl(var(--success))]">
                  2FA er aktiveret
                </p>
                <p className="text-xs text-[hsl(var(--muted))] mt-1">
                  Din konto er beskyttet med to-faktor autentificering.
                </p>
              </div>
            </div>

            {backupCodes.length > 0 && (
              <div className="p-4 rounded-lg bg-[hsl(var(--warning)/.1)] ring-1 ring-[hsl(var(--warning)/.2)]">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                      Backup-koder
                    </p>
                    <p className="text-xs text-[hsl(var(--muted))]">
                      Gem disse koder et sikkert sted. De vises kun én gang.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {backupCodes.map((code, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-md bg-[hsl(var(--surface))] ring-1 ring-[hsl(var(--line)/.12)] font-mono text-sm text-center font-medium text-[hsl(var(--foreground))]"
                    >
                      {code}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[hsl(var(--muted))]">
                  ⚠️ Disse koder kan bruges til at logge ind, hvis du mister adgang til din autentificeringsapp.
                </p>
              </div>
            )}

            <form onSubmit={handleDisable2FA} className="space-y-4 pt-2">
              <div className="space-y-2">
                <label htmlFor="disablePassword" className="block text-sm font-medium text-[hsl(var(--foreground))]">
                  Bekræft med adgangskode for at deaktivere 2FA
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="w-4 h-4 text-[hsl(var(--muted))]" />
                  </div>
                  <input
                    id="disablePassword"
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5
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
                    disabled={disableLoading}
                  />
                </div>
              </div>
              <Button type="submit" variant="destructive" loading={disableLoading} className="w-full sm:w-auto">
                <Shield className="w-4 h-4" />
                Deaktiver 2FA
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {qrCode ? (
              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-[hsl(var(--surface-2))] ring-1 ring-[hsl(var(--line)/.12)]">
                  <p className="text-sm text-[hsl(var(--foreground))] mb-4">
                    Scan QR-koden med din autentificeringsapp (f.eks. Google Authenticator eller Authy):
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-white rounded-lg ring-1 ring-[hsl(var(--line)/.12)]">
                      <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 sm:w-64 sm:h-64" />
                    </div>
                  </div>
                  {twoFactorSecret && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[hsl(var(--muted))] uppercase tracking-wide">
                        Eller indtast denne nøgle manuelt:
                      </label>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--surface))] ring-1 ring-[hsl(var(--line)/.12)]">
                        <code className="flex-1 font-mono text-sm text-[hsl(var(--foreground))] break-all">
                          {twoFactorSecret}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(twoFactorSecret, 'secret')}
                          className="p-2 rounded-md hover:bg-[hsl(var(--surface-2))] transition-colors"
                          title="Kopier nøgle"
                        >
                          {copiedCode === 'secret' ? (
                            <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                          ) : (
                            <Copy className="w-4 h-4 text-[hsl(var(--muted))]" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleVerify2FA} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="verificationCode" className="block text-sm font-medium text-[hsl(var(--foreground))]">
                      Verifikationskode fra din app
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <QrCode className="w-4 h-4 text-[hsl(var(--muted))]" />
                      </div>
                      <input
                        id="verificationCode"
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                        placeholder="000000"
                        maxLength={6}
                        className="w-full pl-10 pr-4 py-2.5
                          bg-[hsl(var(--surface))]
                          ring-1 ring-[hsl(var(--line)/.12)]
                          rounded-lg
                          text-[hsl(var(--foreground))]
                          placeholder:text-[hsl(var(--muted)/.5)]
                          focus:outline-none
                          focus:ring-2 focus:ring-[hsl(var(--ring))]
                          focus:ring-offset-0
                          transition-all duration-200
                          text-center text-xl sm:text-2xl tracking-widest font-mono
                        "
                      />
                    </div>
                    <p className="text-xs text-[hsl(var(--muted))]">
                      Indtast den 6-cifrede kode fra din autentificeringsapp
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button type="submit" className="flex-1 sm:flex-none">
                      <Shield className="w-4 h-4" />
                      Aktiver 2FA
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setQrCode(null)
                        setTwoFactorSecret(null)
                        setVerificationCode('')
                      }}
                      className="flex-1 sm:flex-none"
                    >
                      Annuller
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[hsl(var(--muted))]">
                  To-faktor autentificering tilføjer et ekstra lag af sikkerhed ved at kræve en kode fra din telefon ved login.
                </p>
                <Button onClick={handleSetup2FA} loading={twoFactorLoading} className="w-full sm:w-auto">
                  <Shield className="w-4 h-4" />
                  Aktiver 2FA
                </Button>
              </div>
            )}
          </div>
        )}
      </PageCard>

      {/* Logout Section */}
      <PageCard className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--danger)/.1)]">
            <LogOut className="w-5 h-5 text-[hsl(var(--danger))]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-[hsl(var(--foreground))]">
              Log ud
            </h2>
            <p className="text-xs sm:text-sm text-[hsl(var(--muted))]">
              Log ud af din konto på denne enhed
            </p>
          </div>
        </div>
        <Button variant="destructive" onClick={logout} className="w-full sm:w-auto">
          <LogOut className="w-4 h-4" />
          Log ud
        </Button>
      </PageCard>
    </div>
  )
}

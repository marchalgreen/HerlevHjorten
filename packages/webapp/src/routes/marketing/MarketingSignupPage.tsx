import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageCard } from '../../components/ui'
import { Button } from '../../components/ui'
import { Check, Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { pricingPlans, type PricingPlan } from '../../lib/marketing/pricing'
import { nameToSubdomain } from '../../lib/marketing/tenant-utils'
import { trackPageView, trackConversion } from '../../lib/analytics/track'

type Step = 'club' | 'plan' | 'password' | 'success'

interface SignupData {
  clubName: string
  email: string
  planId: string
  password: string
  confirmPassword: string
}

export default function MarketingSignupPage() {
  // Get plan from URL query parameter
  const getPlanFromUrl = () => {
    if (typeof window === 'undefined') return ''
    const params = new URLSearchParams(window.location.search)
    return params.get('plan') || ''
  }

  const initialPlanId = getPlanFromUrl()
  
  // Always start with plan selection step (or success if returning)
  // IMPORTANT: Read from sessionStorage directly in useState initializer to ensure
  // we always get the correct value, even if component remounts
  const [currentStep, setCurrentStep] = useState<Step>(() => {
    if (typeof window === 'undefined') return 'plan'
    const savedStep = sessionStorage.getItem('signup_step')
    const initialStep = savedStep === 'success' ? 'success' : 'plan'
    console.log('[MarketingSignupPage] useState initializer:', {
      savedStep,
      initialStep,
      timestamp: new Date().toISOString()
    })
    return initialStep
  })
  
  // Track page view on mount
  useEffect(() => {
    trackPageView('marketing')
  }, [])

  // Debug: Log when component mounts/unmounts
  useEffect(() => {
    console.log('[MarketingSignupPage] Component MOUNTED', {
      currentStep,
      sessionStorageValue: typeof window !== 'undefined' ? sessionStorage.getItem('signup_step') : null,
      timestamp: new Date().toISOString()
    })
    return () => {
      console.log('[MarketingSignupPage] Component UNMOUNTING', {
        currentStep,
        sessionStorageValue: typeof window !== 'undefined' ? sessionStorage.getItem('signup_step') : null,
        timestamp: new Date().toISOString()
      })
    }
  }, [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupData, setSignupData] = useState<SignupData>({
    clubName: '',
    email: '',
    planId: initialPlanId || '',
    password: '',
    confirmPassword: ''
  })
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])
  
  // Restore tenant ID from sessionStorage if returning from success
  const getInitialTenantId = (): string | null => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem('signup_tenant_id') || null
  }
  
  const getInitialEmail = (): string => {
    if (typeof window === 'undefined') return ''
    return sessionStorage.getItem('signup_email') || ''
  }
  
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(getInitialTenantId())
  
  // Restore email if we're on success step
  useEffect(() => {
    if (currentStep === 'success' && !signupData.email) {
      const savedEmail = getInitialEmail()
      if (savedEmail) {
        setSignupData(prev => ({ ...prev, email: savedEmail }))
      }
    }
  }, [currentStep])
  
  // Sync state with sessionStorage when step changes to success
  useEffect(() => {
    console.log('[MarketingSignupPage] currentStep changed:', {
      currentStep,
      timestamp: new Date().toISOString()
    })
    if (currentStep === 'success' && typeof window !== 'undefined') {
      // Ensure sessionStorage is set (backup)
      if (sessionStorage.getItem('signup_step') !== 'success') {
        sessionStorage.setItem('signup_step', 'success')
        console.log('[MarketingSignupPage] Set sessionStorage to success (backup)')
      }
    }
  }, [currentStep])
  
  // CRITICAL: Continuously listen to sessionStorage changes
  // This ensures that even if component remounts and starts from 'plan',
  // it will immediately update to 'success' when sessionStorage is set
  useEffect(() => {
    const checkSessionStorage = () => {
      if (typeof window !== 'undefined') {
        const savedStep = sessionStorage.getItem('signup_step')
        if (savedStep === 'success' && currentStep !== 'success') {
          console.log('[MarketingSignupPage] sessionStorage is success, updating currentStep from', currentStep, 'to success')
          setCurrentStep('success')
          // Restore tenant ID and email
          const savedTenantId = sessionStorage.getItem('signup_tenant_id')
          const savedEmail = sessionStorage.getItem('signup_email')
          if (savedTenantId) {
            setCreatedTenantId(savedTenantId)
          }
          if (savedEmail) {
            setSignupData(prev => ({ ...prev, email: savedEmail }))
          }
        }
      }
    }
    
    // Check immediately
    checkSessionStorage()
    
    // Poll sessionStorage every 50ms to catch changes quickly
    const interval = setInterval(checkSessionStorage, 50)
    
    return () => clearInterval(interval)
  }, [currentStep])

  const selectedPlan = pricingPlans.find(p => p.id === signupData.planId)
  
  // Generate tenant ID preview from club name
  const tenantIdPreview = useMemo(() => {
    if (!signupData.clubName.trim()) return ''
    return nameToSubdomain(signupData.clubName)
  }, [signupData.clubName])

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
    setSignupData(prev => ({ ...prev, password: pwd }))
    setPasswordErrors(validatePassword(pwd))
  }

  const handleNext = () => {
    setError(null)
    
    if (currentStep === 'plan') {
      if (!signupData.planId) {
        setError('Vælg venligst en pakke')
        return
      }
      setCurrentStep('club')
    } else if (currentStep === 'club') {
      if (!signupData.clubName.trim()) {
        setError('Indtast venligst klubnavn')
        return
      }
      if (!signupData.email.trim() || !signupData.email.includes('@')) {
        setError('Indtast venligst en gyldig email')
        return
      }
      setCurrentStep('password')
    }
  }

  const handleBack = () => {
    setError(null)
    if (currentStep === 'club') {
      setCurrentStep('plan')
    } else if (currentStep === 'password') {
      setCurrentStep('club')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (signupData.password !== signupData.confirmPassword) {
      setError('Adgangskoderne matcher ikke')
      return
    }

    const errors = validatePassword(signupData.password)
    if (errors.length > 0) {
      setError('Adgangskoden opfylder ikke kravene')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/marketing/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: signupData.email,
          password: signupData.password,
          clubName: signupData.clubName,
          planId: signupData.planId
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Registrering fejlede' }))
        throw new Error(errorData.error || errorData.message || 'Registrering fejlede')
      }

      const data = await response.json()

      // Store tenant ID before navigating
      const tenantSubdomain = data.tenant?.subdomain || data.tenantId || null
      
      console.log('[MarketingSignupPage] Signup successful, setting state:', {
        tenantSubdomain,
        email: signupData.email,
        timestamp: new Date().toISOString()
      })
      
      // CRITICAL: Set sessionStorage FIRST, then state, then dispatch event
      // This ensures that if component remounts, useState initializer will read 'success'
      if (typeof window !== 'undefined') {
        console.log('[MarketingSignupPage] Setting sessionStorage FIRST...')
        sessionStorage.setItem('signup_step', 'success')
        sessionStorage.setItem('signup_tenant_id', tenantSubdomain || '')
        sessionStorage.setItem('signup_email', signupData.email)
        console.log('[MarketingSignupPage] sessionStorage set:', {
          signup_step: sessionStorage.getItem('signup_step'),
          signup_tenant_id: sessionStorage.getItem('signup_tenant_id'),
          signup_email: sessionStorage.getItem('signup_email')
        })
      }
      
      // Track conversion (signup completed)
      trackConversion('marketing', 'signup', {
        tenant_id: tenantSubdomain,
        plan_id: signupData.planId,
        email: signupData.email
      })

      // Update state AFTER sessionStorage is set
      // Polling in useEffect will catch this and update currentStep if component remounts
      console.log('[MarketingSignupPage] Updating state: setCurrentStep("success")')
      setCreatedTenantId(tenantSubdomain)
      setCurrentStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrering fejlede')
    } finally {
      setLoading(false)
    }
  }

  const steps: { key: Step; title: string }[] = [
    { key: 'plan', title: 'Vælg pakke' },
    { key: 'club', title: 'Klub information' },
    { key: 'password', title: 'Opret adgangskode' }
  ]

  const currentStepIndex = steps.findIndex(s => s.key === currentStep)

  return (
    <div className="min-h-screen bg-[hsl(var(--bg-canvas))] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        {currentStep !== 'success' && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                        index <= currentStepIndex
                          ? 'bg-[hsl(var(--primary))] text-white'
                          : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))]'
                      }`}
                    >
                      {index < currentStepIndex ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className="text-xs mt-2 text-[hsl(var(--muted))] text-center hidden sm:block">
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 transition-colors ${
                        index < currentStepIndex
                          ? 'bg-[hsl(var(--primary))]'
                          : 'bg-[hsl(var(--surface-2))]'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {currentStep === 'plan' && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PageCard className="w-full">
                <h1 className="text-3xl font-bold mb-2">Vælg din pakke</h1>
                <p className="text-[hsl(var(--muted))] mb-8">
                  Vælg den pakke der passer bedst til din klub
                </p>

                {error && (
                  <div className="mb-6 p-4 bg-[hsl(var(--danger)/.1)] border border-[hsl(var(--danger)/.3)] rounded-md">
                    <p className="text-sm text-[hsl(var(--danger))]">{error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {pricingPlans
                    .filter(p => p.id !== 'enterprise')
                    .map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => {
                          setSignupData(prev => ({ ...prev, planId: plan.id }))
                          setError(null)
                        }}
                        className={`p-6 rounded-lg border-2 transition-all text-left ${
                          signupData.planId === plan.id
                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.05)]'
                            : 'border-[hsl(var(--line)/.3)] hover:border-[hsl(var(--primary)/.5)]'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-xl font-semibold">{plan.name}</h3>
                          {signupData.planId === plan.id && (
                            <CheckCircle2 className="w-6 h-6 text-[hsl(var(--primary))] flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-[hsl(var(--muted))] mb-4">{plan.description}</p>
                        <div className="text-2xl font-bold">
                          {plan.monthlyPrice} kr<span className="text-base font-normal text-[hsl(var(--muted))]">/måned</span>
                        </div>
                      </button>
                    ))}
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleNext} disabled={!signupData.planId}>
                    Fortsæt
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </PageCard>
            </motion.div>
          )}

          {currentStep === 'club' && (
            <motion.div
              key="club"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PageCard className="w-full">
                <h1 className="text-3xl font-bold mb-2">Klub information</h1>
                <p className="text-[hsl(var(--muted))] mb-8">
                  Fortæl os lidt om din klub
                </p>

                {error && (
                  <div className="mb-6 p-4 bg-[hsl(var(--danger)/.1)] border border-[hsl(var(--danger)/.3)] rounded-md">
                    <p className="text-sm text-[hsl(var(--danger))]">{error}</p>
                  </div>
                )}

                {selectedPlan && (
                  <div className="mb-6 p-4 bg-[hsl(var(--primary)/.05)] border border-[hsl(var(--primary)/.2)] rounded-md flex items-center justify-between">
                    <p className="text-sm">
                      <span className="font-semibold">Valgt pakke:</span> {selectedPlan.name} ({selectedPlan.monthlyPrice} kr/måned)
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStep('plan')
                        setError(null)
                      }}
                      className="text-sm text-[hsl(var(--primary))] hover:underline"
                    >
                      Ændr pakke
                    </button>
                  </div>
                )}

                <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
                  <div>
                    <label htmlFor="clubName" className="block text-sm font-medium mb-2">
                      Klubnavn *
                    </label>
                    <input
                      id="clubName"
                      type="text"
                      value={signupData.clubName}
                      onChange={(e) => {
                        setSignupData(prev => ({ ...prev, clubName: e.target.value }))
                        setError(null)
                      }}
                      required
                      placeholder="fx. Herlev/Hjorten Badmintonklub"
                      className="w-full px-4 py-3 border border-[hsl(var(--line))] rounded-lg bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                      disabled={loading}
                    />
                    {tenantIdPreview && (
                      <div className="mt-3 p-3 bg-[hsl(var(--surface-2)/.5)] border border-[hsl(var(--line)/.3)] rounded-md">
                        <p className="text-xs text-[hsl(var(--muted))] mb-1">
                          Din URL bliver:
                        </p>
                        <p className="text-sm font-mono text-[hsl(var(--foreground))]">
                          <span className="text-[hsl(var(--muted))]">https://</span>
                          <span className="font-semibold text-[hsl(var(--primary))]">{tenantIdPreview}</span>
                          <span className="text-[hsl(var(--muted))]">.rundeklar.dk</span>
                        </p>
                      </div>
                    )}
                    {!tenantIdPreview && (
                      <p className="mt-2 text-xs text-[hsl(var(--muted))]">
                        Dette navn bruges til at oprette din unikke URL
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      Email *
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={signupData.email}
                      onChange={(e) => {
                        setSignupData(prev => ({ ...prev, email: e.target.value }))
                        setError(null)
                      }}
                      required
                      placeholder="din@email.dk"
                      className="w-full px-4 py-3 border border-[hsl(var(--line))] rounded-lg bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                      disabled={loading}
                    />
                    <p className="mt-2 text-xs text-[hsl(var(--muted))]">
                      Vi sender en bekræftelsesmail til denne adresse
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleBack}
                      disabled={loading}
                      className="flex-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Tilbage
                    </Button>
                    <Button type="submit" disabled={loading} className="flex-1">
                      Fortsæt
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </form>
              </PageCard>
            </motion.div>
          )}

          {currentStep === 'password' && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PageCard className="w-full">
                <h1 className="text-3xl font-bold mb-2">Opret adgangskode</h1>
                <p className="text-[hsl(var(--muted))] mb-8">
                  Vælg en sikker adgangskode til din konto
                </p>

                {error && (
                  <div className="mb-6 p-4 bg-[hsl(var(--danger)/.1)] border border-[hsl(var(--danger)/.3)] rounded-md">
                    <p className="text-sm text-[hsl(var(--danger))]">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-2">
                      Adgangskode *
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={signupData.password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-[hsl(var(--line))] rounded-lg bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                      disabled={loading}
                    />
                    {passwordErrors.length > 0 && (
                      <ul className="mt-2 text-xs text-[hsl(var(--muted))] list-disc list-inside space-y-1">
                        {passwordErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                      Bekræft adgangskode *
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={signupData.confirmPassword}
                      onChange={(e) => {
                        setSignupData(prev => ({ ...prev, confirmPassword: e.target.value }))
                        setError(null)
                      }}
                      required
                      className="w-full px-4 py-3 border border-[hsl(var(--line))] rounded-lg bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                      disabled={loading}
                    />
                    {signupData.confirmPassword && signupData.password !== signupData.confirmPassword && (
                      <p className="mt-2 text-xs text-[hsl(var(--danger))]">
                        Adgangskoderne matcher ikke
                      </p>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleBack}
                      disabled={loading}
                      className="flex-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Tilbage
                    </Button>
                    <Button type="submit" loading={loading} className="flex-1">
                      {loading ? 'Opretter konto...' : 'Opret konto'}
                    </Button>
                  </div>
                </form>
              </PageCard>
            </motion.div>
          )}

          {currentStep === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <PageCard className="w-full text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="mb-6"
                >
                  <div className="w-20 h-20 bg-[hsl(var(--success)/.2)] rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-12 h-12 text-[hsl(var(--success))]" />
                  </div>
                </motion.div>
                
                <h1 className="text-3xl font-bold mb-4">Velkommen til Rundeklar!</h1>
                <p className="text-lg text-[hsl(var(--muted))] mb-6">
                  Din konto er blevet oprettet. Vi har sendt en bekræftelsesmail til <strong>{signupData.email}</strong>.
                </p>
                <p className="text-sm text-[hsl(var(--muted))] mb-8">
                  Klik på linket i emailen for at aktivere din konto og komme i gang.
                </p>
                
                {createdTenantId && (
                  <div className="p-4 bg-[hsl(var(--primary)/.05)] border border-[hsl(var(--primary)/.2)] rounded-lg mb-6">
                    <p className="text-sm">
                      <strong>Din URL:</strong> <span className="font-mono">{createdTenantId}.rundeklar.dk</span>
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      // Clear sessionStorage when leaving
                      if (typeof window !== 'undefined') {
                        sessionStorage.removeItem('signup_step')
                        sessionStorage.removeItem('signup_tenant_id')
                        sessionStorage.removeItem('signup_email')
                      }
                      window.location.href = '/'
                    }}
                  >
                    Tilbage til forsiden
                  </Button>
                  {createdTenantId && (
                    <Button
                      onClick={() => {
                        // Clear sessionStorage when navigating to tenant
                        if (typeof window !== 'undefined') {
                          sessionStorage.removeItem('signup_step')
                          sessionStorage.removeItem('signup_tenant_id')
                          sessionStorage.removeItem('signup_email')
                        }
                        window.location.href = `https://${createdTenantId}.rundeklar.dk`
                      }}
                    >
                      Gå til min klub
                    </Button>
                  )}
                </div>
              </PageCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}


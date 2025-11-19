import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageCard } from '../../components/ui'
import { Button } from '../../components/ui'
import { Check, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { pricingPlans } from '../../lib/marketing/pricing'
import { nameToSubdomain } from '../../lib/marketing/tenant-utils'
import { trackPageView, trackConversion } from '../../lib/analytics/track'

type Step = 'club' | 'plan' | 'password' | 'success'

interface SignupData {
  clubName: string
  email: string
  planId: string
  billingPeriod: 'monthly' | 'yearly'
  password: string
  confirmPassword: string
}

export default function MarketingSignupPage() {
  // Get plan and step from URL query parameters
  const getPlanFromUrl = () => {
    if (typeof window === 'undefined') return ''
    const params = new URLSearchParams(window.location.search)
    return params.get('plan') || ''
  }

  const getStepFromUrl = (): Step | null => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    const step = params.get('step')
    if (step === 'success' || step === 'plan' || step === 'club' || step === 'password') {
      return step as Step
    }
    return null
  }

  const initialPlanId = getPlanFromUrl()
  const urlStep = getStepFromUrl()
  
  // Use URL step parameter if present (most reliable), otherwise default to 'plan'
  // URL parameters persist through remounts and are more reliable than sessionStorage
  const [currentStep, setCurrentStep] = useState<Step>(() => {
    if (typeof window === 'undefined') return 'plan'
    // Priority 1: URL parameter (most reliable - persists through remounts)
    if (urlStep) {
      return urlStep
    }
    // Priority 2: Fallback to sessionStorage for backwards compatibility
    const savedStep = sessionStorage.getItem('signup_step')
    return savedStep === 'success' ? 'success' : 'plan'
  })
  
  // Track page view on mount
  useEffect(() => {
    trackPageView('marketing')
  }, [])

  // Sync state with URL parameter changes (e.g., browser back/forward)
  useEffect(() => {
    const urlStep = getStepFromUrl()
    if (urlStep && urlStep !== currentStep) {
      setCurrentStep(urlStep)
    }
  }, [currentStep])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupData, setSignupData] = useState<SignupData>({
    clubName: '',
    email: '',
    planId: initialPlanId || '',
    billingPeriod: 'yearly',
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
  
  // Restore tenant ID and email from sessionStorage when on success step
  useEffect(() => {
    if (currentStep === 'success') {
      const savedTenantId = getInitialTenantId()
      const savedEmail = getInitialEmail()
      if (savedTenantId) {
        setCreatedTenantId(savedTenantId)
      }
      if (savedEmail && !signupData.email) {
        setSignupData(prev => ({ ...prev, email: savedEmail }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          planId: signupData.planId,
          billingPeriod: signupData.billingPeriod
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Registrering fejlede' }))
        throw new Error(errorData.error || errorData.message || 'Registrering fejlede')
      }

      const data = await response.json()

      // Store tenant ID and email in sessionStorage for the success page
      const tenantSubdomain = data.tenant?.subdomain || data.tenantId || null
      
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('signup_tenant_id', tenantSubdomain || '')
        sessionStorage.setItem('signup_email', signupData.email)
      }
      
      // Track conversion (signup completed)
      trackConversion('marketing', 'signup', {
        tenant_id: tenantSubdomain,
        plan_id: signupData.planId,
        email: signupData.email
      })

      // CRITICAL: Update state FIRST, then URL, then redirect
      // This ensures success screen shows if component re-renders before redirect
      
      // 1. Update state immediately - if component re-renders, it will show success
      setCreatedTenantId(tenantSubdomain)
      setCurrentStep('success')
      
      // 2. Update URL to match state
      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.set('step', 'success')
      if (signupData.planId) {
        currentUrl.searchParams.set('plan', signupData.planId)
      }
      window.history.replaceState({}, '', currentUrl.toString())
      
      // 3. Redirect after requestAnimationFrame to ensure React has rendered success screen
      // This gives browser time to show success screen before redirect happens
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.location.href = currentUrl.toString()
        })
      })
      
      return // Exit early - redirect will happen
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrering fejlede')
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
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--bg-gradient-1))] via-[hsl(var(--bg-canvas))] to-[hsl(var(--bg-gradient-2))] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Logo Header */}
        {currentStep !== 'success' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 flex justify-center"
          >
            <img
              src="/fulllogo_transparent_nobuffer_horizontal.png"
              alt="Rundeklar"
              className="h-12 sm:h-16 object-contain"
            />
          </motion.div>
        )}

        {/* Progress indicator */}
        {currentStep !== 'success' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center flex-1">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all duration-300 shadow-sm ${
                        index <= currentStepIndex
                          ? 'bg-[hsl(var(--primary))] text-white shadow-[hsl(var(--primary))]/20'
                          : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--muted))]'
                      }`}
                    >
                      {index < currentStepIndex ? (
                        <Check className="w-6 h-6" />
                      ) : (
                        <span className="text-sm">{index + 1}</span>
                      )}
                    </motion.div>
                    <span className="text-xs mt-2 text-[hsl(var(--muted))] text-center hidden sm:block font-medium">
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-3 transition-all duration-300 rounded-full ${
                        index < currentStepIndex
                          ? 'bg-[hsl(var(--primary))]'
                          : 'bg-[hsl(var(--surface-2))]'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </motion.div>
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
              <PageCard className="w-full shadow-lg">
                <div className="text-center mb-8">
                  <h1 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-[hsl(var(--foreground))] to-[hsl(var(--primary))] bg-clip-text text-transparent">
                    Vælg din pakke
                  </h1>
                  <p className="text-[hsl(var(--muted))] text-lg">
                    Vælg den pakke der passer bedst til din klub
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-[hsl(var(--danger)/.1)] border border-[hsl(var(--danger)/.3)] rounded-lg"
                  >
                    <p className="text-sm text-[hsl(var(--danger))] font-medium">{error}</p>
                  </motion.div>
                )}

                {/* Billing Period Toggle */}
                <div className="flex items-center justify-center gap-4 mb-8 p-4 bg-[hsl(var(--surface-2))] rounded-xl">
                  <span className={`text-sm font-medium transition-colors ${signupData.billingPeriod === 'monthly' ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted))]'}`}>
                    Månedlig
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSignupData(prev => ({
                        ...prev,
                        billingPeriod: prev.billingPeriod === 'monthly' ? 'yearly' : 'monthly'
                      }))
                    }}
                    className={`relative inline-flex h-9 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 ${
                      signupData.billingPeriod === 'yearly' ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--line))]'
                    }`}
                    aria-label="Skift mellem månedlig og årlig betaling"
                  >
                    <span
                      className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-md transition-transform ${
                        signupData.billingPeriod === 'yearly' ? 'translate-x-8' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <div className="flex flex-col">
                    <span className={`text-sm font-medium transition-colors ${signupData.billingPeriod === 'yearly' ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted))]'}`}>
                      Årlig
                    </span>
                    {signupData.billingPeriod === 'yearly' && (
                      <span className="text-xs text-[hsl(var(--success))] font-medium">Spar 10%</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {pricingPlans
                    .filter(p => p.id !== 'enterprise')
                    .map((plan) => {
                      const price = signupData.billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
                      const monthlyEquivalent = signupData.billingPeriod === 'yearly' ? Math.round(plan.yearlyPrice / 12) : null
                      const isSelected = signupData.planId === plan.id
                      
                      return (
                        <motion.button
                          key={plan.id}
                          onClick={() => {
                            setSignupData(prev => ({ ...prev, planId: plan.id }))
                            setError(null)
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`p-6 rounded-xl border-2 transition-all text-left relative overflow-hidden ${
                            isSelected
                              ? 'border-[hsl(var(--primary))] bg-gradient-to-br from-[hsl(var(--primary)/.1)] to-[hsl(var(--primary)/.05)] shadow-md'
                              : 'border-[hsl(var(--line)/.3)] hover:border-[hsl(var(--primary)/.5)] bg-[hsl(var(--surface))]'
                          }`}
                        >
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-4 right-4"
                            >
                              <div className="w-8 h-8 bg-[hsl(var(--primary))] rounded-full flex items-center justify-center shadow-lg">
                                <CheckCircle2 className="w-5 h-5 text-white" />
                              </div>
                            </motion.div>
                          )}
                          
                          <div className="mb-3">
                            <h3 className="text-xl font-bold text-[hsl(var(--foreground))] mb-1">{plan.name}</h3>
                            <p className="text-sm text-[hsl(var(--muted))]">{plan.description}</p>
                          </div>
                          
                          <div className="mb-4">
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-bold text-[hsl(var(--foreground))]">
                                {price} kr
                              </span>
                              <span className="text-base font-normal text-[hsl(var(--muted))]">
                                {signupData.billingPeriod === 'yearly' ? '/år' : '/måned'}
                              </span>
                            </div>
                            <p className="text-sm text-[hsl(var(--muted))] mt-1 h-5">
                              {monthlyEquivalent ? (
                                <>{monthlyEquivalent} kr/måned</>
                              ) : (
                                <span className="invisible">placeholder</span>
                              )}
                            </p>
                          </div>

                          <ul className="space-y-2 text-sm text-[hsl(var(--muted))]">
                            {plan.features.slice(0, 3).map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-[hsl(var(--success))] flex-shrink-0 mt-0.5" />
                                <span>{feature}</span>
                              </li>
                            ))}
                            {plan.features.length > 3 && (
                              <li className="text-xs text-[hsl(var(--muted))] pl-6">
                                + {plan.features.length - 3} flere funktioner
                              </li>
                            )}
                          </ul>
                        </motion.button>
                      )
                    })}
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleNext} disabled={!signupData.planId} className="px-8">
                    Fortsæt
                    <ArrowRight className="w-4 h-4 ml-2" />
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
              <PageCard className="w-full shadow-lg">
                <div className="text-center mb-8">
                  <h1 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-[hsl(var(--foreground))] to-[hsl(var(--primary))] bg-clip-text text-transparent">
                    Klub information
                  </h1>
                  <p className="text-[hsl(var(--muted))] text-lg">
                    Fortæl os lidt om din klub
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-[hsl(var(--danger)/.1)] border border-[hsl(var(--danger)/.3)] rounded-lg"
                  >
                    <p className="text-sm text-[hsl(var(--danger))] font-medium">{error}</p>
                  </motion.div>
                )}

                {selectedPlan && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-gradient-to-r from-[hsl(var(--primary)/.1)] to-[hsl(var(--primary)/.05)] border border-[hsl(var(--primary)/.2)] rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">
                        Valgt pakke: {selectedPlan.name}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted))]">
                        {signupData.billingPeriod === 'yearly' 
                          ? `${selectedPlan.yearlyPrice} kr/år (${Math.round(selectedPlan.yearlyPrice / 12)} kr/måned)`
                          : `${selectedPlan.monthlyPrice} kr/måned`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStep('plan')
                        setError(null)
                      }}
                      className="text-sm text-[hsl(var(--primary))] hover:underline font-medium whitespace-nowrap ml-4"
                    >
                      Ændr pakke
                    </button>
                  </motion.div>
                )}

                <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
                  <div>
                    <label htmlFor="clubName" className="block text-sm font-semibold mb-2 text-[hsl(var(--foreground))]">
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
                      className="w-full px-4 py-3 border-2 border-[hsl(var(--line))] rounded-xl bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-[hsl(var(--primary))] transition-all"
                      disabled={loading}
                    />
                    {tenantIdPreview && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 p-4 bg-gradient-to-r from-[hsl(var(--primary)/.1)] to-[hsl(var(--primary)/.05)] border border-[hsl(var(--primary)/.2)] rounded-xl"
                      >
                        <p className="text-xs text-[hsl(var(--muted))] mb-2 font-medium">
                          Din URL bliver:
                        </p>
                        <p className="text-sm font-mono text-[hsl(var(--foreground))] font-semibold">
                          <span className="text-[hsl(var(--muted))]">https://</span>
                          <span className="text-[hsl(var(--primary))]">{tenantIdPreview}</span>
                          <span className="text-[hsl(var(--muted))]">.rundeklar.dk</span>
                        </p>
                      </motion.div>
                    )}
                    {!tenantIdPreview && (
                      <p className="mt-2 text-xs text-[hsl(var(--muted))]">
                        Dette navn bruges til at oprette din unikke URL
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold mb-2 text-[hsl(var(--foreground))]">
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
                      className="w-full px-4 py-3 border-2 border-[hsl(var(--line))] rounded-xl bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-[hsl(var(--primary))] transition-all"
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
              <PageCard className="w-full shadow-lg">
                <div className="text-center mb-8">
                  <h1 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-[hsl(var(--foreground))] to-[hsl(var(--primary))] bg-clip-text text-transparent">
                    Opret adgangskode
                  </h1>
                  <p className="text-[hsl(var(--muted))] text-lg">
                    Vælg en sikker adgangskode til din konto
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-[hsl(var(--danger)/.1)] border border-[hsl(var(--danger)/.3)] rounded-lg"
                  >
                    <p className="text-sm text-[hsl(var(--danger))] font-medium">{error}</p>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="password" className="block text-sm font-semibold mb-2 text-[hsl(var(--foreground))]">
                      Adgangskode *
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={signupData.password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-[hsl(var(--line))] rounded-xl bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-[hsl(var(--primary))] transition-all"
                      disabled={loading}
                    />
                    {passwordErrors.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {passwordErrors.map((err, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-[hsl(var(--muted))]">
                            <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--danger))]" />
                            {err}
                          </li>
                        ))}
                      </ul>
                    )}
                    {passwordErrors.length === 0 && signupData.password && (
                      <p className="mt-2 text-xs text-[hsl(var(--success))] font-medium flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Adgangskoden opfylder alle krav
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-semibold mb-2 text-[hsl(var(--foreground))]">
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
                      className="w-full px-4 py-3 border-2 border-[hsl(var(--line))] rounded-xl bg-[hsl(var(--surface))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-[hsl(var(--primary))] transition-all"
                      disabled={loading}
                    />
                    {signupData.confirmPassword && signupData.password !== signupData.confirmPassword && (
                      <p className="mt-2 text-xs text-[hsl(var(--danger))] font-medium flex items-center gap-2">
                        <span>✕</span>
                        Adgangskoderne matcher ikke
                      </p>
                    )}
                    {signupData.confirmPassword && signupData.password === signupData.confirmPassword && (
                      <p className="mt-2 text-xs text-[hsl(var(--success))] font-medium flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Adgangskoderne matcher
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
              <PageCard className="w-full text-center shadow-lg">
                {/* Logo */}
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-6 flex justify-center"
                >
                  <img
                    src="/fulllogo_transparent_nobuffer_horizontal.png"
                    alt="Rundeklar"
                    className="h-12 sm:h-16 object-contain"
                  />
                </motion.div>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="mb-8"
                >
                  <div className="w-24 h-24 bg-gradient-to-br from-[hsl(var(--success)/.2)] to-[hsl(var(--primary)/.2)] rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <CheckCircle2 className="w-14 h-14 text-[hsl(var(--success))]" />
                  </div>
                </motion.div>
                
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl sm:text-4xl font-bold mb-4 bg-gradient-to-r from-[hsl(var(--foreground))] to-[hsl(var(--primary))] bg-clip-text text-transparent"
                >
                  Velkommen til Rundeklar!
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-lg text-[hsl(var(--muted))] mb-6"
                >
                  Din konto er blevet oprettet. Vi har sendt en bekræftelsesmail til <strong className="text-[hsl(var(--foreground))]">{signupData.email}</strong>.
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-[hsl(var(--muted))] mb-8"
                >
                  Klik på linket i emailen for at aktivere din konto og komme i gang.
                </motion.p>
                
                {createdTenantId && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="p-5 bg-gradient-to-r from-[hsl(var(--primary)/.1)] to-[hsl(var(--primary)/.05)] border border-[hsl(var(--primary)/.2)] rounded-xl mb-8"
                  >
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">
                      Din URL:
                    </p>
                    <p className="text-base font-mono text-[hsl(var(--primary))] font-bold">
                      {createdTenantId}.rundeklar.dk
                    </p>
                  </motion.div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      // Clear sessionStorage and navigate to clean URL (no query params)
                      if (typeof window !== 'undefined') {
                        sessionStorage.removeItem('signup_step')
                        sessionStorage.removeItem('signup_tenant_id')
                        sessionStorage.removeItem('signup_email')
                      }
                      // Navigate to root without query parameters
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


import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import PlayersPage from './routes/PlayersDB'
import CheckInPage from './routes/CheckIn'
import MatchProgramPage from './routes/MatchProgram'
import StatisticsPage from './routes/Statistics'
import LandingPage from './routes/LandingPage'
import PrismTestPage from './routes/PrismTest'
import GlassSurface from './components/GlassSurface'
import LoginPage from './routes/auth/Login'
import RegisterPage from './routes/auth/Register'
import VerifyEmailPage from './routes/auth/VerifyEmail'
import ForgotPasswordPage from './routes/auth/ForgotPassword'
import ResetPasswordPage from './routes/auth/ResetPassword'
import AccountSettingsPage from './routes/auth/AccountSettings'
import { SidebarItem } from './components/navigation/SidebarItem'
import { UserCheck, UsersRound, Grid2x2, BarChart3, Menu, X, PlayCircle, User, LogOut } from 'lucide-react'
import { TenantProvider, useTenant } from './contexts/TenantContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { extractTenantId } from './lib/tenant'
import { Button } from './components/ui'

/**
 * Component that updates document title.
 * Always sets title to "Rundeklar" for consistent branding.
 */
const TenantTitleUpdater = () => {
  useEffect(() => {
    document.title = 'Rundeklar'
  }, [])
  
  return null
}

/**
 * Header component — app branding and primary navigation.
 * @remarks Renders logo and centered nav; uses absolute positioning for layout.
 * Uses tenant context for dynamic branding.
 * Mobile/tablet: Hamburger menu with slide-out navigation
 * Desktop: Horizontal navigation bar
 */
const Header = () => {
  const { config, buildPath } = useTenant()
  const { isAuthenticated, club, logout } = useAuth()
  const logoPath = `${import.meta.env.BASE_URL}${config.logo}`
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isMenuOpen])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isMenuOpen && menuRef.current && !menuRef.current.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
      if (isUserMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen, isUserMenuOpen])

  // Close menu when route changes (mobile)
  const location = useLocation()
  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  const navItems = [
    { to: buildPath('/coach'), icon: <PlayCircle />, label: 'Træner' },
    { to: buildPath('/check-in'), icon: <UserCheck />, label: 'Indtjekning' },
    { to: buildPath('/match-program'), icon: <Grid2x2 />, label: 'Kampprogram' },
    { to: buildPath('/players'), icon: <UsersRound />, label: 'Spillere' },
    { to: buildPath('/statistics'), icon: <BarChart3 />, label: 'Statistik' }
  ]

  return (
    <>
      <header className="relative z-10" style={{ willChange: 'transform' }}>
        <GlassSurface
          width="100%"
          height="auto"
          borderRadius={0}
          backgroundOpacity={0.25}
          blur={16}
          brightness={105}
          opacity={0.9}
          saturation={1.6}
          displace={0}
          distortionScale={0}
          className="relative"
          style={{ minHeight: '64px', transform: 'translateZ(0)' }}
        >
          <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 w-full">
            {/* Left section: Logo */}
            <div className="flex items-center flex-shrink-0">
              <Link 
                to={buildPath('/coach')}
                className="flex items-center flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
                aria-label={`Gå til ${config.name} startside`}
              >
                <img 
                  src={logoPath} 
                  alt={config.name} 
                  className="h-10 sm:h-12 flex-shrink-0 object-contain" 
                />
              </Link>
            </div>

            {/* Desktop: Horizontal navigation - absolutely positioned and centered */}
            <nav 
              aria-label="Primær navigation" 
              className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1 xl:gap-2 z-10"
              style={{ 
                width: 'max-content',
                minWidth: 'max-content',
                pointerEvents: 'auto'
              }}
            >
              {navItems.map((item) => (
                <SidebarItem key={item.to} to={item.to} icon={item.icon} label={item.label} />
              ))}
            </nav>

            {/* Mobile/Tablet: Hamburger menu button */}
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 rounded-md text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2))] transition-colors focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] outline-none flex-shrink-0"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMenuOpen ? 'Luk menu' : 'Åbn menu'}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Desktop: Right section - User menu or login */}
            <div className="hidden lg:flex items-center justify-end flex-shrink-0" style={{ width: '200px', minWidth: '200px', flexBasis: '200px' }}>
              {isAuthenticated ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[hsl(var(--surface-2))] transition-colors whitespace-nowrap"
                    aria-label="Bruger menu"
                  >
                    <User size={20} />
                    <span className="text-sm truncate max-w-[120px]">{club?.email}</span>
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-[hsl(var(--surface)/.85)] backdrop-blur-md border border-[hsl(var(--line))] rounded-md shadow-lg z-50">
                      <Link
                        to={buildPath('/account')}
                        className="block px-4 py-2 hover:bg-[hsl(var(--surface-2))] text-sm"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <div className="flex items-center gap-2">
                          <User size={16} />
                          Kontoindstillinger
                        </div>
                      </Link>
                      <button
                        onClick={() => {
                          logout()
                          setIsUserMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-[hsl(var(--surface-2))] text-sm text-red-600 dark:text-red-400"
                      >
                        <div className="flex items-center gap-2">
                          <LogOut size={16} />
                          Log ud
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link to={buildPath('/login')} className="flex-shrink-0">
                  <Button size="sm">Log ind</Button>
                </Link>
              )}
            </div>
          </div>
        </GlassSurface>
      </header>

      {/* Mobile/Tablet: Slide-out menu */}
      <div
        ref={menuRef}
        id="mobile-menu"
        className={`lg:hidden fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] bg-[hsl(var(--surface)/.85)] backdrop-blur-md shadow-xl transform transition-transform duration-300 ease-in-out ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!isMenuOpen}
      >
        <div className="flex flex-col h-full">
          {/* Menu header */}
          <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--line)/.12)]">
            <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Menu</h2>
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="p-2 rounded-md text-[hsl(var(--muted))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--foreground))] transition-colors focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] outline-none"
              aria-label="Luk menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 overflow-y-auto p-4" aria-label="Navigation">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <SidebarItem 
                  key={item.to} 
                  to={item.to} 
                  icon={item.icon} 
                  label={item.label}
                  className="w-full justify-start px-4 py-3 rounded-lg"
                />
              ))}
            </div>
          </nav>
        </div>
      </div>

      {/* Backdrop overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}

/**
 * Inner app component that uses tenant context.
 * @remarks Extracts tenant ID from URL and provides tenant context to routes.
 */
const AppInner = () => {
  const location = useLocation()
  
  // Extract tenant ID from hash (HashRouter) or pathname (BrowserRouter)
  const hash = location.hash || ''
  const pathname = location.pathname || ''
  const actualPath = hash ? hash.replace(/^#/, '') : pathname
  const tenantId = extractTenantId(actualPath)

  // Check if current route is an auth route (should hide header)
  const isAuthRoute = /^\/([^/]+\/)?(login|register|verify-email|forgot-password|reset-password)(\/|$)/.test(actualPath)
  
  return (
    <TenantProvider tenantId={tenantId}>
      <AuthProvider>
        <TenantTitleUpdater />
        <div className="flex min-h-screen flex-col text-[hsl(var(--foreground))] overflow-x-hidden max-w-full relative">
          {!isAuthRoute && <Header />}
          <main className="flex-1 overflow-y-auto overflow-x-hidden max-w-full relative z-0">
            <div className="flex w-full flex-col gap-4 sm:gap-6 px-4 sm:px-6 pb-6 sm:pb-10 pt-4 sm:pt-6 md:px-8 lg:px-12 max-w-full overflow-x-hidden">
              <Routes>
                {/* Auth routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/account" element={<ProtectedRoute><AccountSettingsPage /></ProtectedRoute>} />
                
                {/* Tenant-prefixed auth routes */}
                <Route path="/:tenantId/login" element={<LoginPage />} />
                <Route path="/:tenantId/register" element={<RegisterPage />} />
                <Route path="/:tenantId/verify-email" element={<VerifyEmailPage />} />
                <Route path="/:tenantId/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/:tenantId/reset-password" element={<ResetPasswordPage />} />
                <Route path="/:tenantId/account" element={<ProtectedRoute><AccountSettingsPage /></ProtectedRoute>} />

                {/* Main app routes */}
                <Route path="/coach" element={<LandingPage onRedirectToCheckin={() => {
                  const target = tenantId && tenantId !== 'default' ? `#/${tenantId}/check-in` : '#/check-in'
                  window.location.hash = target
                }} />} />
                <Route path="/players" element={<PlayersPage />} />
                <Route path="/check-in" element={<CheckInPage />} />
                <Route path="/match-program" element={<MatchProgramPage />} />
                <Route path="/statistics" element={<StatisticsPage />} />
                <Route path="/prism-test" element={<PrismTestPage />} />
                
                {/* Tenant-prefixed routes */}
                <Route path="/:tenantId/coach" element={<LandingPage onRedirectToCheckin={() => {
                  const id = tenantId && tenantId !== 'default' ? tenantId : 'default'
                  window.location.hash = id === 'default' ? '#/check-in' : `#/${id}/check-in`
                }} />} />
                <Route path="/:tenantId/players" element={<PlayersPage />} />
                <Route path="/:tenantId/check-in" element={<CheckInPage />} />
                <Route path="/:tenantId/match-program" element={<MatchProgramPage />} />
                <Route path="/:tenantId/statistics" element={<StatisticsPage />} />
                
                {/* Root route - redirect to coach to ensure clean home screen URL */}
                <Route path="/" element={<Navigate to={tenantId === 'rundemanager' ? '/rundemanager/coach' : '/coach'} replace />} />
                
                <Route path="*" element={<Navigate to={tenantId === 'rundemanager' ? '/rundemanager/coach' : '/coach'} replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </AuthProvider>
    </TenantProvider>
  )
}

/**
 * Main app component — router and layout wrapper.
 * @remarks Sets up HashRouter and renders header + main content area with tenant support.
 */
const App = () => {
  return (
    <HashRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <AppInner />
    </HashRouter>
  )
}

export default App

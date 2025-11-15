import { useState, useEffect, useRef } from 'react'
import PlayersPage from './routes/PlayersDB'
import CheckInPage from './routes/CheckIn'
import MatchProgramPage from './routes/MatchProgram'
import StatisticsPage from './routes/Statistics'
import LandingPage from './routes/LandingPage'
import PrismTestPage from './routes/PrismTest'
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
import { NavigationProvider, useNavigation } from './contexts/NavigationContext'
import { getCurrentTenantId } from './lib/tenant'
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
  const { config } = useTenant()
  const { isAuthenticated, club, logout } = useAuth()
  const { navigate, navigateToAuth } = useNavigation()
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

  // Close menu when page changes (mobile)
  const { currentPage } = useNavigation()
  useEffect(() => {
    setIsMenuOpen(false)
  }, [currentPage])

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
    { page: 'coach' as const, icon: <PlayCircle />, label: 'Træner' },
    { page: 'check-in' as const, icon: <UserCheck />, label: 'Indtjekning' },
    { page: 'rounds' as const, icon: <Grid2x2 />, label: 'Runder' },
    { page: 'players' as const, icon: <UsersRound />, label: 'Spillere' },
    { page: 'statistics' as const, icon: <BarChart3 />, label: 'Statistik' }
  ]

  return (
    <>
      <header 
        className="relative z-10 fullscreen-hide border-b" 
        style={{ 
          transform: 'translateZ(0)',
          background: 'linear-gradient(to right, rgba(240, 245, 250, 0.29), rgba(245, 248, 252, 0.29))',
          backdropFilter: 'blur(14px) saturate(155%) brightness(105%)',
          WebkitBackdropFilter: 'blur(14px) saturate(155%) brightness(105%)',
          borderColor: 'rgba(230, 235, 240, 0.5)',
          boxShadow: `
            0 1px 3px rgba(0, 0, 0, 0.08),
            0 4px 12px rgba(0, 0, 0, 0.04),
            inset 0 1px 0 rgba(250, 252, 255, 0.6),
            inset 0 -1px 0 rgba(230, 235, 240, 0.25)
          `,
          borderTop: '1px solid rgba(240, 245, 250, 0.7)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
        }}
      >
        <div className="relative flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 w-full" style={{ minHeight: '64px', position: 'relative' }}>
            {/* Left section: Logo */}
            <div className="flex items-center flex-shrink-0">
              <button
                type="button"
                onClick={() => navigate('coach')}
                className="flex items-center flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
                aria-label={`Gå til ${config.name} startside`}
              >
                <img 
                  src={logoPath} 
                  alt={config.name} 
                  className="h-10 sm:h-12 flex-shrink-0 object-contain" 
                />
              </button>
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
                <SidebarItem key={item.page} page={item.page} icon={item.icon} label={item.label} />
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
                    <div className="absolute right-0 mt-2 w-48 bg-[hsl(var(--surface))] border border-[hsl(var(--line))] rounded-md shadow-lg z-50">
                      <button
                        type="button"
                        onClick={() => {
                          navigateToAuth('account')
                          setIsUserMenuOpen(false)
                        }}
                        className="w-full text-left block px-4 py-2 hover:bg-[hsl(var(--surface-2))] text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <User size={16} />
                          Kontoindstillinger
                        </div>
                      </button>
                      <button
                        type="button"
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
                <button
                  type="button"
                  onClick={() => navigateToAuth('login')}
                  className="flex-shrink-0"
                >
                  <Button size="sm">Log ind</Button>
                </button>
              )}
            </div>
          </div>
      </header>

      {/* Mobile/Tablet: Slide-out menu */}
      <div
        ref={menuRef}
        id="mobile-menu"
        className={`lg:hidden fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] bg-[hsl(var(--surface))] shadow-xl transform transition-transform duration-300 ease-in-out ${
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
                  key={item.page} 
                  page={item.page} 
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
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}

/**
 * Inner app component that uses tenant context and navigation.
 * @remarks Uses NavigationProvider for state-based navigation (URL stays at root).
 */
const AppInner = () => {
  // Extract tenant ID from hostname (demo detection) or default to 'default'
  const tenantId = getCurrentTenantId()
  
  return (
    <TenantProvider tenantId={tenantId}>
      <AuthProvider>
        <NavigationProvider>
          <AppContent />
        </NavigationProvider>
      </AuthProvider>
    </TenantProvider>
  )
}

/**
 * Main app content component that renders based on navigation state.
 */
const AppContent = () => {
  const { currentPage, authPage, isAuthRoute, navigate } = useNavigation()
  
  return (
    <>
        <TenantTitleUpdater />
        <div className="flex min-h-screen flex-col text-[hsl(var(--foreground))] overflow-x-hidden max-w-full relative">
          {!isAuthRoute && <Header />}
          <main className="flex-1 overflow-y-auto overflow-x-hidden max-w-full relative z-0">
            <div className="flex w-full flex-col gap-4 sm:gap-6 px-4 sm:px-6 pb-6 sm:pb-10 pt-4 sm:pt-6 md:px-8 lg:px-12 max-w-full overflow-x-hidden">
            {/* Auth pages */}
            {authPage === 'login' && <LoginPage />}
            {authPage === 'register' && <RegisterPage />}
            {authPage === 'verify-email' && <VerifyEmailPage />}
            {authPage === 'forgot-password' && <ForgotPasswordPage />}
            {authPage === 'reset-password' && <ResetPasswordPage />}
            {authPage === 'account' && <ProtectedRoute><AccountSettingsPage /></ProtectedRoute>}
            
            {/* Main app pages */}
            {!isAuthRoute && currentPage === 'coach' && (
              <LandingPage onRedirectToCheckin={() => navigate('check-in')} />
            )}
            {!isAuthRoute && currentPage === 'check-in' && <CheckInPage />}
            {!isAuthRoute && (currentPage === 'rounds' || currentPage === 'match-program') && <MatchProgramPage />}
            {!isAuthRoute && currentPage === 'players' && <PlayersPage />}
            {!isAuthRoute && currentPage === 'statistics' && <StatisticsPage />}
            {!isAuthRoute && currentPage === 'prism-test' && <PrismTestPage />}
            </div>
          </main>
        </div>
    </>
  )
}

/**
 * Main app component — layout wrapper.
 * @remarks Uses state-based navigation (URL stays at root) with tenant support.
 */
const App = () => {
  return <AppInner />
}

export default App

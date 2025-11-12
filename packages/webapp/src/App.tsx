import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import PlayersPage from './routes/PlayersDB'
import CheckInPage from './routes/CheckIn'
import MatchProgramPage from './routes/MatchProgram'
import StatisticsPage from './routes/Statistics'
import LandingPage from './routes/LandingPage'
import { SidebarItem } from './components/navigation/SidebarItem'
import { UserCheck, UsersRound, Grid2x2, BarChart3, Menu, X, PlayCircle } from 'lucide-react'
import { TenantProvider, useTenant } from './contexts/TenantContext'
import { extractTenantId } from './lib/tenant'

/**
 * Header component — app branding and primary navigation.
 * @remarks Renders logo and centered nav; uses absolute positioning for layout.
 * Uses tenant context for dynamic branding.
 * Mobile/tablet: Hamburger menu with slide-out navigation
 * Desktop: Horizontal navigation bar
 */
const Header = () => {
  const { config, buildPath } = useTenant()
  const logoPath = `${import.meta.env.BASE_URL}${config.logo}`
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

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
      <header className="relative flex items-center justify-between ring-1 ring-[hsl(var(--line)/.12)] bg-[hsl(var(--surface)/.7)] px-3 sm:px-6 py-3 sm:py-4 backdrop-blur shadow-[inset_0_-1px_0_hsl(var(--line)/.08)]">
        {/* Left section: Logo and title */}
        <Link 
          to={buildPath('/coach')}
          className="flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-0 hover:opacity-80 transition-opacity cursor-pointer"
          aria-label={`Gå til ${config.name} startside`}
        >
          <img 
            src={logoPath} 
            alt={config.name} 
            className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full ring-1 ring-[hsl(var(--line)/.2)] object-cover flex-shrink-0" 
          />
          <p className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold uppercase tracking-wide text-[hsl(var(--foreground))] whitespace-nowrap truncate">
            {config.name}
          </p>
        </Link>

        {/* Desktop: Horizontal navigation - absolutely positioned and centered */}
        <nav 
          aria-label="Primær navigation" 
          className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1 xl:gap-2"
          style={{ 
            width: 'max-content',
            minWidth: 'max-content'
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
          className="lg:hidden p-2 rounded-md text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2))] transition-colors focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] outline-none"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          aria-label={isMenuOpen ? 'Luk menu' : 'Åbn menu'}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Desktop: Right spacer for balance */}
        <div className="hidden lg:block flex-shrink-0" style={{ width: '200px' }} aria-hidden="true" />
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

  return (
    <TenantProvider tenantId={tenantId}>
      <div className="flex min-h-screen flex-col text-[hsl(var(--foreground))] overflow-x-hidden max-w-full">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden max-w-full">
          <div className="flex w-full flex-col gap-4 sm:gap-6 px-4 sm:px-6 pb-6 sm:pb-10 pt-4 sm:pt-6 md:px-8 lg:px-12 max-w-full overflow-x-hidden">
            <Routes>
              <Route path="/coach" element={<LandingPage onRedirectToCheckin={() => {
                // Navigate to check-in; rely on default session state.
                // For default tenant, use "/check-in"; otherwise include tenant prefix.
                const target = tenantId && tenantId !== 'default' ? `#/${tenantId}/check-in` : '#/check-in'
                window.location.hash = target
              }} />} />
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/check-in" element={<CheckInPage />} />
              <Route path="/match-program" element={<MatchProgramPage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
              {/* Support tenant-prefixed routes */}
              <Route path="/:tenantId/coach" element={<LandingPage onRedirectToCheckin={() => {
                const id = tenantId && tenantId !== 'default' ? tenantId : 'default'
                window.location.hash = id === 'default' ? '#/check-in' : `#/${id}/check-in`
              }} />} />
              <Route path="/:tenantId/players" element={<PlayersPage />} />
              <Route path="/:tenantId/check-in" element={<CheckInPage />} />
              <Route path="/:tenantId/match-program" element={<MatchProgramPage />} />
              <Route path="/:tenantId/statistics" element={<StatisticsPage />} />
              <Route path="*" element={<Navigate to="/coach" replace />} />
            </Routes>
          </div>
        </main>
      </div>
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

import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import PlayersPage from './routes/PlayersDB'
import CheckInPage from './routes/CheckIn'
import MatchProgramPage from './routes/MatchProgram'
import StatisticsPage from './routes/Statistics'
import { SidebarItem } from './components/navigation/SidebarItem'
import { UserCheck, UsersRound, Grid2x2, BarChart3 } from 'lucide-react'
import { TenantProvider, useTenant } from './contexts/TenantContext'
import { extractTenantId, buildTenantPath } from './lib/tenant'

/**
 * Header component — app branding and primary navigation.
 * @remarks Renders logo and centered nav; uses absolute positioning for layout.
 * Uses tenant context for dynamic branding.
 */
const Header = () => {
  const { config, buildPath } = useTenant()
  const logoPath = `${import.meta.env.BASE_URL}${config.logo}`

  return (
    <header className="relative flex items-center ring-1 ring-[hsl(var(--line)/.12)] bg-[hsl(var(--surface)/.7)] px-3 sm:px-6 py-3 sm:py-4 backdrop-blur shadow-[inset_0_-1px_0_hsl(var(--line)/.08)]">
      {/* Left section: Logo and text */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <img 
          src={logoPath} 
          alt={config.name} 
          className="h-10 w-10 sm:h-12 sm:w-12 rounded-full ring-1 ring-[hsl(var(--line)/.2)] object-cover flex-shrink-0" 
        />
        <p className="text-sm sm:text-lg font-semibold uppercase tracking-wide text-[hsl(var(--foreground))] whitespace-nowrap">
          {config.name}
        </p>
      </div>

      {/* Center section: Navigation - absolutely positioned and centered */}
      {/* A11y: Navigation landmark with aria-label for screen readers */}
      <nav 
        aria-label="Primær navigation" 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2 max-w-[calc(100vw-200px)] sm:max-w-none"
        style={{ width: 'min(620px, calc(100vw - 200px))' }}
      >
        <SidebarItem to={buildPath('/check-in')} icon={<UserCheck />} label="Indtjekning" />
        <SidebarItem to={buildPath('/match-program')} icon={<Grid2x2 />} label="Kampprogram" />
        <SidebarItem to={buildPath('/players')} icon={<UsersRound />} label="Spillere" />
        <SidebarItem to={buildPath('/statistics')} icon={<BarChart3 />} label="Statistik" />
      </nav>

      {/* Right section: Spacer for balance */}
      <div className="hidden sm:block flex-shrink-0" style={{ width: '200px' }} aria-hidden="true">
        {/* Empty spacer */}
      </div>
    </header>
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
      <div className="flex min-h-screen flex-col text-[hsl(var(--foreground))]">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="flex w-full flex-col gap-4 sm:gap-6 px-4 sm:px-6 pb-6 sm:pb-10 pt-4 sm:pt-6 md:px-8 lg:px-12">
            <Routes>
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/check-in" element={<CheckInPage />} />
              <Route path="/match-program" element={<MatchProgramPage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
              {/* Support tenant-prefixed routes */}
              <Route path="/:tenantId/players" element={<PlayersPage />} />
              <Route path="/:tenantId/check-in" element={<CheckInPage />} />
              <Route path="/:tenantId/match-program" element={<MatchProgramPage />} />
              <Route path="/:tenantId/statistics" element={<StatisticsPage />} />
              <Route path="*" element={<Navigate to="/check-in" replace />} />
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
    <HashRouter>
      <AppInner />
    </HashRouter>
  )
}

export default App

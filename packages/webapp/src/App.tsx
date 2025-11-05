import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import PlayersPage from './routes/PlayersDB'
import CheckInPage from './routes/CheckIn'
import MatchProgramPage from './routes/MatchProgram'
import StatisticsPage from './routes/Statistics'
import { SidebarItem } from './components/navigation/SidebarItem'
import { UserCheck, UsersRound, Grid2x2, BarChart3 } from 'lucide-react'

/**
 * Header component — app branding and primary navigation.
 * @remarks Renders logo and centered nav; uses absolute positioning for layout.
 */
const Header = () => {
  return (
    <header className="relative flex items-center ring-1 ring-[hsl(var(--line)/.12)] bg-[hsl(var(--surface)/.7)] px-6 py-4 backdrop-blur shadow-[inset_0_-1px_0_hsl(var(--line)/.08)]">
      {/* Left section: Logo and text */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <img 
          src="/logo.jpeg" 
          alt="Herlev/Hjorten" 
          className="h-12 w-12 rounded-full ring-1 ring-[hsl(var(--line)/.2)] object-cover flex-shrink-0" 
        />
        <p className="text-lg font-semibold uppercase tracking-wide text-[hsl(var(--foreground))] whitespace-nowrap">
          HERLEV/HJORTEN
        </p>
      </div>

      {/* Center section: Navigation - absolutely positioned and centered */}
      {/* A11y: Navigation landmark with aria-label for screen readers */}
      <nav 
        aria-label="Primær navigation" 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2"
        style={{ width: '620px' }}
      >
        <SidebarItem to="/check-in" icon={<UserCheck />} label="Indtjekning" />
        <SidebarItem to="/match-program" icon={<Grid2x2 />} label="Kampprogram" />
        <SidebarItem to="/players" icon={<UsersRound />} label="Spillere" />
        <SidebarItem to="/statistics" icon={<BarChart3 />} label="Statistik" />
      </nav>

      {/* Right section: Spacer for balance */}
      <div className="flex-shrink-0" style={{ width: '200px' }} aria-hidden="true">
        {/* Empty spacer */}
      </div>
    </header>
  )
}

/**
 * Main app component — router and layout wrapper.
 * @remarks Sets up HashRouter and renders header + main content area.
 */
const App = () => {
  return (
    <HashRouter>
      <div className="flex min-h-screen flex-col text-[hsl(var(--foreground))]">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="flex w-full flex-col gap-6 px-6 pb-10 pt-6 md:px-8 lg:px-12">
            <Routes>
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/check-in" element={<CheckInPage />} />
              <Route path="/match-program" element={<MatchProgramPage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
              <Route path="*" element={<Navigate to="/check-in" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  )
}

export default App

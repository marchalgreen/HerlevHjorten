import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import PlayersPage from './routes/Players'
import CheckInPage from './routes/CheckIn'
import CoachPage from './routes/Coach'
import { SidebarItem } from './components/navigation/SidebarItem'
import { Search, UsersRound, Grid2x2 } from 'lucide-react'

const SidebarNav = () => {
  return (
    <nav aria-label="Primær navigation" className="nav-list">
      <SidebarItem to="/check-in" icon={<Search />} label="Check ind" />
      <SidebarItem to="/coach" icon={<Grid2x2 />} label="Kampprogram" />
      <SidebarItem to="/players" icon={<UsersRound />} label="Spillere" />
    </nav>
  )
}

const navItems = [
  { to: '/check-in', label: 'Check ind', icon: <Search size={18} /> },
  { to: '/coach', label: 'Kampprogram', icon: <Grid2x2 size={18} /> },
  { to: '/players', label: 'Spillere', icon: <UsersRound size={18} /> }
]

const MobileNav = () => {
  return (
    <div className="md:hidden card-glass-active ring-1 ring-[hsl(var(--line)/.12)] px-3 py-2">
      <nav aria-label="Primær navigation" className="nav-list">
        <SidebarItem to="/check-in" icon={<Search />} label="Check ind" />
        <SidebarItem to="/coach" icon={<Grid2x2 />} label="Kampprogram" />
        <SidebarItem to="/players" icon={<UsersRound />} label="Spillere" />
      </nav>
    </div>
  )
}

const Header = () => {
  const location = useLocation()
  const current = useMemo(() => navItems.find((item) => location.pathname.includes(item.to.replace('#', ''))), [location.pathname])
  return (
    <header className="flex items-center justify-between gap-4 ring-1 ring-[hsl(var(--line)/.12)] bg-[hsl(var(--surface)/.7)] px-6 py-4 backdrop-blur shadow-[inset_0_-1px_0_hsl(var(--line)/.08)]">
      <div>
        <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted))]">Herlev/Hjorten</p>
        <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">{current?.label ?? 'Oversigt'}</h1>
      </div>
    </header>
  )
}

const App = () => {
  return (
    <HashRouter>
      <div className="flex min-h-screen text-[hsl(var(--foreground))]">
        <aside className="hidden w-[360px] flex-col gap-8 p-8 md:flex sticky top-0 h-screen">
          <div className="u-glass h-full rounded-3xl p-8 flex flex-col">
            <div className="flex flex-col items-center gap-4 text-center">
              <img src="/logo.jpeg" alt="Herlev/Hjorten" className="h-20 w-20 rounded-full ring-1 ring-[hsl(var(--line)/.2)] object-cover" />
              <p className="max-w-full whitespace-nowrap overflow-hidden text-ellipsis text-2xl font-semibold uppercase tracking-wide text-[hsl(var(--foreground))]">
                Herlev/Hjorten
              </p>
            </div>
            <div className="mt-8">
              <SidebarNav />
            </div>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4 md:hidden">
            <Header />
          </div>
          <div className="px-4 pb-6 pt-4 md:hidden">
            <MobileNav />
          </div>
          <div className="hidden md:block">
            <Header />
          </div>
          <div className="flex w-full flex-col gap-6 px-4 pb-10 pt-6 md:px-6">
            <Routes>
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/check-in" element={<CheckInPage />} />
              <Route path="/coach" element={<CoachPage />} />
              <Route path="*" element={<Navigate to="/check-in" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  )
}

export default App

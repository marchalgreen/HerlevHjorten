import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Page = 'coach' | 'check-in' | 'rounds' | 'match-program' | 'players' | 'statistics' | 'prism-test'
type AuthPage = 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password' | 'account'

interface NavigationContextType {
  currentPage: Page
  authPage: AuthPage | null
  setCurrentPage: (page: Page) => void
  setAuthPage: (page: AuthPage | null) => void
  navigate: (page: Page) => void
  navigateToAuth: (page: AuthPage) => void
  isAuthRoute: boolean
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

export const useNavigation = () => {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}

interface NavigationProviderProps {
  children: ReactNode
  initialPage?: Page
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ 
  children, 
  initialPage = 'coach' 
}) => {
  const [currentPage, setCurrentPage] = useState<Page>(initialPage)
  const [authPage, setAuthPage] = useState<AuthPage | null>(null)

  const navigate = (page: Page) => {
    setCurrentPage(page)
    setAuthPage(null)
    // Keep URL clean - don't update hash or pathname
    // URL will always stay at root (e.g., rundeklar.vercel.app)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  const navigateToAuth = (page: AuthPage) => {
    setAuthPage(page)
    setCurrentPage('coach') // Reset to coach when navigating to auth
    // Keep URL clean
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  const isAuthRoute = authPage !== null

  // Initialize from URL hash if present (for backward compatibility)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#/, '')
      if (hash) {
        const path = hash.split('/').pop() || ''
        const knownPages: Page[] = ['coach', 'check-in', 'rounds', 'match-program', 'players', 'statistics', 'prism-test']
        // Handle redirect from old route
        if (path === 'match-program') {
          setCurrentPage('rounds')
          setAuthPage(null)
          window.history.replaceState(null, '', window.location.pathname)
          return
        }
        const knownAuthPages: AuthPage[] = ['login', 'register', 'verify-email', 'forgot-password', 'reset-password', 'account']
        
        if (knownPages.includes(path as Page)) {
          setCurrentPage(path as Page)
          setAuthPage(null)
          // Clear hash to keep URL clean
          window.history.replaceState(null, '', window.location.pathname)
        } else if (knownAuthPages.includes(path as AuthPage)) {
          setAuthPage(path as AuthPage)
          setCurrentPage('coach')
          // Clear hash to keep URL clean
          window.history.replaceState(null, '', window.location.pathname)
        }
      }
    }
  }, [])

  return (
    <NavigationContext.Provider value={{ 
      currentPage, 
      authPage,
      setCurrentPage, 
      setAuthPage,
      navigate, 
      navigateToAuth,
      isAuthRoute 
    }}>
      {children}
    </NavigationContext.Provider>
  )
}


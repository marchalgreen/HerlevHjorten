import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Page = 'coach' | 'check-in' | 'rounds' | 'match-program' | 'players' | 'statistics' | 'prism-test' | 'admin'
type AuthPage = 'login' | 'register' | 'verify-email' | 'forgot-password' | 'forgot-pin' | 'reset-password' | 'reset-pin' | 'account'

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

  // Initialize from URL hash or pathname (for email links and backward compatibility)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#/, '')
      const pathname = window.location.pathname
      const search = window.location.search
      
      // Check hash first (for backward compatibility and development mode)
      if (hash) {
        // Remove query params before matching
        const pathWithoutQuery = hash.split('?')[0]
        const path = pathWithoutQuery.split('/').pop() || ''
        
        // Extract token from hash if present (hash format: /tenant/verify-email?token=...)
        const hashQueryPart = hash.includes('?') ? hash.split('?')[1] : ''
        const hashSearchParams = hashQueryPart ? new URLSearchParams(hashQueryPart) : null
        const tokenFromHash = hashSearchParams?.get('token')
        
        const knownPages: Page[] = ['coach', 'check-in', 'rounds', 'match-program', 'players', 'statistics', 'prism-test', 'admin']
        // Handle redirect from old route
        if (path === 'match-program') {
          setCurrentPage('rounds')
          setAuthPage(null)
          window.history.replaceState(null, '', window.location.pathname)
          return
        }
        const knownAuthPages: AuthPage[] = ['login', 'register', 'verify-email', 'forgot-password', 'forgot-pin', 'reset-password', 'reset-pin', 'account']
        
        if (knownPages.includes(path as Page)) {
          setCurrentPage(path as Page)
          setAuthPage(null)
          // Clear hash to keep URL clean
          window.history.replaceState(null, '', window.location.pathname)
        } else if (knownAuthPages.includes(path as AuthPage)) {
          setAuthPage(path as AuthPage)
          setCurrentPage('coach')
          
          // CRITICAL: Store token from hash in sessionStorage BEFORE clearing hash
          // This ensures VerifyEmail/ResetPassword/etc can read token even after hash is cleared
          if (tokenFromHash) {
            if (path === 'verify-email') {
              sessionStorage.setItem('verify_email_token', tokenFromHash)
            } else if (path === 'reset-password') {
              sessionStorage.setItem('reset_password_token', tokenFromHash)
            } else if (path === 'reset-pin') {
              sessionStorage.setItem('reset_pin_token', tokenFromHash)
            }
          }
          
          // Don't clear hash for reset-pin/reset-password to preserve token in query params
          // But clear it for other auth pages (token is now in sessionStorage)
          if (path !== 'reset-pin' && path !== 'reset-password') {
            // Preserve token in URL search params when clearing hash
            if (tokenFromHash) {
              window.history.replaceState(null, '', `/?token=${tokenFromHash}`)
            } else {
              window.history.replaceState(null, '', window.location.pathname)
            }
          }
        }
        return // Hash takes precedence
      }
      
      // Check pathname for email links (e.g., /verify-email?token=...)
      // Only check if pathname is not root and has an auth page path
      if (pathname && pathname !== '/') {
        const pathWithoutQuery = pathname.split('?')[0]
        const path = pathWithoutQuery.replace(/^\//, '').split('/')[0] // Get first path segment
        const knownAuthPages: AuthPage[] = ['login', 'register', 'verify-email', 'forgot-password', 'forgot-pin', 'reset-password', 'reset-pin', 'account']
        
        if (knownAuthPages.includes(path as AuthPage)) {
          setAuthPage(path as AuthPage)
          setCurrentPage('coach')
          
          // For token-based auth pages, store token in sessionStorage BEFORE updating URL
          // This ensures VerifyEmail/ResetPassword/etc can read token even if URL update happens first
          if (search) {
            const searchParams = new URLSearchParams(search)
            const token = searchParams.get('token')
            if (token) {
              // Store token based on which auth page it is
              if (path === 'verify-email') {
                sessionStorage.setItem('verify_email_token', token)
              } else if (path === 'reset-password') {
                sessionStorage.setItem('reset_password_token', token)
              } else if (path === 'reset-pin') {
                sessionStorage.setItem('reset_pin_token', token)
              }
            }
          }
          
          // Preserve query params in URL for token-based auth pages
          // Clean up pathname but keep search params - redirect to root with query params
          if (search) {
            window.history.replaceState(null, '', `/${search}`)
          } else {
            window.history.replaceState(null, '', '/')
          }
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


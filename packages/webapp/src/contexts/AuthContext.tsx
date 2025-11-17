import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useTenant } from './TenantContext'

export interface Club {
  id: string
  email: string
  username?: string
  role: string
  tenantId: string
  emailVerified: boolean
  twoFactorEnabled: boolean
}

interface AuthContextValue {
  club: Club | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string, totpCode?: string) => Promise<void>
  loginWithPIN: (username: string, pin: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, password: string) => Promise<void>
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ACCESS_TOKEN_KEY = 'auth_access_token'
const REFRESH_TOKEN_KEY = 'auth_refresh_token'

/**
 * Auth context provider that manages authentication state
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenantId } = useTenant()
  const [club, setClub] = useState<Club | null>(null)
  const [loading, setLoading] = useState(true)

  const getApiUrl = useCallback((path: string) => {
    return import.meta.env.DEV 
      ? `http://127.0.0.1:3000/api/auth${path}`
      : `/api/auth${path}`
  }, [])

  const getAccessToken = useCallback(() => {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  }, [])

  const getRefreshToken = useCallback(() => {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  }, [])

  const setTokens = useCallback((accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  }, [])

  const clearTokens = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }, [])

  // Refresh access token
  const refreshToken = useCallback(async () => {
    const refresh = getRefreshToken()
    if (!refresh) {
      setClub(null)
      clearTokens()
      return
    }

    try {
      const response = await fetch(getApiUrl('/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: refresh })
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
      } else {
        // Refresh failed, logout
        setClub(null)
        clearTokens()
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      setClub(null)
      clearTokens()
    }
  }, [getRefreshToken, getApiUrl, clearTokens])

  // Fetch current club info
  const fetchClubInfo = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setClub(null)
      setLoading(false)
      return
    }

    try {
      const response = await fetch(getApiUrl('/me'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setClub(data.club)
      } else {
        // Token invalid, try refresh
        await refreshToken()
        // Retry with new token
        const newToken = getAccessToken()
        if (newToken) {
          const retryResponse = await fetch(getApiUrl('/me'), {
            headers: {
              'Authorization': `Bearer ${newToken}`
            }
          })
          if (retryResponse.ok) {
            const retryData = await retryResponse.json()
            setClub(retryData.club)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch club info:', error)
      setClub(null)
    } finally {
      setLoading(false)
    }
  }, [getAccessToken, getApiUrl, refreshToken])

  // Login with email/password (for admins)
  const login = useCallback(async (email: string, password: string, totpCode?: string) => {
    const response = await fetch(getApiUrl('/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        tenantId,
        totpCode
      })
    })

    const data = await response.json()

    if (!response.ok) {
      if (data.requires2FA) {
        // Return special error to indicate 2FA needed
        throw new Error('2FA_REQUIRED')
      }
      throw new Error(data.error || 'Login failed')
    }

    setTokens(data.accessToken, data.refreshToken)
    setClub(data.club)
  }, [tenantId, getApiUrl, setTokens])

  // Login with username/PIN (for coaches)
  const loginWithPIN = useCallback(async (username: string, pin: string) => {
    // Normalize username to lowercase for case-insensitive matching
    const normalizedUsername = username.toLowerCase().trim()
    
    const response = await fetch(getApiUrl('/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: normalizedUsername,
        pin,
        tenantId
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Login failed')
    }

    setTokens(data.accessToken, data.refreshToken)
    setClub(data.club)
  }, [tenantId, getApiUrl, setTokens])

  // Logout
  const logout = useCallback(async () => {
    const refresh = getRefreshToken()
    if (refresh) {
      try {
        await fetch(getApiUrl('/logout'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken: refresh })
        })
      } catch (error) {
        console.error('Logout request failed:', error)
      }
    }

    clearTokens()
    setClub(null)
  }, [getRefreshToken, getApiUrl, clearTokens])

  // Register
  const register = useCallback(async (email: string, password: string) => {
    const response = await fetch(getApiUrl('/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        tenantId
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed')
    }
  }, [tenantId, getApiUrl])

  // Initialize: check for existing token
  useEffect(() => {
    fetchClubInfo()
  }, [fetchClubInfo])

  // Auto-refresh token before expiry (every 14 minutes)
  useEffect(() => {
    if (!club) return

    const interval = setInterval(() => {
      refreshToken()
    }, 14 * 60 * 1000) // 14 minutes

    return () => clearInterval(interval)
  }, [club, refreshToken])

  const value: AuthContextValue = {
    club,
    loading,
    isAuthenticated: !!club,
    login,
    loginWithPIN,
    logout,
    register,
    refreshToken
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to access auth context
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}


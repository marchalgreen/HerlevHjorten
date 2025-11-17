import React, { useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigation } from '../../contexts/NavigationContext'
import { UserRole, hasMinimumRole } from '../../lib/auth/roles'

export interface ProtectedRouteProps {
  children: React.ReactNode
  requireRole?: UserRole | UserRole[] // Optional role requirement
  requireMinRole?: UserRole // Optional minimum role requirement
}

/**
 * Protected route component that requires authentication
 * Optionally requires specific role(s) or minimum role
 * Redirects to login if not authenticated or unauthorized
 */
export function ProtectedRoute({ 
  children, 
  requireRole,
  requireMinRole 
}: ProtectedRouteProps) {
  const { isAuthenticated, loading, club } = useAuth()
  const { navigateToAuth } = useNavigation()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigateToAuth('login')
    }
  }, [loading, isAuthenticated, navigateToAuth])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-[hsl(var(--muted))]">Indlæser...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect via useEffect
  }

  // Check role requirements
  if (club) {
    const userRole = club.role as UserRole

    // Check exact role requirement
    if (requireRole) {
      const requiredRoles = Array.isArray(requireRole) ? requireRole : [requireRole]
      if (!requiredRoles.includes(userRole)) {
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <p className="text-lg text-[hsl(var(--muted))]">Du har ikke adgang til denne side.</p>
            </div>
          </div>
        )
      }
    }

    // Check minimum role requirement
    if (requireMinRole && !hasMinimumRole(userRole, requireMinRole)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-lg text-[hsl(var(--muted))]">Du har ikke adgang til denne side.</p>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}


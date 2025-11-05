import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'

type Props = {
  to: string
  icon: React.ReactNode
  label: string
  /** Optional explicit active override. Otherwise inferred from route. */
  active?: boolean
  className?: string
}

/**
 * SidebarItem component — navigation link with active state.
 * @remarks A11y: Uses aria-current="page" when active.
 * Active state inferred from route if not explicitly provided.
 */
export function SidebarItem({ to, icon, label, active, className }: Props) {
  const location = useLocation()
  
  // Inferred from route if not explicitly provided
  const inferred = location.pathname === to || location.pathname.startsWith(to + '/')
  const isActive = typeof active === 'boolean' ? active : inferred

  return (
    <NavLink
      to={to}
      className={clsx('nav-item', className)}
      data-active={isActive ? 'true' : 'false'}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}


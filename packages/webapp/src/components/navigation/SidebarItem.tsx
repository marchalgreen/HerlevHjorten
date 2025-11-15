import React from 'react'
import { clsx } from 'clsx'
import { useNavigation } from '../../contexts/NavigationContext'

type Page = 'coach' | 'check-in' | 'rounds' | 'match-program' | 'players' | 'statistics'

type Props = {
  page: Page
  icon: React.ReactNode
  label: string
  /** Optional explicit active override. Otherwise inferred from current page. */
  active?: boolean
  className?: string
}

/**
 * SidebarItem component — navigation link with active state.
 * @remarks A11y: Uses aria-current="page" when active.
 * Active state inferred from current page if not explicitly provided.
 */
export function SidebarItem({ page, icon, label, active, className }: Props) {
  const { currentPage, navigate } = useNavigation()
  
  // Inferred from current page if not explicitly provided
  const inferred = currentPage === page
  const isActive = typeof active === 'boolean' ? active : inferred

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    navigate(page)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx('nav-item', className)}
      data-active={isActive ? 'true' : 'false'}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}


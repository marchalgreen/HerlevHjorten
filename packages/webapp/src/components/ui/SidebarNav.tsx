import React, { useMemo, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'

export type SidebarItem = {
  label: string
  to: string
  icon: React.ReactNode
}

export type SidebarNavProps = {
  items: SidebarItem[]
  orientation?: 'vertical' | 'horizontal'
  size?: 'sm' | 'lg'
}

/**
 * SidebarNav component — navigation with keyboard support (arrow keys).
 * @remarks A11y: Roving tabindex pattern — arrow keys navigate between items.
 */
export const SidebarNav = ({ items, orientation = 'vertical', size: _size = 'sm' }: SidebarNavProps) => {
  const location = useLocation()
  const refs = useRef<(HTMLAnchorElement | null)[]>([])

  const _activeIndex = useMemo(() => {
    const idx = items.findIndex((item) => location.pathname.includes(item.to.replace('#', '')))
    return idx === -1 ? 0 : idx
  }, [items, location.pathname])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const focusable = refs.current
    if (!focusable.length) return

    const currentIndex = focusable.findIndex((node) => node === document.activeElement)
    const nextIndex = (() => {
      if (event.key === 'ArrowDown' || (event.key === 'ArrowRight' && orientation === 'horizontal')) {
        return (currentIndex + 1) % focusable.length
      }
      if (event.key === 'ArrowUp' || (event.key === 'ArrowLeft' && orientation === 'horizontal')) {
        return (currentIndex - 1 + focusable.length) % focusable.length
      }
      return currentIndex
    })()

    if (nextIndex !== currentIndex && nextIndex >= 0) {
      event.preventDefault()
      focusable[nextIndex]?.focus()
    }
  }

  // A11y: Navigation landmark with keyboard support (arrow keys for roving tabindex)
  return (
    <div role="navigation" aria-label="Primær navigation" onKeyDown={handleKeyDown}>
      <ul className={clsx('flex gap-3', orientation === 'vertical' ? 'flex-col' : 'flex-row')}>
        {items.map((item, index) => (
          <li key={item.to}>
            <NavLink
              ref={(node: HTMLAnchorElement | null) => {
                refs.current[index] = node
              }}
              to={item.to}
            >
              {({ isActive }: { isActive: boolean }) => (
                <div data-active={isActive ? 'true' : 'false'} className="sidebar-pill">
                {item.icon}
              <span>{item.label}</span>
                </div>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

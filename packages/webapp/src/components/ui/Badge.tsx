import React from 'react'
import { clsx } from 'clsx'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'muted'

type BadgeProps = {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

/** Badge variant styles. */
const styles: Record<BadgeVariant, string> = {
  default: 'bg-[hsl(var(--surface-glass)/.9)] text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--line)/.12)]',
  success: 'bg-[hsl(var(--success)/.15)] text-[hsl(var(--success))]',
  warning: 'bg-[hsl(var(--warning)/.18)] text-[hsl(var(--warning))]',
  danger: 'bg-[hsl(var(--danger)/.18)] text-[hsl(var(--danger))]',
    muted: 'bg-[hsl(var(--surface-glass)/.7)] text-[hsl(var(--muted))]'
}

/**
 * Badge component — status badge with variants.
 * @remarks Renders small badge with success, warning, danger, muted, or default styles.
 */
export const Badge = ({ variant = 'default', children, className }: BadgeProps) => (
  <span
    className={clsx(
      'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium uppercase tracking-wide',
      styles[variant],
      className
    )}
  >
    {children}
  </span>
)

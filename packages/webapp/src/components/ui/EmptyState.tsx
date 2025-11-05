import React from 'react'
import { clsx } from 'clsx'

export type EmptyStateProps = {
  icon: React.ReactNode
  title: string
  helper: string
  action?: React.ReactNode
  className?: string
}

/**
 * EmptyState component — empty state UI with icon, title, helper text, and optional action.
 * @remarks Used when no data is available (e.g., no players, no matches).
 */
export const EmptyState = ({ icon, title, helper, action, className }: EmptyStateProps) => (
  <div className={clsx('flex flex-col items-center gap-3 text-center card-glass-inactive rounded-lg p-10', className)}>
    <div className="rounded-full bg-[hsl(var(--surface)/.6)] p-4 text-accent">{icon}</div>
    <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">{title}</h3>
    <p className="max-w-sm text-sm text-[hsl(var(--muted))]">{helper}</p>
    {action}
  </div>
)

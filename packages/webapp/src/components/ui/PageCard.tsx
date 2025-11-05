import React, { HTMLAttributes } from 'react'
import { clsx } from 'clsx'

export type PageCardProps = HTMLAttributes<HTMLDivElement> & {
  hover?: boolean
}

/**
 * PageCard component — glass-morphism card with optional hover effect.
 * @remarks Renders a card with backdrop blur and optional translate-y hover.
 */
export const PageCard = ({ className, hover = true, ...props }: PageCardProps) => (
  <div
    className={clsx(
      'card-glass-active ring-1 ring-[hsl(var(--line)/.12)] rounded-lg p-6 shadow-sm transition-transform',
      hover && 'hover:-translate-y-0.5',
      className
    )}
    {...props}
  />
)
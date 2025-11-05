import React, { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md'

/** Button component props. */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const baseClasses =
  'btn-press inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:ring-focus disabled:opacity-60 disabled:cursor-not-allowed'

const variantClasses: Record<ButtonVariant, string> = {
  // Subtle teal gradient + soft elevation
  primary:
    'text-[hsl(var(--primary-contrast))] ' +
    'bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary)/.9)_45%,hsl(var(--primary))_100%)] ' +
    'shadow-[0_2px_8px_hsl(var(--primary)/.22)] hover:shadow-[0_4px_16px_hsl(var(--primary)/.28)]',
  secondary:
    'bg-[hsl(var(--surface-glass)/.85)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.95)] ring-1 ring-[hsl(var(--line)/.12)]',
  ghost:
    'bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-glass)/.85)]',
  destructive:
    'bg-[hsl(var(--danger))] text-white hover:bg-[hsl(var(--danger)/.9)]'
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-md',
  md: 'h-11 px-5 text-base rounded-lg'
}

/**
 * Button component — accessible button with variants and loading state.
 * @remarks Supports primary, secondary, ghost, and destructive variants.
 * Shows loading spinner when loading prop is true.
 */
/* eslint-disable react/prop-types */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      <span>{children}</span>
    </button>
  )
)
/* eslint-enable react/prop-types */

Button.displayName = 'Button'
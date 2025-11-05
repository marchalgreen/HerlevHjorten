import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react'

export type ToastVariant = 'default' | 'success' | 'warning' | 'danger'

export type ToastOptions = {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

type ToastRecord = ToastOptions & { id: number }

/** Toast context value. */
type ToastContextValue = {
  notify: (options: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const variantStyles: Record<ToastVariant, string> = {
  default: 'bg-[hsl(var(--surface))] text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--line)/.12)]',
  success: 'bg-[hsl(var(--success)/.15)] text-[hsl(var(--success))]',
  warning: 'bg-[hsl(var(--warning)/.18)] text-[hsl(var(--warning))]',
  danger: 'bg-[hsl(var(--danger)/.18)] text-[hsl(var(--danger))]'
}

const variantIcon: Record<ToastVariant, React.ReactElement> = {
  default: React.createElement(Info, { size: 18 }),
  success: React.createElement(CheckCircle2, { size: 18 }),
  warning: React.createElement(TriangleAlert, { size: 18 }),
  danger: React.createElement(XCircle, { size: 18 })
}

/**
 * ToastProvider component — provides toast notification context.
 * @remarks Renders toasts in fixed bottom-left position with auto-dismiss.
 * Supports success, warning, danger, and default variants.
 */
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    ({ duration = 3200, variant = 'default', ...options }: ToastOptions) => {
      const id = Date.now()
      setToasts((current) => [...current, { id, variant, ...options }])
      window.setTimeout(() => remove(id), duration)
    },
    [remove]
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-6 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col-reverse gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              'pointer-events-auto rounded-lg p-4 shadow-lg ring-1 ring-[hsl(var(--line)/.2)] backdrop-blur-sm transition-all duration-200 ease-out',
              variantStyles[toast.variant ?? 'default']
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-current">{variantIcon[toast.variant ?? 'default']}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold">{toast.title}</div>
                {toast.description && <p className="mt-1 text-sm text-[hsl(var(--muted))]">{toast.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                className="text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                aria-label="Luk besked"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * useToast hook — returns toast notification function.
 * @returns Object with notify function
 * @throws Error if used outside ToastProvider
 */
export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

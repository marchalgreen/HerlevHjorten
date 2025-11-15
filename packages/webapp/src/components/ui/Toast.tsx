import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
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
 * @remarks Renders toasts in fixed top-right position with auto-dismiss.
 * Supports success, warning, danger, and default variants.
 */
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const timeoutsRef = useRef<Map<number, number>>(new Map())

  const remove = useCallback((id: number) => {
    // Clear timeout if it exists
    const timeoutId = timeoutsRef.current.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutsRef.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    ({ duration = 3200, variant = 'default', ...options }: ToastOptions) => {
      setToasts((current) => {
        // Prevent duplicate toasts with same title and description
        const isDuplicate = current.some(
          (toast) => toast.title === options.title && toast.description === options.description
        )
        if (isDuplicate) {
          return current
        }
        
        const id = Date.now()
        const newToast = { id, variant, ...options }
        // Set timeout and store reference
        const timeoutId = window.setTimeout(() => remove(id), duration)
        timeoutsRef.current.set(id, timeoutId)
        return [...current, newToast]
      })
    },
    [remove]
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex w-[calc(100vw-2rem)] sm:w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 sm:gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              'pointer-events-auto rounded-lg p-3 sm:p-4 shadow-lg ring-1 ring-[hsl(var(--line)/.2)] backdrop-blur-sm transition-all duration-200 ease-out',
              variantStyles[toast.variant ?? 'default']
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-current">{variantIcon[toast.variant ?? 'default']}</span>
              <div className="flex-1">
                <div className="text-xs sm:text-sm font-semibold">{toast.title}</div>
                {toast.description && <p className="mt-1 text-xs sm:text-sm text-[hsl(var(--muted))]">{toast.description}</p>}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(toast.id)
                }}
                className="flex-shrink-0 p-1 -mr-1 -mt-1 rounded-md text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2)/.5)] transition-colors cursor-pointer"
                aria-label="Luk besked"
              >
                <X size={18} />
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

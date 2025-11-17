import React, { useRef, useEffect, useState, KeyboardEvent, useImperativeHandle, forwardRef } from 'react'

interface PINInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
  'aria-label'?: string
}

export interface PINInputRef {
  focus: () => void
  clear: () => void
}

/**
 * Premium PIN input component with individual digit boxes.
 * Features:
 * - Auto-advance between boxes
 * - Backspace to go back
 * - Paste support
 * - Keyboard navigation
 * - Hidden digits (password-style)
 * - Smooth animations
 */
export const PINInput = forwardRef<PINInputRef, PINInputProps>(({
  value,
  onChange,
  length = 6,
  disabled = false,
  error = false,
  autoFocus = false,
  'aria-label': ariaLabel = 'PIN code'
}, ref) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [focusedIndex, setFocusedIndex] = useState<number | null>(autoFocus ? 0 : null)

  // Initialize refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length)
  }, [length])

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRefs.current[0]?.focus()
      setFocusedIndex(0)
    },
    clear: () => {
      onChange('')
      inputRefs.current[0]?.focus()
      setFocusedIndex(0)
    }
  }), [onChange])

  // Auto-focus first input only if explicitly requested
  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && focusedIndex === 0 && value.length === 0) {
      inputRefs.current[0]?.focus()
    }
  }, [autoFocus, focusedIndex, value.length])

  // Update focused index when value changes (only auto-advance, don't steal focus)
  useEffect(() => {
    const nextIndex = value.length
    if (nextIndex < length && nextIndex !== focusedIndex && document.activeElement?.tagName === 'INPUT') {
      // Only auto-advance if user is actively typing in an input field
      const activeInput = document.activeElement as HTMLInputElement
      const isTypingInPIN = inputRefs.current.some(ref => ref === activeInput)
      
      if (isTypingInPIN) {
        setFocusedIndex(nextIndex)
        // Small delay to ensure smooth transition
        setTimeout(() => {
          inputRefs.current[nextIndex]?.focus()
        }, 0)
      }
    }
  }, [value, length, focusedIndex])

  const handleChange = (index: number, digit: string) => {
    if (disabled) return

    // Only allow digits
    if (digit && !/^\d$/.test(digit)) return

    const newValue = value.split('')
    newValue[index] = digit
    const updatedValue = newValue.join('').slice(0, length)
    onChange(updatedValue)
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      const newValue = value.split('')
      
      if (newValue[index]) {
        // Clear current digit
        newValue[index] = ''
        onChange(newValue.join(''))
      } else if (index > 0) {
        // Move to previous and clear it
        const prevIndex = index - 1
        newValue[prevIndex] = ''
        onChange(newValue.join(''))
        inputRefs.current[prevIndex]?.focus()
        setFocusedIndex(prevIndex)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
      setFocusedIndex(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
      setFocusedIndex(index + 1)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      const newValue = value.split('')
      newValue[index] = ''
      onChange(newValue.join(''))
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (disabled) return
    
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (pastedData) {
      onChange(pastedData)
    }
  }

  const handleFocus = (index: number) => {
    setFocusedIndex(index)
  }

  const handleBlur = () => {
    // Delay to allow click events to process
    setTimeout(() => {
      setFocusedIndex(null)
    }, 200)
  }

  return (
    <div className="flex items-center justify-center gap-2" role="group" aria-label={ariaLabel}>
      {Array.from({ length }).map((_, index) => {
        const digit = value[index] || ''
        const isFocused = focusedIndex === index

        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => handleFocus(index)}
            onBlur={handleBlur}
            disabled={disabled}
            aria-label={`${ariaLabel} digit ${index + 1}`}
            className={`
              w-12 h-14 text-center text-2xl font-semibold
              rounded-lg
              transition-all duration-200 ease-out
              bg-[hsl(var(--surface))]
              ring-1 ring-[hsl(var(--border)/.4)]
              border border-[hsl(var(--border)/.3)]
              text-[hsl(var(--foreground))]
              placeholder:text-[hsl(var(--muted)/.4)]
              
              focus:outline-none
              focus:ring-2 focus:ring-[hsl(var(--ring))]
              focus:border-[hsl(var(--ring)/.5)]
              focus:ring-offset-0
              focus:scale-105
              
              disabled:opacity-50 disabled:cursor-not-allowed
              disabled:bg-[hsl(var(--surface-2))]
              
              ${error ? 'ring-2 ring-[hsl(var(--destructive))] border-[hsl(var(--destructive)/.6)] bg-[hsl(var(--destructive)/.05)]' : ''}
              ${isFocused ? 'shadow-md' : 'shadow-sm'}
              
              selection:bg-transparent
            `}
            style={{
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.05em'
            }}
          />
        )
      })}
    </div>
  )
})

PINInput.displayName = 'PINInput'


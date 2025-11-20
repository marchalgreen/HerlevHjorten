import { useEffect, useRef } from 'react'

/**
 * Hook that prevents the screen from sleeping using the Screen Wake Lock API.
 * Automatically releases the lock when the component unmounts or when disabled.
 * 
 * @param enabled - Whether to keep the screen awake (default: true)
 * @returns Object with isSupported flag and release function
 * 
 * @example
 * ```tsx
 * const { isSupported } = useWakeLock(session !== null)
 * ```
 */
export const useWakeLock = (enabled: boolean = true) => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const isSupportedRef = useRef<boolean>(false)
  const visibilityCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Check if Wake Lock API is supported
    if (!('wakeLock' in navigator)) {
      isSupportedRef.current = false
      return
    }

    isSupportedRef.current = true

    // Function to request wake lock
    const requestWakeLock = async () => {
      try {
        // Release existing lock if any
        if (wakeLockRef.current) {
          await wakeLockRef.current.release()
          wakeLockRef.current = null
        }

        // Request new wake lock
        const wakeLock = await navigator.wakeLock.request('screen')
        wakeLockRef.current = wakeLock

        // Handle visibility change - re-request lock when page becomes visible again
        const handleVisibilityChange = async () => {
          if (document.visibilityState === 'visible' && enabled && !wakeLockRef.current) {
            try {
              wakeLockRef.current = await navigator.wakeLock.request('screen')
            } catch (err) {
              console.warn('[useWakeLock] Failed to re-request wake lock:', err)
            }
          }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        visibilityCleanupRef.current = () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange)
        }

        // Handle lock release (e.g., user switches tabs, locks screen)
        wakeLock.addEventListener('release', () => {
          wakeLockRef.current = null
        })
      } catch (err) {
        // Wake Lock request failed (e.g., user denied permission, battery saver mode)
        console.warn('[useWakeLock] Failed to request wake lock:', err)
        wakeLockRef.current = null
      }
    }

    // Request wake lock if enabled
    if (enabled) {
      requestWakeLock()
    }

    // Cleanup: release wake lock when component unmounts or when disabled
    return () => {
      if (visibilityCleanupRef.current) {
        visibilityCleanupRef.current()
        visibilityCleanupRef.current = null
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch((err) => {
          console.warn('[useWakeLock] Failed to release wake lock:', err)
        })
        wakeLockRef.current = null
      }
    }
  }, [enabled])

  // Manual release function
  const release = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
        wakeLockRef.current = null
      } catch (err) {
        console.warn('[useWakeLock] Failed to release wake lock:', err)
      }
    }
  }

  return {
    isSupported: isSupportedRef.current,
    release
  }
}


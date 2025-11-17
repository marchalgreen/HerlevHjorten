/**
 * Simple logger utility for server-side code
 * In production, these should be sent to a proper logging service
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  error: (message: string, error?: unknown) => {
    // Always log errors
    if (error instanceof Error) {
      console.error(`[ERROR] ${message}`, {
        message: error.message,
        stack: isDevelopment ? error.stack : undefined
      })
    } else {
      console.error(`[ERROR] ${message}`, error)
    }
  },
  
  warn: (message: string, ...args: unknown[]) => {
    // Only log warnings in development
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, ...args)
    }
  },
  
  info: (message: string, ...args: unknown[]) => {
    // Only log info in development
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, ...args)
    }
  },
  
  debug: (message: string, ...args: unknown[]) => {
    // Only log debug in development
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, ...args)
    }
  }
}


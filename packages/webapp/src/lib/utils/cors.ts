/**
 * CORS configuration utility
 * Restricts CORS in production to specific allowed origins
 */

const getAllowedOrigins = (): string[] => {
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS
  
  if (allowedOriginsEnv) {
    return allowedOriginsEnv.split(',').map(origin => origin.trim())
  }
  
  // Default allowed origins
  const defaultOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ]
  
  // In production, add production domains
  if (process.env.NODE_ENV === 'production') {
    const productionOrigins = [
      'https://rundeklar.dk',
      'https://www.rundeklar.dk',
      'https://demo.rundeklar.dk',
      'https://herlev-hjorten.rundeklar.dk'
    ]
    
    // Add any tenant subdomains from environment
    if (process.env.VERCEL_URL) {
      productionOrigins.push(`https://${process.env.VERCEL_URL}`)
    }
    
    return [...defaultOrigins, ...productionOrigins]
  }
  
  return defaultOrigins
}

/**
 * Get CORS origin for a request
 * @param origin - Request origin header
 * @returns Allowed origin or '*' for development
 */
export const getCorsOrigin = (origin: string | undefined): string => {
  if (process.env.NODE_ENV === 'development') {
    // In development, allow all origins
    return '*'
  }
  
  // In production, check against allowed origins
  const allowedOrigins = getAllowedOrigins()
  
  if (!origin) {
    // No origin header (e.g., same-origin request)
    return allowedOrigins[0] || '*'
  }
  
  if (allowedOrigins.includes(origin)) {
    return origin
  }
  
  // Default to first allowed origin if not in list
  return allowedOrigins[0] || '*'
}

/**
 * Set CORS headers on response
 * @param res - Response object
 * @param origin - Request origin header
 */
export const setCorsHeaders = (res: { setHeader: (name: string, value: string) => void }, origin?: string): void => {
  const corsOrigin = getCorsOrigin(origin)
  
  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', corsOrigin !== '*' ? 'true' : 'false')
}


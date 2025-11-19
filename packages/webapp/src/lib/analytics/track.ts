/**
 * Client-side analytics tracking utility
 * Tracks page views for marketing site and demo tenant
 * Uses sessionStorage to maintain session_id across page navigations
 */

const SESSION_STORAGE_KEY = 'analytics_session_id'
const TRACKED_PAGES_KEY = 'analytics_tracked_pages'
const API_ENDPOINT = '/api/analytics/track'

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Get or create session ID from sessionStorage
 */
function getSessionId(): string {
  if (typeof window === 'undefined') {
    return generateSessionId()
  }

  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!sessionId) {
    sessionId = generateSessionId()
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)
  }
  return sessionId
}

/**
 * Extract UTM parameters from URL
 */
function getUtmParams(): {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
} {
  if (typeof window === 'undefined') {
    return { utm_source: null, utm_medium: null, utm_campaign: null }
  }

  const urlParams = new URLSearchParams(window.location.search)
  return {
    utm_source: urlParams.get('utm_source'),
    utm_medium: urlParams.get('utm_medium'),
    utm_campaign: urlParams.get('utm_campaign')
  }
}

/**
 * Get current path (handles hash router)
 */
function getCurrentPath(): string {
  if (typeof window === 'undefined') {
    return '/'
  }

  // For hash router, use hash; otherwise use pathname
  const hash = window.location.hash
  if (hash && hash.length > 1) {
    return hash
  }
  return window.location.pathname || '/'
}

/**
 * Get referrer
 */
function getReferrer(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return document.referrer || null
}

/**
 * Get user agent
 */
function getUserAgent(): string | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null
  }
  return navigator.userAgent || null
}

/**
 * Check if current user is admin/sysadmin
 */
function isAdminUser(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  // Check if user has auth token (indicates logged in)
  const token = localStorage.getItem('auth_access_token')
  if (!token) {
    return false
  }

  // Try to decode JWT to check role (client-side check only)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const role = payload.role
    // Check if user is admin or sysadmin
    return role === 'admin' || role === 'sysadmin' || role === 'super_admin'
  } catch {
    // If token decode fails, assume not admin
    return false
  }
}

/**
 * Get unique key for this page view (tenant + path combination)
 */
function getPageViewKey(tenantId: string, path: string): string {
  return `${tenantId}:${path}`
}

/**
 * Check if this page view has already been tracked in this session
 */
function hasTrackedPageView(tenantId: string, path: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const trackedPagesJson = sessionStorage.getItem(TRACKED_PAGES_KEY)
    if (!trackedPagesJson) {
      return false
    }

    const trackedPages = JSON.parse(trackedPagesJson) as string[]
    const pageKey = getPageViewKey(tenantId, path)
    return trackedPages.includes(pageKey)
  } catch {
    return false
  }
}

/**
 * Mark this page view as tracked
 */
function markPageViewAsTracked(tenantId: string, path: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const trackedPagesJson = sessionStorage.getItem(TRACKED_PAGES_KEY)
    const trackedPages = trackedPagesJson ? (JSON.parse(trackedPagesJson) as string[]) : []
    const pageKey = getPageViewKey(tenantId, path)
    
    if (!trackedPages.includes(pageKey)) {
      trackedPages.push(pageKey)
      sessionStorage.setItem(TRACKED_PAGES_KEY, JSON.stringify(trackedPages))
    }
  } catch {
    // Silently fail
  }
}

/**
 * Track a page view
 * @param tenantId - Tenant ID ('marketing', 'demo', or specific tenant)
 */
export async function trackPageView(tenantId: string): Promise<void> {
  try {
    const path = getCurrentPath()
    
    // Check if we've already tracked this page view in this session
    if (hasTrackedPageView(tenantId, path)) {
      console.debug(`[Analytics] Skipping duplicate page view: ${tenantId}:${path}`)
      return
    }

    const sessionId = getSessionId()
    const referrer = getReferrer()
    const userAgent = getUserAgent()
    const utmParams = getUtmParams()
    const isAdmin = isAdminUser()

    const payload = {
      tenant_id: tenantId,
      path,
      referrer,
      user_agent: userAgent,
      utm_source: utmParams.utm_source,
      utm_medium: utmParams.utm_medium,
      utm_campaign: utmParams.utm_campaign,
      session_id: sessionId,
      is_admin: isAdmin
    }

    // Mark as tracked BEFORE sending (to prevent race conditions)
    markPageViewAsTracked(tenantId, path)

    // Send tracking event (non-blocking)
    // Use fetch with keepalive to ensure request completes even if page unloads
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      keepalive: true // Ensures request completes even if page unloads
    }).catch((error) => {
      // Silently fail - tracking should not break the app
      console.debug('Analytics tracking failed:', error)
    })
  } catch (error) {
    // Silently fail - tracking should not break the app
    console.debug('Analytics tracking error:', error)
  }
}

/**
 * Track a conversion event (e.g., signup)
 * @param tenantId - Tenant ID
 * @param eventType - Type of conversion event (e.g., 'signup', 'trial_started')
 * @param metadata - Optional metadata about the conversion
 */
export async function trackConversion(
  tenantId: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const sessionId = getSessionId()
    const path = getCurrentPath()
    const referrer = getReferrer()
    const userAgent = getUserAgent()
    const utmParams = getUtmParams()
    const isAdmin = isAdminUser()

    const payload = {
      tenant_id: tenantId,
      path,
      referrer,
      user_agent: userAgent,
      utm_source: utmParams.utm_source,
      utm_medium: utmParams.utm_medium,
      utm_campaign: utmParams.utm_campaign,
      session_id: sessionId,
      is_admin: isAdmin,
      event_type: eventType,
      metadata: metadata || {}
    }

    // For now, we'll use the same endpoint but could extend it later
    // In the future, we might want a separate conversions table
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch((error) => {
      console.debug('Conversion tracking failed:', error)
    })
  } catch (error) {
    console.debug('Conversion tracking error:', error)
  }
}


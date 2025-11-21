import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPostgresClient, getDatabaseUrl } from '../auth/db-helper.js'
import { requireAuth, requireSuperAdmin, type AuthenticatedRequest } from '../../src/lib/auth/middleware.js'
import { setCorsHeaders } from '../../src/lib/utils/cors.js'
import { logger } from '../../src/lib/utils/logger.js'

/**
 * Anonymize IP address (remove last octet for privacy)
 * Matches the anonymization logic in track.ts
 */
function anonymizeIp(ip: string | string[] | undefined | null): string | null {
  if (!ip) return null
  // Handle array (take first element) or string
  let ipStr = Array.isArray(ip) ? ip[0] : ip
  // Handle comma-separated IPs in x-forwarded-for (take first IP)
  ipStr = ipStr.split(',')[0].trim()
  const parts = ipStr.split('.')
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`
  }
  return null
}

/**
 * Get client IP from request headers
 */
function getClientIp(req: AuthenticatedRequest): string | null {
  const clientIp = req.headers['x-forwarded-for'] || 
                   req.headers['x-real-ip'] || 
                   (req as any).socket?.remoteAddress || 
                   null
  return anonymizeIp(clientIp)
}

/**
 * Build WHERE clause for date and tenant filters
 * @param startDate - Optional start date filter
 * @param endDate - Optional end date filter
 * @param tenantId - Optional tenant ID filter
 * @param excludeAdmin - If true, exclude admin views (default: true)
 * @param excludeIps - Optional IP addresses to exclude (anonymized) - can be single IP or array
 */
function buildWhereClause(
  startDate?: string, 
  endDate?: string, 
  tenantId?: string, 
  excludeAdmin: boolean = true,
  excludeIps?: string | string[] | null
) {
  const conditions: string[] = []
  const params: any[] = []
  let paramIndex = 1

  // Exclude admin views by default
  if (excludeAdmin) {
    conditions.push(`is_admin_view = false`)
  }

  // Exclude views from specific IP address(es)
  // Handle both single IP and array of IPs
  if (excludeIps) {
    const ips = Array.isArray(excludeIps) ? excludeIps : [excludeIps]
    if (ips.length > 0) {
      // Use NOT IN for multiple IPs, or IS DISTINCT FROM for single IP
      if (ips.length === 1) {
        conditions.push(`ip_address IS DISTINCT FROM $${paramIndex}::inet`)
        params.push(ips[0])
        paramIndex++
      } else {
        // For multiple IPs, use NOT IN with array
        const placeholders = ips.map((_, i) => `$${paramIndex + i}::inet`).join(', ')
        conditions.push(`ip_address IS DISTINCT FROM ALL(ARRAY[${placeholders}])`)
        params.push(...ips)
        paramIndex += ips.length
      }
    }
  }

  if (tenantId) {
    conditions.push(`tenant_id = $${paramIndex}`)
    params.push(tenantId)
    paramIndex++
  }

  if (startDate) {
    conditions.push(`created_at >= $${paramIndex}::timestamptz`)
    params.push(startDate)
    paramIndex++
  }

  if (endDate) {
    conditions.push(`created_at <= $${paramIndex}::timestamptz`)
    params.push(endDate)
    paramIndex++
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  }
}

/**
 * Build WHERE clause for counting excluded views (sysadmin's views)
 */
function buildExcludedWhereClause(
  startDate?: string,
  endDate?: string,
  tenantId?: string,
  excludeIps?: string | string[] | null
) {
  const conditions: string[] = []
  const params: any[] = []
  let paramIndex = 1

  // Include only views from the excluded IP(s)
  if (excludeIps) {
    const ips = Array.isArray(excludeIps) ? excludeIps : [excludeIps]
    if (ips.length > 0) {
      if (ips.length === 1) {
        conditions.push(`ip_address = $${paramIndex}::inet`)
        params.push(ips[0])
        paramIndex++
      } else {
        // For multiple IPs, use IN with array
        const placeholders = ips.map((_, i) => `$${paramIndex + i}::inet`).join(', ')
        conditions.push(`ip_address = ANY(ARRAY[${placeholders}])`)
        params.push(...ips)
        paramIndex += ips.length
      }
    } else {
      // If no IPs to exclude, return empty (no excluded views)
      return { where: 'WHERE 1=0', params: [] }
    }
  } else {
    // If no IPs to exclude, return empty (no excluded views)
    return { where: 'WHERE 1=0', params: [] }
  }

  if (tenantId) {
    conditions.push(`tenant_id = $${paramIndex}`)
    params.push(tenantId)
    paramIndex++
  }

  if (startDate) {
    conditions.push(`created_at >= $${paramIndex}::timestamptz`)
    params.push(startDate)
    paramIndex++
  }

  if (endDate) {
    conditions.push(`created_at <= $${paramIndex}::timestamptz`)
    params.push(endDate)
    paramIndex++
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  }
}

/**
 * Get analytics data for sys admin dashboard
 * Requires super admin authentication
 */
export default async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Require authentication and super admin role
    await requireAuth(req)
    requireSuperAdmin(req)

    const sql = getPostgresClient(getDatabaseUrl())

    // Parse query parameters
    const startDate = req.query.startDate as string | undefined
    const endDate = req.query.endDate as string | undefined
    const tenantId = req.query.tenantId as string | undefined

    // Get current sysadmin's IP address (anonymized) to exclude their views
    const sysadminIp = getClientIp(req)

    // CRITICAL: Find ALL IP addresses that have admin views
    // This ensures we exclude views from ALL IPs where sysadmin has been logged in,
    // not just the current IP (handles network changes, VPN, etc.)
    const adminIpAddressesResult = await sql`
      SELECT DISTINCT ip_address
      FROM page_views
      WHERE is_admin_view = true
        AND ip_address IS NOT NULL
    `
    let adminIpAddresses = adminIpAddressesResult.map((row: any) => row.ip_address).filter(Boolean)
    
    // IMPORTANT: Also include current sysadmin IP if it's not already in the list
    // This handles the case where admin views have been deleted but we still need to exclude current IP
    if (sysadminIp && !adminIpAddresses.includes(sysadminIp)) {
      adminIpAddresses.push(sysadminIp)
    }

    // Build WHERE clause (exclude admin views AND all IPs with admin views)
    const { where, params } = buildWhereClause(startDate, endDate, tenantId, true, adminIpAddresses)
    
    // Build WHERE clause for admin views (include all admin views, but exclude IPs with admin views)
    const { where: adminWhere, params: adminParams } = buildWhereClause(startDate, endDate, tenantId, false, adminIpAddresses)
    
    // Build WHERE clause for excluded views (all views from IPs with admin views)
    const { where: excludedWhere, params: excludedParams } = buildExcludedWhereClause(startDate, endDate, tenantId, adminIpAddresses)

    // Get total page views (excluding admin and admin IPs)
    // Use template literal when possible, unsafe only when we have params
    let totalViews = 0
    if (where) {
      if (params.length === 0) {
        // No params, use template literal for better type handling
        const totalViewsResult = await sql.unsafe(`SELECT COUNT(*)::int as count FROM page_views ${where}`, [])
        totalViews = Number(totalViewsResult[0]?.count || 0)
      } else {
        // Has params, use unsafe with params
        const totalViewsResult = await sql.unsafe(`SELECT COUNT(*)::int as count FROM page_views ${where}`, params)
        const countValue = totalViewsResult[0]?.count
        totalViews = typeof countValue === 'string' ? parseInt(countValue, 10) : Number(countValue || 0)
      }
    } else {
      const totalViewsResult = await sql`SELECT COUNT(*)::int as count FROM page_views WHERE is_admin_view = false`
      totalViews = Number(totalViewsResult[0]?.count || 0)
    }

    // Get excluded views count (sysadmin's views from their IP)
    const excludedViewsResult = excludedParams.length > 0
      ? await sql.unsafe(`SELECT COUNT(*)::int as count FROM page_views ${excludedWhere}`, excludedParams)
      : await sql`SELECT COUNT(*)::int as count FROM page_views WHERE 1=0`
    const excludedViews = Number(excludedViewsResult[0]?.count || 0)

    // Get admin views count (excluding sysadmin IP)
    const adminViewsResult = adminParams.length > 0
      ? await sql.unsafe(`SELECT COUNT(*)::int as count FROM page_views ${adminWhere} AND is_admin_view = true`, adminParams)
      : await sql`SELECT COUNT(*)::int as count FROM page_views WHERE is_admin_view = true`
    const adminViews = Number(adminViewsResult[0]?.count || 0)

    // Get unique visitors (excluding admin and admin IPs)
    // Use IP address instead of session_id to count actual unique visitors
    // IP is already anonymized (last octet removed) for privacy
    const ipWhere = where ? `${where} AND ip_address IS NOT NULL` : adminIpAddresses.length > 0
      ? `WHERE is_admin_view = false AND ip_address IS NOT NULL AND ip_address IS DISTINCT FROM ALL(ARRAY[${adminIpAddresses.map((_, i) => `$${i + 1}::inet`).join(', ')}])`
      : 'WHERE is_admin_view = false AND ip_address IS NOT NULL'
    const uniqueVisitorsResult = params.length > 0
      ? await sql.unsafe(`SELECT COUNT(DISTINCT ip_address)::int as count FROM page_views ${ipWhere}`, params)
      : adminIpAddresses.length > 0
      ? await sql.unsafe(`SELECT COUNT(DISTINCT ip_address)::int as count FROM page_views ${ipWhere}`, adminIpAddresses)
      : await sql`SELECT COUNT(DISTINCT ip_address)::int as count FROM page_views WHERE is_admin_view = false AND ip_address IS NOT NULL`
    const uniqueVisitors = Number(uniqueVisitorsResult[0]?.count || 0)

    // Get views by tenant (excluding admin and admin IPs)
    // Always use the where clause - it will include IP exclusion if adminIpAddresses is set
    const tenantIpWhere = where ? `${where} AND ip_address IS NOT NULL` : 'WHERE is_admin_view = false AND ip_address IS NOT NULL'
    
    let viewsByTenantResult: any[]
    if (where) {
      // Use unsafe only if we have params, otherwise build query directly
      if (params.length === 0) {
        // No params, build query directly without unsafe
        const query = `SELECT tenant_id, COUNT(*)::int as total_views, COUNT(DISTINCT ip_address)::int as unique_visitors FROM page_views ${tenantIpWhere} GROUP BY tenant_id ORDER BY total_views DESC`
        const result = await sql.unsafe(query, [])
        viewsByTenantResult = result.map((row: any) => ({
          tenant_id: row.tenant_id,
          total_views: Number(row.total_views || 0),
          unique_visitors: Number(row.unique_visitors || 0)
        }))
      } else {
        // Has params, use unsafe with params
        const query = `SELECT tenant_id, COUNT(*)::int as total_views, COUNT(DISTINCT ip_address)::int as unique_visitors FROM page_views ${tenantIpWhere} GROUP BY tenant_id ORDER BY total_views DESC`
        const result = await sql.unsafe(query, params)
        viewsByTenantResult = result.map((row: any) => ({
          tenant_id: row.tenant_id,
          total_views: typeof row.total_views === 'string' ? parseInt(row.total_views, 10) : Number(row.total_views || 0),
          unique_visitors: typeof row.unique_visitors === 'string' ? parseInt(row.unique_visitors, 10) : Number(row.unique_visitors || 0)
        }))
      }
    } else {
      const result = await sql`
        SELECT 
          tenant_id,
          COUNT(*)::int as total_views,
          COUNT(DISTINCT ip_address)::int as unique_visitors
        FROM page_views
        WHERE is_admin_view = false AND ip_address IS NOT NULL
        GROUP BY tenant_id
        ORDER BY total_views DESC
      `
      viewsByTenantResult = result.map((row: any) => ({
        tenant_id: row.tenant_id,
        total_views: Number(row.total_views || 0),
        unique_visitors: Number(row.unique_visitors || 0)
      }))
    }
    
    // Get admin views by tenant (excluding sysadmin IP)
    const adminViewsByTenantResult = adminParams.length > 0
      ? await sql.unsafe(`
          SELECT 
            tenant_id,
            COUNT(*)::int as admin_views
          FROM page_views
          ${adminWhere} AND is_admin_view = true
          GROUP BY tenant_id
        `, adminParams)
      : await sql`
          SELECT 
            tenant_id,
            COUNT(*)::int as admin_views
          FROM page_views
          WHERE is_admin_view = true
          GROUP BY tenant_id
        `
    
    // Get excluded views by tenant (sysadmin's views)
    const excludedViewsByTenantResult = excludedParams.length > 0
      ? await sql.unsafe(`
          SELECT 
            tenant_id,
            COUNT(*)::int as excluded_views
          FROM page_views
          ${excludedWhere}
          GROUP BY tenant_id
        `, excludedParams)
      : await sql`
          SELECT 
            tenant_id,
            COUNT(*)::int as excluded_views
          FROM page_views
          WHERE 1=0
          GROUP BY tenant_id
        `
    
    const adminViewsByTenantMap = new Map(
      adminViewsByTenantResult.map((row: any) => [row.tenant_id, row.admin_views])
    )
    
    const excludedViewsByTenantMap = new Map(
      excludedViewsByTenantResult.map((row: any) => [row.tenant_id, row.excluded_views])
    )
    
    const viewsByTenant = viewsByTenantResult.map((row: any) => ({
      tenant_id: row.tenant_id,
      total_views: Number(row.total_views || 0),
      unique_visitors: Number(row.unique_visitors || 0),
      admin_views: Number(adminViewsByTenantMap.get(row.tenant_id) || 0),
      excluded_views: Number(excludedViewsByTenantMap.get(row.tenant_id) || 0)
    }))

    // Get views over time (daily) - last 30 days (excluding admin and admin IPs)
    const timeIpWhere = where ? `${where} AND ip_address IS NOT NULL` : adminIpAddresses.length > 0
      ? `WHERE is_admin_view = false AND ip_address IS NOT NULL AND ip_address IS DISTINCT FROM ALL(ARRAY[${adminIpAddresses.map((_, i) => `$${i + 1}::inet`).join(', ')}])`
      : 'WHERE is_admin_view = false AND ip_address IS NOT NULL'
    const viewsOverTimeResult = params.length > 0
      ? await sql.unsafe(`
          SELECT 
            DATE(created_at) as date,
            COUNT(*)::int as views,
            COUNT(DISTINCT ip_address)::int as unique_visitors
          FROM page_views
          ${timeIpWhere}
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `, params)
      : adminIpAddresses.length > 0
      ? await sql.unsafe(`
          SELECT 
            DATE(created_at) as date,
            COUNT(*)::int as views,
            COUNT(DISTINCT ip_address)::int as unique_visitors
          FROM page_views
          WHERE is_admin_view = false 
            AND ip_address IS NOT NULL 
            AND ip_address IS DISTINCT FROM ALL(ARRAY[${adminIpAddresses.map((_, i) => `$${i + 1}::inet`).join(', ')}])
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `, adminIpAddresses)
      : await sql`
          SELECT 
            DATE(created_at) as date,
            COUNT(*)::int as views,
            COUNT(DISTINCT ip_address)::int as unique_visitors
          FROM page_views
          WHERE is_admin_view = false AND ip_address IS NOT NULL
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `
    const viewsOverTime = viewsOverTimeResult.map((row: any) => ({
      date: row.date.toISOString().split('T')[0],
      views: row.views,
      unique_visitors: row.unique_visitors
    }))

    // Get traffic sources (UTM source) - excluding admin and admin IPs
    const trafficSourcesResult = params.length > 0
      ? await sql.unsafe(`
          SELECT 
            COALESCE(utm_source, 'direct') as source,
            COUNT(*)::int as count
          FROM page_views
          ${where}
          GROUP BY COALESCE(utm_source, 'direct')
          ORDER BY count DESC
          LIMIT 10
        `, params)
      : adminIpAddresses.length > 0
      ? await sql.unsafe(`
          SELECT 
            COALESCE(utm_source, 'direct') as source,
            COUNT(*)::int as count
          FROM page_views
          WHERE is_admin_view = false 
            AND ip_address IS DISTINCT FROM ALL(ARRAY[${adminIpAddresses.map((_, i) => `$${i + 1}::inet`).join(', ')}])
          GROUP BY COALESCE(utm_source, 'direct')
          ORDER BY count DESC
          LIMIT 10
        `, adminIpAddresses)
      : await sql`
          SELECT 
            COALESCE(utm_source, 'direct') as source,
            COUNT(*)::int as count
          FROM page_views
          WHERE is_admin_view = false
          GROUP BY COALESCE(utm_source, 'direct')
          ORDER BY count DESC
          LIMIT 10
        `
    const trafficSources = trafficSourcesResult.map((row: any) => ({
      source: row.source,
      count: row.count
    }))

    // Get top paths - excluding admin and admin IPs
    const topPathsResult = params.length > 0
      ? await sql.unsafe(`
          SELECT 
            path,
            COUNT(*)::int as count
          FROM page_views
          ${where}
          GROUP BY path
          ORDER BY count DESC
          LIMIT 10
        `, params)
      : adminIpAddresses.length > 0
      ? await sql.unsafe(`
          SELECT 
            path,
            COUNT(*)::int as count
          FROM page_views
          WHERE is_admin_view = false 
            AND ip_address IS DISTINCT FROM ALL(ARRAY[${adminIpAddresses.map((_, i) => `$${i + 1}::inet`).join(', ')}])
          GROUP BY path
          ORDER BY count DESC
          LIMIT 10
        `, adminIpAddresses)
      : await sql`
          SELECT 
            path,
            COUNT(*)::int as count
          FROM page_views
          WHERE is_admin_view = false
          GROUP BY path
          ORDER BY count DESC
          LIMIT 10
        `
    const topPaths = topPathsResult.map((row: any) => ({
      path: row.path,
      count: row.count
    }))

    // Get recent page views - excluding admin and sysadmin IP
    const recentViewsResult = params.length > 0
      ? await sql.unsafe(`
          SELECT 
            id,
            tenant_id,
            path,
            referrer,
            utm_source,
            utm_medium,
            utm_campaign,
            created_at
          FROM page_views
          ${where}
          ORDER BY created_at DESC
          LIMIT 50
        `, params)
      : adminIpAddresses.length > 0
      ? await sql.unsafe(`
          SELECT 
            id,
            tenant_id,
            path,
            referrer,
            utm_source,
            utm_medium,
            utm_campaign,
            created_at
          FROM page_views
          WHERE is_admin_view = false 
            AND ip_address IS DISTINCT FROM ALL(ARRAY[${adminIpAddresses.map((_, i) => `$${i + 1}::inet`).join(', ')}])
          ORDER BY created_at DESC
          LIMIT 50
        `, adminIpAddresses)
      : await sql`
          SELECT 
            id,
            tenant_id,
            path,
            referrer,
            utm_source,
            utm_medium,
            utm_campaign,
            created_at
          FROM page_views
          WHERE is_admin_view = false
          ORDER BY created_at DESC
          LIMIT 50
        `
    const recentViews = recentViewsResult.map((row: any) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      path: row.path,
      referrer: row.referrer,
      utm_source: row.utm_source,
      utm_medium: row.utm_medium,
      utm_campaign: row.utm_campaign,
      created_at: row.created_at.toISOString()
    }))

    // Get stats for today, last 7 days, last 30 days
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Build tenant filter for time-based queries (excluding admin and all admin IPs)
    // Use the buildWhereClause function to ensure consistent filtering
    const { where: todayWhereClause, params: todayWhereParams } = buildWhereClause(
      todayStart.toISOString(),
      undefined,
      tenantId,
      true,
      adminIpAddresses
    )
    const { where: last7DaysWhereClause, params: last7DaysWhereParams } = buildWhereClause(
      sevenDaysAgo.toISOString(),
      undefined,
      tenantId,
      true,
      adminIpAddresses
    )
    const { where: last30DaysWhereClause, params: last30DaysWhereParams } = buildWhereClause(
      thirtyDaysAgo.toISOString(),
      undefined,
      tenantId,
      true,
      adminIpAddresses
    )

    const todayViewsResult = todayWhereParams.length > 0
      ? await sql.unsafe(`
          SELECT COUNT(*)::int as count
          FROM page_views
          ${todayWhereClause}
        `, todayWhereParams)
      : await sql`SELECT COUNT(*)::int as count FROM page_views WHERE is_admin_view = false AND created_at >= ${todayStart.toISOString()}::timestamptz`
    const todayViews = Number(todayViewsResult[0]?.count || 0)

    const last7DaysViewsResult = last7DaysWhereParams.length > 0
      ? await sql.unsafe(`
          SELECT COUNT(*)::int as count
          FROM page_views
          ${last7DaysWhereClause}
        `, last7DaysWhereParams)
      : await sql`SELECT COUNT(*)::int as count FROM page_views WHERE is_admin_view = false AND created_at >= ${sevenDaysAgo.toISOString()}::timestamptz`
    const last7DaysViews = Number(last7DaysViewsResult[0]?.count || 0)

    const last30DaysViewsResult = last30DaysWhereParams.length > 0
      ? await sql.unsafe(`
          SELECT COUNT(*)::int as count
          FROM page_views
          ${last30DaysWhereClause}
        `, last30DaysWhereParams)
      : await sql`SELECT COUNT(*)::int as count FROM page_views WHERE is_admin_view = false AND created_at >= ${thirtyDaysAgo.toISOString()}::timestamptz`
    const last30DaysViews = Number(last30DaysViewsResult[0]?.count || 0)

    // Calculate historical impact: How much of current statistics comes from admin IPs
    // This helps understand the "contamination" of statistics before filtering
    let historicalImpact: any = null
    if (adminIpAddresses.length > 0) {
      // Get total historical views from all admin IPs (all time, no filters)
      const ipPlaceholders = adminIpAddresses.map((_, i) => `$${i + 1}::inet`).join(', ')
      const historicalTotalResult = await sql.unsafe(`
        SELECT COUNT(*)::int as count
        FROM page_views
        WHERE ip_address = ANY(ARRAY[${ipPlaceholders}])
      `, adminIpAddresses)
      const historicalTotal = historicalTotalResult[0]?.count || 0

      // Get total views in database (all time, for comparison)
      const totalAllTimeResult = await sql`
        SELECT COUNT(*)::int as count
        FROM page_views
      `
      const totalAllTime = totalAllTimeResult[0]?.count || 0

      // Get historical views by tenant
      const historicalByTenantResult = await sql.unsafe(`
        SELECT 
          tenant_id,
          COUNT(*)::int as views
        FROM page_views
        WHERE ip_address = ANY(ARRAY[${ipPlaceholders}])
        GROUP BY tenant_id
        ORDER BY views DESC
      `, adminIpAddresses)

      // Get historical views over time (last 30 days)
      const historicalOverTimeResult = await sql.unsafe(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*)::int as views
        FROM page_views
        WHERE ip_address = ANY(ARRAY[${ipPlaceholders}])
          AND created_at >= $${adminIpAddresses.length + 1}::timestamptz
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `, [...adminIpAddresses, thirtyDaysAgo.toISOString()])

      // Calculate percentage of total statistics
      const percentageOfTotal = totalAllTime > 0 
        ? Math.round((historicalTotal / totalAllTime) * 100 * 100) / 100 // Round to 2 decimals
        : 0

      historicalImpact = {
        total_historical_views: historicalTotal,
        total_all_time_views: totalAllTime,
        percentage_of_total: percentageOfTotal,
        by_tenant: historicalByTenantResult.map((row: any) => ({
          tenant_id: row.tenant_id,
          views: row.views
        })),
        over_time: historicalOverTimeResult.map((row: any) => ({
          date: row.date.toISOString().split('T')[0],
          views: row.views
        }))
      }
    }

    // Ensure all numbers are properly converted before sending
    const responseData = {
      success: true,
      data: {
        summary: {
          total_views: Number(totalViews),
          unique_visitors: Number(uniqueVisitors),
          today_views: Number(todayViews),
          last_7_days_views: Number(last7DaysViews),
          last_30_days_views: Number(last30DaysViews),
          admin_views: Number(adminViews), // Total admin views for reference (excluding sysadmin IP)
          excluded_views: Number(excludedViews) // Sysadmin's own views (excluded from main counts)
        },
        views_by_tenant: viewsByTenant.map(t => ({
          ...t,
          total_views: Number(t.total_views),
          unique_visitors: Number(t.unique_visitors),
          admin_views: Number(t.admin_views),
          excluded_views: Number(t.excluded_views)
        })),
        views_over_time: viewsOverTime.map(v => ({
          ...v,
          views: Number(v.views),
          unique_visitors: Number(v.unique_visitors)
        })),
        traffic_sources: trafficSources.map(t => ({
          ...t,
          count: Number(t.count)
        })),
        top_paths: topPaths.map(p => ({
          ...p,
          count: Number(p.count)
        })),
        recent_views: recentViews,
        historical_impact: historicalImpact ? {
          ...historicalImpact,
          total_historical_views: Number(historicalImpact.total_historical_views),
          total_all_time_views: Number(historicalImpact.total_all_time_views),
          percentage_of_total: Number(historicalImpact.percentage_of_total),
          by_tenant: historicalImpact.by_tenant.map(t => ({
            ...t,
            views: Number(t.views)
          })),
          over_time: historicalImpact.over_time.map(o => ({
            ...o,
            views: Number(o.views)
          }))
        } : null
      }
    }
    
    return res.status(200).json(responseData)
  } catch (error) {
    logger.error('Error fetching analytics:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analytics'
    const errorStack = error instanceof Error ? error.stack : undefined

    return res.status(500).json({
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
    })
  }
}

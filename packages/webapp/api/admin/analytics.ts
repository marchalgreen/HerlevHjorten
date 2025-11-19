import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPostgresClient, getDatabaseUrl } from '../auth/db-helper.js'
import { requireAuth, requireSuperAdmin, type AuthenticatedRequest } from '../../src/lib/auth/middleware.js'
import { setCorsHeaders } from '../../src/lib/utils/cors.js'
import { logger } from '../../src/lib/utils/logger.js'

/**
 * Build WHERE clause for date and tenant filters
 * @param startDate - Optional start date filter
 * @param endDate - Optional end date filter
 * @param tenantId - Optional tenant ID filter
 * @param excludeAdmin - If true, exclude admin views (default: true)
 */
function buildWhereClause(startDate?: string, endDate?: string, tenantId?: string, excludeAdmin: boolean = true) {
  const conditions: string[] = []
  const params: any[] = []
  let paramIndex = 1

  // Exclude admin views by default
  if (excludeAdmin) {
    conditions.push(`is_admin_view = false`)
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

    // Build WHERE clause (exclude admin views)
    const { where, params } = buildWhereClause(startDate, endDate, tenantId, true)
    
    // Build WHERE clause for admin views (include all admin views)
    const { where: adminWhere, params: adminParams } = buildWhereClause(startDate, endDate, tenantId, false)

    // Get total page views (excluding admin)
    const totalViewsResult = params.length > 0
      ? await sql.unsafe(`SELECT COUNT(*)::int as count FROM page_views ${where}`, params)
      : await sql`SELECT COUNT(*)::int as count FROM page_views WHERE is_admin_view = false`
    const totalViews = totalViewsResult[0]?.count || 0

    // Get admin views count
    const adminViewsResult = adminParams.length > 0
      ? await sql.unsafe(`SELECT COUNT(*)::int as count FROM page_views ${adminWhere} AND is_admin_view = true`, adminParams)
      : await sql`SELECT COUNT(*)::int as count FROM page_views WHERE is_admin_view = true`
    const adminViews = adminViewsResult[0]?.count || 0

    // Get unique visitors (excluding admin)
    const uniqueVisitorsResult = params.length > 0
      ? await sql.unsafe(`SELECT COUNT(DISTINCT session_id)::int as count FROM page_views ${where}`, params)
      : await sql`SELECT COUNT(DISTINCT session_id)::int as count FROM page_views WHERE is_admin_view = false`
    const uniqueVisitors = uniqueVisitorsResult[0]?.count || 0

    // Get views by tenant (excluding admin)
    const viewsByTenantResult = params.length > 0
      ? await sql.unsafe(`
          SELECT 
            tenant_id,
            COUNT(*)::int as total_views,
            COUNT(DISTINCT session_id)::int as unique_visitors
          FROM page_views
          ${where}
          GROUP BY tenant_id
          ORDER BY total_views DESC
        `, params)
      : await sql`
          SELECT 
            tenant_id,
            COUNT(*)::int as total_views,
            COUNT(DISTINCT session_id)::int as unique_visitors
          FROM page_views
          WHERE is_admin_view = false
          GROUP BY tenant_id
          ORDER BY total_views DESC
        `
    
    // Get admin views by tenant
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
    
    const adminViewsByTenantMap = new Map(
      adminViewsByTenantResult.map((row: any) => [row.tenant_id, row.admin_views])
    )
    
    const viewsByTenant = viewsByTenantResult.map((row: any) => ({
      tenant_id: row.tenant_id,
      total_views: row.total_views,
      unique_visitors: row.unique_visitors,
      admin_views: adminViewsByTenantMap.get(row.tenant_id) || 0
    }))

    // Get views over time (daily) - last 30 days (excluding admin)
    const viewsOverTimeResult = params.length > 0
      ? await sql.unsafe(`
          SELECT 
            DATE(created_at) as date,
            COUNT(*)::int as views,
            COUNT(DISTINCT session_id)::int as unique_visitors
          FROM page_views
          ${where}
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `, params)
      : await sql`
          SELECT 
            DATE(created_at) as date,
            COUNT(*)::int as views,
            COUNT(DISTINCT session_id)::int as unique_visitors
          FROM page_views
          WHERE is_admin_view = false
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `
    const viewsOverTime = viewsOverTimeResult.map((row: any) => ({
      date: row.date.toISOString().split('T')[0],
      views: row.views,
      unique_visitors: row.unique_visitors
    }))

    // Get traffic sources (UTM source) - excluding admin
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

    // Get top paths - excluding admin
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

    // Get recent page views - excluding admin
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

    // Build tenant filter for time-based queries (excluding admin)
    let todayWhere = 'WHERE is_admin_view = false AND created_at >= $1::timestamptz'
    let last7DaysWhere = 'WHERE is_admin_view = false AND created_at >= $1::timestamptz'
    let last30DaysWhere = 'WHERE is_admin_view = false AND created_at >= $1::timestamptz'
    
    if (tenantId) {
      todayWhere = `WHERE tenant_id = $2 AND is_admin_view = false AND created_at >= $1::timestamptz`
      last7DaysWhere = `WHERE tenant_id = $2 AND is_admin_view = false AND created_at >= $1::timestamptz`
      last30DaysWhere = `WHERE tenant_id = $2 AND is_admin_view = false AND created_at >= $1::timestamptz`
    }

    const todayParams = tenantId ? [todayStart.toISOString(), tenantId] : [todayStart.toISOString()]
    const todayViewsResult = await sql.unsafe(`
      SELECT COUNT(*)::int as count
      FROM page_views
      ${todayWhere}
    `, todayParams)
    const todayViews = todayViewsResult[0]?.count || 0

    const last7DaysParams = tenantId ? [sevenDaysAgo.toISOString(), tenantId] : [sevenDaysAgo.toISOString()]
    const last7DaysViewsResult = await sql.unsafe(`
      SELECT COUNT(*)::int as count
      FROM page_views
      ${last7DaysWhere}
    `, last7DaysParams)
    const last7DaysViews = last7DaysViewsResult[0]?.count || 0

    const last30DaysParams = tenantId ? [thirtyDaysAgo.toISOString(), tenantId] : [thirtyDaysAgo.toISOString()]
    const last30DaysViewsResult = await sql.unsafe(`
      SELECT COUNT(*)::int as count
      FROM page_views
      ${last30DaysWhere}
    `, last30DaysParams)
    const last30DaysViews = last30DaysViewsResult[0]?.count || 0

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          total_views: totalViews,
          unique_visitors: uniqueVisitors,
          today_views: todayViews,
          last_7_days_views: last7DaysViews,
          last_30_days_views: last30DaysViews,
          admin_views: adminViews // Total admin views for reference
        },
        views_by_tenant: viewsByTenant,
        views_over_time: viewsOverTime,
        traffic_sources: trafficSources,
        top_paths: topPaths,
        recent_views: recentViews
      }
    })
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

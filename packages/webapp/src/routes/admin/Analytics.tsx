import React, { useState, useEffect } from 'react'
import { PageCard } from '../../components/ui'
import { BarChart3, Users, Eye, TrendingUp, Calendar } from 'lucide-react'

interface AnalyticsData {
  summary: {
    total_views: number
    unique_visitors: number
    today_views: number
    last_7_days_views: number
    last_30_days_views: number
    admin_views?: number
  }
  views_by_tenant: Array<{
    tenant_id: string
    total_views: number
    unique_visitors: number
    admin_views?: number
  }>
  views_over_time: Array<{
    date: string
    views: number
    unique_visitors: number
  }>
  traffic_sources: Array<{
    source: string
    count: number
  }>
  top_paths: Array<{
    path: string
    count: number
  }>
  recent_views: Array<{
    id: string
    tenant_id: string
    path: string
    referrer: string | null
    utm_source: string | null
    utm_medium: string | null
    utm_campaign: string | null
    created_at: string
  }>
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [tenantFilter, setTenantFilter] = useState<string>('')

  useEffect(() => {
    fetchAnalytics()
  }, [startDate, endDate, tenantFilter])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('auth_access_token')
      const apiUrl = import.meta.env.DEV 
        ? 'http://127.0.0.1:3000/api/admin/analytics'
        : '/api/admin/analytics'
      
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (tenantFilter) params.append('tenantId', tenantFilter)

      const response = await fetch(`${apiUrl}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch analytics')
      }

      const result = await response.json()
      setData(result.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <PageCard>
        <p>Indlæser analytics...</p>
      </PageCard>
    )
  }

  if (error) {
    return (
      <PageCard>
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </PageCard>
    )
  }

  if (!data) {
    return (
      <PageCard>
        <p className="text-[hsl(var(--muted))]">Ingen data tilgængelig.</p>
      </PageCard>
    )
  }

  // Calculate max values for charts
  const maxViews = Math.max(...data.views_over_time.map(d => d.views), 1)
  const maxTrafficSource = Math.max(...data.traffic_sources.map(d => d.count), 1)
  const maxPath = Math.max(...data.top_paths.map(d => d.count), 1)

  return (
    <div className="space-y-6">
      {/* Filters */}
      <PageCard>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Fra dato</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Til dato</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Tenant</label>
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[hsl(var(--line))] rounded-md bg-[hsl(var(--surface))]"
            >
              <option value="">Alle</option>
              <option value="marketing">Marketing</option>
              <option value="demo">Demo</option>
            </select>
          </div>
        </div>
      </PageCard>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <PageCard>
          <div className="flex items-center gap-3">
            <Eye className="w-8 h-8 text-[hsl(var(--primary))]" />
            <div>
              <p className="text-sm text-[hsl(var(--muted))]">Total besøg</p>
              <p className="text-2xl font-bold">
                {data.summary.total_views.toLocaleString()}
                {data.summary.admin_views && data.summary.admin_views > 0 && (
                  <span className="text-sm font-normal text-[hsl(var(--muted))] ml-1">
                    ({data.summary.admin_views} admin)
                  </span>
                )}
              </p>
            </div>
          </div>
        </PageCard>

        <PageCard>
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-[hsl(var(--success))]" />
            <div>
              <p className="text-sm text-[hsl(var(--muted))]">Unikke besøgende</p>
              <p className="text-2xl font-bold">{data.summary.unique_visitors.toLocaleString()}</p>
            </div>
          </div>
        </PageCard>

        <PageCard>
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-[hsl(var(--primary))]" />
            <div>
              <p className="text-sm text-[hsl(var(--muted))]">I dag</p>
              <p className="text-2xl font-bold">{data.summary.today_views.toLocaleString()}</p>
            </div>
          </div>
        </PageCard>

        <PageCard>
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-[hsl(var(--success))]" />
            <div>
              <p className="text-sm text-[hsl(var(--muted))]">Sidste 7 dage</p>
              <p className="text-2xl font-bold">{data.summary.last_7_days_views.toLocaleString()}</p>
            </div>
          </div>
        </PageCard>

        <PageCard>
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-[hsl(var(--primary))]" />
            <div>
              <p className="text-sm text-[hsl(var(--muted))]">Sidste 30 dage</p>
              <p className="text-2xl font-bold">{data.summary.last_30_days_views.toLocaleString()}</p>
            </div>
          </div>
        </PageCard>
      </div>

      {/* Views by Tenant */}
      <PageCard>
        <h2 className="text-xl font-semibold mb-6">Besøg pr. tenant</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.views_by_tenant.map((tenant) => {
            const isMarketing = tenant.tenant_id === 'marketing'
            const isDemo = tenant.tenant_id === 'demo'
            const badgeColor = isMarketing 
              ? 'bg-[hsl(var(--primary))] text-white' 
              : isDemo 
              ? 'bg-[hsl(var(--success))] text-white'
              : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))]'
            
            return (
              <div 
                key={tenant.tenant_id} 
                className="p-4 bg-[hsl(var(--surface))] border border-[hsl(var(--line)/.3)] rounded-lg hover:border-[hsl(var(--line))] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide ${badgeColor}`}>
                      {tenant.tenant_id}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                      {tenant.total_views.toLocaleString()}
                      {tenant.admin_views && tenant.admin_views > 0 && (
                        <span className="text-sm font-normal text-[hsl(var(--muted))] ml-1">
                          ({tenant.admin_views} admin)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted))] mt-0.5">besøg</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted))]">
                  <Users className="w-4 h-4" />
                  <span>{tenant.unique_visitors} unikke besøgende</span>
                </div>
              </div>
            )
          })}
        </div>
        {data.views_by_tenant.length === 0 && (
          <p className="text-center text-[hsl(var(--muted))] py-8">Ingen data tilgængelig</p>
        )}
      </PageCard>

      {/* Views Over Time */}
      <PageCard>
        <h2 className="text-xl font-semibold mb-4">Besøg over tid</h2>
        <div className="space-y-2">
          {data.views_over_time.slice().reverse().map((day) => {
            const width = (day.views / maxViews) * 100
            return (
              <div key={day.date} className="flex items-center gap-4">
                <div className="w-24 text-sm text-[hsl(var(--muted))]">
                  {new Date(day.date).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' }).replace(/\./g, '/')}
                </div>
                <div className="flex-1">
                  <div className="relative h-8 bg-[hsl(var(--surface-2))] rounded-md overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-[hsl(var(--primary))] rounded-md transition-all"
                      style={{ width: `${width}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-3 text-sm font-medium">
                      <span>{day.views}</span>
                      <span className="text-xs text-[hsl(var(--muted))]">
                        {day.unique_visitors} unikke
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </PageCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Sources */}
        <PageCard>
          <h2 className="text-xl font-semibold mb-4">Trafik kilder</h2>
          <div className="space-y-3">
            {data.traffic_sources.map((source) => {
              const width = (source.count / maxTrafficSource) * 100
              return (
                <div key={source.source} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium capitalize">{source.source}</div>
                  <div className="flex-1">
                    <div className="relative h-6 bg-[hsl(var(--surface-2))] rounded-md overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-[hsl(var(--success))] rounded-md"
                        style={{ width: `${width}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end px-2 text-xs font-medium">
                        {source.count}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </PageCard>

        {/* Top Paths */}
        <PageCard>
          <h2 className="text-xl font-semibold mb-4">Mest besøgte sider</h2>
          <div className="space-y-3">
            {data.top_paths.map((path) => {
              const width = (path.count / maxPath) * 100
              return (
                <div key={path.path} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-mono truncate">{path.path}</div>
                  <div className="flex-1">
                    <div className="relative h-6 bg-[hsl(var(--surface-2))] rounded-md overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-[hsl(var(--primary))] rounded-md"
                        style={{ width: `${width}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end px-2 text-xs font-medium">
                        {path.count}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </PageCard>
      </div>

      {/* Recent Views */}
      <PageCard>
        <h2 className="text-xl font-semibold mb-4">Seneste besøg</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(var(--line))]">
                <th className="text-left py-2 px-3 text-sm font-medium">Tid</th>
                <th className="text-left py-2 px-3 text-sm font-medium">Tenant</th>
                <th className="text-left py-2 px-3 text-sm font-medium">Path</th>
                <th className="text-left py-2 px-3 text-sm font-medium">Kilde</th>
                <th className="text-left py-2 px-3 text-sm font-medium">Campaign</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_views.map((view) => (
                <tr key={view.id} className="border-b border-[hsl(var(--line)/.5)]">
                  <td className="py-2 px-3 text-sm">
                    {new Date(view.created_at).toLocaleString('da-DK', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    }).replace(/\./g, '/')}
                  </td>
                  <td className="py-2 px-3 text-sm capitalize">{view.tenant_id}</td>
                  <td className="py-2 px-3 text-sm font-mono text-xs truncate max-w-xs">{view.path}</td>
                  <td className="py-2 px-3 text-sm">
                    {view.utm_source || (view.referrer ? 'Referrer' : 'Direct')}
                  </td>
                  <td className="py-2 px-3 text-sm">{view.utm_campaign || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>
    </div>
  )
}


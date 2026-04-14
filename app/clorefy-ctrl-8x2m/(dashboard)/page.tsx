'use client'

import { useState, useEffect, useCallback } from 'react'
import KpiCard from '@/components/admin/kpi-card'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  totalUsers: number
  newSignupsToday: number
  newSignupsThisWeek: number
  newSignupsThisMonth: number
  newSignupsThisYear: number
  dailyActiveUsers: number
  monthlyActiveUsers: number
  accountsCreatedThisMonth: number
  activePaidUsers: number
  totalDocumentsAllTime: number
  totalDocumentsThisMonth: number
  totalAIRequestsThisMonth: number
  estimatedAICostThisMonth: number
  totalRevenue: number
  currentMRR: number
  signupsTrend: Array<{ date: string; count: number }>
  documentsTrend: Array<{ date: string; count: number }>
  revenueTrend: Array<{ month: string; amount: number }>
  tierDistribution: Array<{ tier: string; count: number }>
  recentActivity: Array<Record<string, unknown>>
}

type SignupPeriod = 'today' | 'week' | 'month' | 'year'

const PIE_COLORS_DARK = ['#FFFFFF', '#71717A', '#52525B', '#3F3F46']
const PIE_COLORS_LIGHT = ['#0A0A0A', '#52525B', '#71717A', '#A1A1AA']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function getActivityEmail(entry: Record<string, unknown>): string {
  const meta = entry.metadata as Record<string, unknown> | null
  if (meta?.email && typeof meta.email === 'string') return meta.email
  if (meta?.user_email && typeof meta.user_email === 'string') return meta.user_email
  if (entry.user_id && typeof entry.user_id === 'string') return entry.user_id.slice(0, 8) + '…'
  return 'system'
}

// ─── Chart skeleton ───────────────────────────────────────────────────────────

function ChartSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="rounded-lg p-4 border animate-pulse transition-all duration-200"
      style={{
        backgroundColor: isDark ? '#0A0A0A' : '#FAFAFA',
        borderColor: isDark ? '#1A1A1A' : '#E5E5E5',
      }}
    >
      <div className="h-4 rounded w-1/3 mb-4" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
      <div className="h-40 rounded" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [signupPeriod, setSignupPeriod] = useState<SignupPeriod>('month')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/admin/overview')
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Theme-aware chart config
  const chartStroke = isDark ? '#FFFFFF' : '#0A0A0A'
  const gridStroke = isDark ? '#1A1A1A' : '#E5E5E5'
  const axisColor = '#71717A'
  const chartBg = isDark ? '#0A0A0A' : '#FAFAFA'
  const chartBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const pieColors = isDark ? PIE_COLORS_DARK : PIE_COLORS_LIGHT

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? '#111111' : '#FFFFFF',
      border: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
      borderRadius: '8px',
      color: isDark ? '#F5F5F5' : '#0A0A0A',
    },
  }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const signupValue = data
    ? signupPeriod === 'today'
      ? data.newSignupsToday
      : signupPeriod === 'week'
        ? data.newSignupsThisWeek
        : signupPeriod === 'month'
          ? data.newSignupsThisMonth
          : data.newSignupsThisYear ?? data.totalUsers
    : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Overview</h1>
        <p className="text-sm mt-1" style={{ color: '#71717A' }}>{today}</p>
      </div>

      {/* KPI Cards */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Users" value={data?.totalUsers ?? 0} loading={loading} error={error} onRetry={fetchData} />

          {/* New Signups — toggleable */}
          <div
            className="rounded-lg p-4 border transition-all duration-200 hover:scale-[1.02]"
            style={{ backgroundColor: chartBg, borderColor: chartBorder }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm" style={{ color: '#71717A' }}>New Signups</p>
              <div className="flex gap-1">
                {(['today', 'week', 'month', 'year'] as SignupPeriod[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSignupPeriod(p)}
                    className="text-xs px-2 py-0.5 rounded transition-all duration-150 active:scale-95"
                    style={{
                      backgroundColor: signupPeriod === p
                        ? isDark ? '#FFFFFF' : '#0A0A0A'
                        : 'transparent',
                      color: signupPeriod === p
                        ? isDark ? '#0A0A0A' : '#FFFFFF'
                        : '#71717A',
                    }}
                  >
                    {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Year'}
                  </button>
                ))}
              </div>
            </div>
            {loading ? (
              <div className="h-8 rounded w-3/4 animate-pulse mt-2" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
            ) : error ? (
              <p className="text-sm text-red-400 mt-2">Failed to load</p>
            ) : (
              <p className="text-2xl font-bold mt-1" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>{signupValue.toLocaleString()}</p>
            )}
          </div>

          <KpiCard title="Daily Active Users" value={data?.dailyActiveUsers ?? 0} loading={loading} error={error} onRetry={fetchData} />
          <KpiCard title="Monthly Active Users" value={data?.monthlyActiveUsers ?? 0} loading={loading} error={error} onRetry={fetchData} />
          <KpiCard title="Accounts This Month" value={data?.accountsCreatedThisMonth ?? 0} loading={loading} error={error} onRetry={fetchData} />
          <KpiCard title="Active Paid Users" value={data?.activePaidUsers ?? 0} loading={loading} error={error} onRetry={fetchData} />
          <KpiCard title="Total Documents (All Time)" value={data?.totalDocumentsAllTime ?? 0} loading={loading} error={error} onRetry={fetchData} />
          <KpiCard title="Documents This Month" value={data?.totalDocumentsThisMonth ?? 0} loading={loading} error={error} onRetry={fetchData} />
          <KpiCard title="AI Requests This Month" value={data?.totalAIRequestsThisMonth ?? 0} loading={loading} error={error} onRetry={fetchData} />
          <KpiCard title="Estimated AI Cost" value={data?.estimatedAICostThisMonth ?? 0} prefix="₹" loading={loading} error={error} onRetry={fetchData} />
          <KpiCard title="Total Revenue" value={data?.totalRevenue ?? 0} prefix="₹" loading={loading} error={error} onRetry={fetchData} />
          <KpiCard title="Current MRR" value={data?.currentMRR ?? 0} prefix="₹" loading={loading} error={error} onRetry={fetchData} />
        </div>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Signups trend */}
        {loading ? <ChartSkeleton isDark={isDark} /> : (
          <div
            className="rounded-lg p-4 border transition-all duration-200"
            style={{ backgroundColor: chartBg, borderColor: chartBorder }}
          >
            <p className="text-sm mb-4" style={{ color: '#71717A' }}>Signups — Last 30 Days</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data?.signupsTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke={chartStroke} fill={chartStroke} fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Documents trend */}
        {loading ? <ChartSkeleton isDark={isDark} /> : (
          <div
            className="rounded-lg p-4 border transition-all duration-200"
            style={{ backgroundColor: chartBg, borderColor: chartBorder }}
          >
            <p className="text-sm mb-4" style={{ color: '#71717A' }}>Documents — Last 30 Days</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.documentsTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill={chartStroke} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Revenue trend */}
        {loading ? <ChartSkeleton isDark={isDark} /> : (
          <div
            className="rounded-lg p-4 border transition-all duration-200"
            style={{ backgroundColor: chartBg, borderColor: chartBorder }}
          >
            <p className="text-sm mb-4" style={{ color: '#71717A' }}>Revenue — Last 6 Months</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data?.revenueTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="amount" stroke={chartStroke} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tier distribution */}
        {loading ? <ChartSkeleton isDark={isDark} /> : (
          <div
            className="rounded-lg p-4 border transition-all duration-200"
            style={{ backgroundColor: chartBg, borderColor: chartBorder }}
          >
            <p className="text-sm mb-4" style={{ color: '#71717A' }}>Tier Distribution</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={data?.tierDistribution ?? []}
                  nameKey="tier"
                  dataKey="count"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {(data?.tierDistribution ?? []).map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend
                  formatter={(value) => <span style={{ color: axisColor, fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Recent Activity + System Health */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div
          className="lg:col-span-2 rounded-lg p-4 border transition-all duration-200"
          style={{ backgroundColor: chartBg, borderColor: chartBorder }}
        >
          <p className="text-sm font-medium mb-3" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Recent Activity</p>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-red-400">Failed to load activity</p>
          ) : (
            <ul style={{ borderColor: chartBorder }}>
              {(data?.recentActivity ?? []).slice(0, 20).map((entry, i) => (
                <li
                  key={i}
                  className="py-2 flex items-start gap-3 text-sm"
                  style={{ borderBottom: i < 19 ? `1px solid ${chartBorder}` : undefined }}
                >
                  <span className="whitespace-nowrap text-xs mt-0.5" style={{ color: '#52525B' }}>
                    {formatDate(entry.created_at as string)}
                  </span>
                  <span className="font-mono text-xs mt-0.5 whitespace-nowrap" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>
                    {entry.action as string}
                  </span>
                  <span className="truncate" style={{ color: '#71717A' }}>{getActivityEmail(entry)}</span>
                </li>
              ))}
              {(data?.recentActivity ?? []).length === 0 && (
                <li className="py-4 text-center text-sm" style={{ color: '#52525B' }}>No recent activity</li>
              )}
            </ul>
          )}
        </div>

        {/* System Health */}
        <div
          className="rounded-lg p-4 border transition-all duration-200"
          style={{ backgroundColor: chartBg, borderColor: chartBorder }}
        >
          <p className="text-sm font-medium mb-3" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>System Health</p>
          <ul className="space-y-3">
            <li className="flex items-center justify-between">
              <span className="text-sm" style={{ color: '#71717A' }}>Database</span>
              <span className="flex items-center gap-2 text-sm text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Healthy
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-sm" style={{ color: '#71717A' }}>AI API</span>
              <span className="flex items-center gap-2 text-sm text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Healthy
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}

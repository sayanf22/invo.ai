'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'
import { Users, FileText, MessageSquare, DollarSign, TrendingUp, Activity } from 'lucide-react'
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
  activePaidUsers: number
  freeUsers: number
  starterUsers: number
  proUsers: number
  agencyUsers: number
  totalDocumentsAllTime: number
  totalDocumentsToday: number
  totalDocumentsThisWeek: number
  totalDocumentsThisMonth: number
  totalMessagesAllTime: number
  totalMessagesThisMonth: number
  totalMessagesToday: number
  totalAIRequestsThisMonth: number
  totalTokensThisMonth: number
  estimatedAICostThisMonth: number
  estimatedAICostToday: number
  currentMRR: number
  signupsTrend: Array<{ date: string; count: number }>
  documentsTrend: Array<{ date: string; count: number }>
  revenueTrend: Array<{ month: string; amount: number }>
  tierDistribution: Array<{ tier: string; count: number }>
  recentActivity: Array<Record<string, unknown>>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function getActivityEmail(entry: Record<string, unknown>): string {
  const meta = entry.metadata as Record<string, unknown> | null
  if (meta?.email && typeof meta.email === 'string') return meta.email
  if (meta?.user_email && typeof meta.user_email === 'string') return meta.user_email
  if (entry.user_id && typeof entry.user_id === 'string') return entry.user_id.slice(0, 8) + '…'
  return 'system'
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, loading, isDark,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  loading: boolean
  isDark: boolean
}) {
  const bg = isDark ? '#0A0A0A' : '#FAFAFA'
  const border = isDark ? '#1A1A1A' : '#E5E5E5'

  if (loading) {
    return (
      <div className="rounded-xl p-5 border animate-pulse" style={{ backgroundColor: bg, borderColor: border }}>
        <div className="h-3 w-20 rounded mb-3" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
        <div className="h-7 w-16 rounded" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
      </div>
    )
  }

  return (
    <div className="rounded-xl p-5 border transition-all duration-200 hover:scale-[1.01]"
      style={{ backgroundColor: bg, borderColor: border }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#71717A' }}>{label}</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0' }}>
          <Icon className="w-3.5 h-3.5" style={{ color: isDark ? '#A1A1AA' : '#52525B' }} />
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: '#52525B' }}>{sub}</p>}
    </div>
  )
}

// ─── Chart skeleton ───────────────────────────────────────────────────────────

function ChartSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="rounded-xl p-5 border animate-pulse"
      style={{ backgroundColor: isDark ? '#0A0A0A' : '#FAFAFA', borderColor: isDark ? '#1A1A1A' : '#E5E5E5' }}>
      <div className="h-3 w-32 rounded mb-4" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
      <div className="h-44 rounded" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
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

  const fetchData = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const res = await fetch('/api/admin/overview')
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const chartBg = isDark ? '#0A0A0A' : '#FAFAFA'
  const chartBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const gridStroke = isDark ? '#1A1A1A' : '#E5E5E5'
  const axisColor = '#71717A'
  const chartStroke = isDark ? '#FFFFFF' : '#0A0A0A'
  const pieColors = isDark
    ? ['#FFFFFF', '#71717A', '#52525B', '#3F3F46']
    : ['#0A0A0A', '#52525B', '#71717A', '#A1A1AA']
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

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: '#71717A' }}>{today}</p>
        </div>
        {error && (
          <button onClick={fetchData}
            className="text-xs px-3 py-1.5 rounded-md border transition-colors"
            style={{ borderColor: chartBorder, color: '#71717A' }}>
            Retry
          </button>
        )}
      </div>

      {/* ── Row 1: Key metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={(data?.totalUsers ?? 0).toLocaleString()}
          sub={`${data?.dailyActiveUsers ?? 0} active today`}
          icon={Users} loading={loading} isDark={isDark} />
        <StatCard label="Documents" value={(data?.totalDocumentsAllTime ?? 0).toLocaleString()}
          sub={`${data?.totalDocumentsToday ?? 0} today · ${data?.totalDocumentsThisMonth ?? 0} this month`}
          icon={FileText} loading={loading} isDark={isDark} />
        <StatCard label="Chat Messages" value={(data?.totalMessagesAllTime ?? 0).toLocaleString()}
          sub={`${data?.totalMessagesToday ?? 0} today`}
          icon={MessageSquare} loading={loading} isDark={isDark} />
        <StatCard label="MRR"
          value={`₹${(data?.currentMRR ?? 0).toLocaleString()}`}
          sub={`${data?.activePaidUsers ?? 0} paid users`}
          icon={DollarSign} loading={loading} isDark={isDark} />
      </div>

      {/* ── Row 2: Growth metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="New Signups Today" value={data?.newSignupsToday ?? 0}
          icon={TrendingUp} loading={loading} isDark={isDark} />
        <StatCard label="New Signups This Week" value={data?.newSignupsThisWeek ?? 0}
          icon={TrendingUp} loading={loading} isDark={isDark} />
        <StatCard label="New Signups This Month" value={data?.newSignupsThisMonth ?? 0}
          icon={TrendingUp} loading={loading} isDark={isDark} />
        <StatCard label="MAU (30d)" value={data?.monthlyActiveUsers ?? 0}
          sub="Monthly active users"
          icon={Activity} loading={loading} isDark={isDark} />
      </div>

      {/* ── Row 3: Tier breakdown ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#52525B' }}>
          Users by Plan
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Free', value: data?.freeUsers ?? 0 },
            { label: 'Starter', value: data?.starterUsers ?? 0 },
            { label: 'Pro', value: data?.proUsers ?? 0 },
            { label: 'Agency', value: data?.agencyUsers ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border p-4 flex items-center justify-between"
              style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
              {loading ? (
                <div className="h-5 w-full rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
              ) : (
                <>
                  <span className="text-sm" style={{ color: '#71717A' }}>{label}</span>
                  <span className="text-xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>
                    {value.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 4: Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? <ChartSkeleton isDark={isDark} /> : (
          <div className="rounded-xl p-5 border" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
            <p className="text-sm font-medium mb-4" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Signups — Last 30 Days</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data?.signupsTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke={chartStroke} fill={chartStroke} fillOpacity={0.08} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {loading ? <ChartSkeleton isDark={isDark} /> : (
          <div className="rounded-xl p-5 border" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
            <p className="text-sm font-medium mb-4" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Documents — Last 30 Days</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.documentsTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill={chartStroke} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {loading ? <ChartSkeleton isDark={isDark} /> : (
          <div className="rounded-xl p-5 border" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
            <p className="text-sm font-medium mb-4" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Revenue — Last 6 Months</p>
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

        {loading ? <ChartSkeleton isDark={isDark} /> : (
          <div className="rounded-xl p-5 border" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
            <p className="text-sm font-medium mb-4" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Tier Distribution</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data?.tierDistribution ?? []} nameKey="tier" dataKey="count"
                  cx="50%" cy="50%" outerRadius={65}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {(data?.tierDistribution ?? []).map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend formatter={(v) => <span style={{ color: axisColor, fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Row 5: Recent Activity + System Health ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border p-5"
          style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
          <p className="text-sm font-medium mb-4" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Recent Activity</p>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
              ))}
            </div>
          ) : (
            <ul>
              {(data?.recentActivity ?? []).slice(0, 15).map((entry, i, arr) => (
                <li key={i} className="py-2.5 flex items-start gap-3 text-sm"
                  style={{ borderBottom: i < arr.length - 1 ? `1px solid ${chartBorder}` : undefined }}>
                  <span className="text-xs whitespace-nowrap mt-0.5 w-28 shrink-0" style={{ color: '#52525B' }}>
                    {formatDate(entry.created_at as string)}
                  </span>
                  <span className="font-mono text-xs mt-0.5 whitespace-nowrap" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>
                    {entry.action as string}
                  </span>
                  <span className="truncate text-xs" style={{ color: '#71717A' }}>
                    {getActivityEmail(entry)}
                  </span>
                </li>
              ))}
              {(data?.recentActivity ?? []).length === 0 && (
                <li className="py-6 text-center text-sm" style={{ color: '#52525B' }}>No recent activity</li>
              )}
            </ul>
          )}
        </div>

        <div className="rounded-xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
          <p className="text-sm font-medium mb-4" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>System Health</p>
          <ul className="space-y-4">
            {[
              { label: 'Database', status: 'Healthy' },
              { label: 'AI API', status: 'Healthy' },
              { label: 'Storage', status: 'Healthy' },
              { label: 'Auth', status: 'Healthy' },
            ].map(({ label, status }) => (
              <li key={label} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#71717A' }}>{label}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  {status}
                </span>
              </li>
            ))}
          </ul>

          {/* Quick stats */}
          <div className="mt-6 pt-4 space-y-3" style={{ borderTop: `1px solid ${chartBorder}` }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#52525B' }}>AI This Month</p>
            <div className="flex justify-between text-sm">
              <span style={{ color: '#71717A' }}>Requests</span>
              <span style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
                {loading ? '—' : (data?.totalAIRequestsThisMonth ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: '#71717A' }}>Tokens</span>
              <span style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
                {loading ? '—' : (data?.totalTokensThisMonth ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: '#71717A' }}>Est. Cost</span>
              <span style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
                {loading ? '—' : `₹${(data?.estimatedAICostThisMonth ?? 0).toLocaleString()}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

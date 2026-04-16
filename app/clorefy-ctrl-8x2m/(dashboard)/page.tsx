'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'
import { Users, FileText, MessageSquare, DollarSign, TrendingUp, Activity, RefreshCw, Clock } from 'lucide-react'
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

interface OverviewData {
  totalUsers: number
  newSignupsToday: number
  newSignupsThisWeek: number
  newSignupsThisMonth: number
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
  currentMRR: number
  signupsTrend: Array<{ date: string; count: number }>
  documentsTrend: Array<{ date: string; count: number }>
  revenueTrend: Array<{ month: string; amount: number }>
  tierDistribution: Array<{ tier: string; count: number }>
  recentActivity: Array<Record<string, unknown>>
}

interface ActivityData {
  byDocType: Array<{
    type: string
    hourly: Array<{ hour: number; count: number }>
    peakHour: number
    total: number
  }>
  overallHourly: Array<{ hour: number; count: number }>
  overallPeakHour: number
  totalLast30Days: number
  dailyTrend: Array<{ date: string; invoice: number; contract: number; quotation: number; proposal: number; total: number }>
}

function formatHour(h: number): string {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function getActivityEmail(entry: Record<string, unknown>): string {
  const meta = entry.metadata as Record<string, unknown> | null
  if (meta?.email && typeof meta.email === 'string') return meta.email
  if (meta?.user_email && typeof meta.user_email === 'string') return meta.user_email
  if (entry.user_id && typeof entry.user_id === 'string') return entry.user_id.slice(0, 8) + '…'
  return 'system'
}

function MetricCard({ label, value, sub, icon: Icon, accent, loading, isDark }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType
  accent?: boolean; loading: boolean; isDark: boolean
}) {
  const bg = accent
    ? isDark ? '#0F0F0F' : '#FAFAFA'
    : isDark ? '#0A0A0A' : '#FFFFFF'
  const border = isDark ? '#1F1F1F' : '#E5E5E5'

  if (loading) {
    return (
      <div className="rounded-2xl p-6 border animate-pulse" style={{ backgroundColor: bg, borderColor: border }}>
        <div className="h-3 w-24 rounded mb-4" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
        <div className="h-9 w-20 rounded mb-2" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
        <div className="h-3 w-32 rounded" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-6 border transition-all duration-200 hover:scale-[1.01] cursor-default"
      style={{ backgroundColor: bg, borderColor: border }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#71717A' }}>{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0' }}>
          <Icon className="w-4 h-4" style={{ color: isDark ? '#A1A1AA' : '#52525B' }} />
        </div>
      </div>
      <p className="text-4xl font-bold tracking-tight mb-1.5" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>{value}</p>
      {sub && <p className="text-xs leading-relaxed" style={{ color: '#71717A' }}>{sub}</p>}
    </div>
  )
}

function SectionLabel({ children, isDark }: { children: string; isDark: boolean }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>
      {children}
    </p>
  )
}

function ChartBox({ title, children, isDark, loading }: { title: string; children: React.ReactNode; isDark: boolean; loading?: boolean }) {
  const bg = isDark ? '#0A0A0A' : '#FAFAFA'
  const border = isDark ? '#1A1A1A' : '#E5E5E5'
  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: bg, borderColor: border }}>
      <p className="text-sm font-semibold mb-4" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>{title}</p>
      {loading ? (
        <div className="h-44 rounded-xl animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
      ) : children}
    </div>
  )
}

const DOC_COLORS: Record<string, string> = {
  invoice: '#E07B39',
  contract: '#6366F1',
  quotation: '#22C55E',
  proposal: '#F59E0B',
}

export default function AdminOverviewPage() {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'
  const [data, setData] = useState<OverviewData | null>(null)
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actLoading, setActLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const res = await fetch('/api/admin/overview')
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
      setLastRefresh(new Date())
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [])

  const fetchActivity = useCallback(async () => {
    setActLoading(true)
    try {
      const res = await fetch('/api/admin/activity')
      if (!res.ok) throw new Error('Failed')
      setActivity(await res.json())
    } catch { /* non-blocking */ }
    finally { setActLoading(false) }
  }, [])

  useEffect(() => { fetchData(); fetchActivity() }, [fetchData, fetchActivity])

  const bg = isDark ? '#000000' : '#F5F5F5'
  const chartBg = isDark ? '#0A0A0A' : '#FAFAFA'
  const chartBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const gridStroke = isDark ? '#1A1A1A' : '#EBEBEB'
  const axisColor = '#71717A'
  const chartStroke = isDark ? '#FFFFFF' : '#0A0A0A'
  const pieColors = isDark ? ['#FFFFFF', '#71717A', '#52525B', '#3F3F46'] : ['#0A0A0A', '#52525B', '#71717A', '#A1A1AA']
  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? '#111111' : '#FFFFFF',
      border: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
      borderRadius: '10px',
      color: isDark ? '#F5F5F5' : '#0A0A0A',
      fontSize: 12,
    },
  }

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-10 pb-10">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#71717A' }}>{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#52525B' }}>
            Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={() => { fetchData(); fetchActivity() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
            style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}>
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl text-sm flex items-center justify-between"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
          <span>Failed to load dashboard data.</span>
          <button onClick={fetchData} className="underline text-xs">Retry</button>
        </div>
      )}

      {/* ── Section 1: Core KPIs ── */}
      <div>
        <SectionLabel isDark={isDark}>Core Metrics</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Users" icon={Users} loading={loading} isDark={isDark}
            value={(data?.totalUsers ?? 0).toLocaleString()}
            sub={`${data?.dailyActiveUsers ?? 0} active today · ${data?.monthlyActiveUsers ?? 0} this month`} />
          <MetricCard label="Documents Generated" icon={FileText} loading={loading} isDark={isDark}
            value={(data?.totalDocumentsAllTime ?? 0).toLocaleString()}
            sub={`${data?.totalDocumentsToday ?? 0} today · ${data?.totalDocumentsThisWeek ?? 0} this week · ${data?.totalDocumentsThisMonth ?? 0} this month`} />
          <MetricCard label="Chat Messages" icon={MessageSquare} loading={loading} isDark={isDark}
            value={(data?.totalMessagesAllTime ?? 0).toLocaleString()}
            sub={`${data?.totalMessagesToday ?? 0} today · ${data?.totalMessagesThisMonth ?? 0} this month`} />
          <MetricCard label="Monthly Revenue" icon={DollarSign} loading={loading} isDark={isDark}
            value={`₹${(data?.currentMRR ?? 0).toLocaleString()}`}
            sub={`${data?.activePaidUsers ?? 0} paid users · ₹${((data?.currentMRR ?? 0) * 12).toLocaleString()} ARR`} />
        </div>
      </div>

      {/* ── Section 2: User Engagement ── */}
      <div>
        <SectionLabel isDark={isDark}>User Engagement</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="DAU" icon={Activity} loading={loading} isDark={isDark}
            value={data?.dailyActiveUsers ?? 0}
            sub="Active in last 24 hours" />
          <MetricCard label="MAU" icon={Activity} loading={loading} isDark={isDark}
            value={data?.monthlyActiveUsers ?? 0}
            sub="Active in last 30 days" />
          <MetricCard label="New Today" icon={TrendingUp} loading={loading} isDark={isDark}
            value={data?.newSignupsToday ?? 0}
            sub={`${data?.newSignupsThisWeek ?? 0} this week`} />
          <MetricCard label="New This Month" icon={TrendingUp} loading={loading} isDark={isDark}
            value={data?.newSignupsThisMonth ?? 0}
            sub="New signups this month" />
        </div>
      </div>

      {/* ── Section 3: Plan Breakdown ── */}
      <div>
        <SectionLabel isDark={isDark}>Users by Plan</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Free', value: data?.freeUsers ?? 0, color: '#71717A' },
            { label: 'Starter ₹999/mo', value: data?.starterUsers ?? 0, color: '#6366F1' },
            { label: 'Pro ₹2,499/mo', value: data?.proUsers ?? 0, color: '#E07B39' },
            { label: 'Agency ₹5,999/mo', value: data?.agencyUsers ?? 0, color: '#22C55E' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border p-5 flex flex-col gap-2"
              style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
              {loading ? (
                <div className="h-8 w-full rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium" style={{ color: '#71717A' }}>{label}</span>
                  </div>
                  <span className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>
                    {value.toLocaleString()}
                  </span>
                  <span className="text-xs" style={{ color: '#52525B' }}>
                    {data?.totalUsers ? `${((value / data.totalUsers) * 100).toFixed(0)}% of users` : '—'}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 4: Trend Charts ── */}
      <div>
        <SectionLabel isDark={isDark}>Trends — Last 30 Days</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartBox title="Signups" isDark={isDark} loading={loading}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data?.signupsTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke={chartStroke} fill={chartStroke} fillOpacity={0.07} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartBox>

          <ChartBox title="Documents Generated" isDark={isDark} loading={loading}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.documentsTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill="#E07B39" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>

          <ChartBox title="Revenue — Last 6 Months" isDark={isDark} loading={loading}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data?.revenueTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
                <Line type="monotone" dataKey="amount" stroke="#22C55E" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>

          <ChartBox title="Tier Distribution" isDark={isDark} loading={loading}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={(data?.tierDistribution ?? []).map(d => ({ ...d, tier: d.tier.charAt(0).toUpperCase() + d.tier.slice(1) }))}
                  nameKey="tier" dataKey="count" cx="50%" cy="50%" outerRadius={65}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {(data?.tierDistribution ?? []).map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend formatter={(v) => <span style={{ color: axisColor, fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>
      </div>

      {/* ── Section 5: Document Activity Insights ── */}
      <div>
        <SectionLabel isDark={isDark}>Document Activity — Peak Times (Last 30 Days)</SectionLabel>

        {/* Overall peak hour summary */}
        {!actLoading && activity && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {activity.byDocType.map(dt => (
              <div key={dt.type} className="rounded-2xl border p-4 flex flex-col gap-1"
                style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DOC_COLORS[dt.type] ?? '#71717A' }} />
                  <span className="text-xs font-semibold capitalize" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>{dt.type}</span>
                </div>
                <span className="text-2xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>{dt.total.toLocaleString()}</span>
                <div className="flex items-center gap-1 text-xs" style={{ color: '#71717A' }}>
                  <Clock className="w-3 h-3" />
                  Peak: {formatHour(dt.peakHour)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hourly heatmap per doc type */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartBox title="Overall — Hourly Activity (UTC)" isDark={isDark} loading={actLoading}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={activity?.overallHourly ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="hour" tick={{ fill: axisColor, fontSize: 9 }} tickLine={false}
                  tickFormatter={formatHour} interval={2} />
                <YAxis tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} labelFormatter={(v) => `${formatHour(Number(v))} UTC`} />
                <Bar dataKey="count" fill={chartStroke} radius={[2, 2, 0, 0]} name="Documents" />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>

          <ChartBox title="Daily Trend by Document Type" isDark={isDark} loading={actLoading}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={activity?.dailyTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 9 }} tickLine={false} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="invoice" stackId="1" stroke={DOC_COLORS.invoice} fill={DOC_COLORS.invoice} fillOpacity={0.7} name="Invoice" />
                <Area type="monotone" dataKey="contract" stackId="1" stroke={DOC_COLORS.contract} fill={DOC_COLORS.contract} fillOpacity={0.7} name="Contract" />
                <Area type="monotone" dataKey="quotation" stackId="1" stroke={DOC_COLORS.quotation} fill={DOC_COLORS.quotation} fillOpacity={0.7} name="Quotation" />
                <Area type="monotone" dataKey="proposal" stackId="1" stroke={DOC_COLORS.proposal} fill={DOC_COLORS.proposal} fillOpacity={0.7} name="Proposal" />
                <Legend formatter={(v) => <span style={{ color: axisColor, fontSize: 11 }}>{v}</span>} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartBox>

          {(activity?.byDocType ?? []).map(dt => (
            <ChartBox key={dt.type} title={`${dt.type.charAt(0).toUpperCase() + dt.type.slice(1)} — Hourly Peak (UTC)`} isDark={isDark} loading={actLoading}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dt.hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="hour" tick={{ fill: axisColor, fontSize: 9 }} tickLine={false}
                    tickFormatter={formatHour} interval={2} />
                  <YAxis tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} labelFormatter={(v) => `${formatHour(Number(v))} UTC`} />
                  <Bar dataKey="count" fill={DOC_COLORS[dt.type] ?? '#71717A'} radius={[2, 2, 0, 0]} name="Documents" />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          ))}
        </div>
      </div>

      {/* ── Section 6: AI Cost + Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
          <p className="text-sm font-semibold mb-5" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>AI Usage This Month</p>
          <div className="space-y-4">
            {[
              { label: 'Requests', value: loading ? '—' : (data?.totalAIRequestsThisMonth ?? 0).toLocaleString() },
              { label: 'Tokens Used', value: loading ? '—' : (data?.totalTokensThisMonth ?? 0).toLocaleString() },
              { label: 'Est. Cost', value: loading ? '—' : `₹${(data?.estimatedAICostThisMonth ?? 0).toLocaleString()}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2"
                style={{ borderBottom: `1px solid ${chartBorder}` }}>
                <span className="text-sm" style={{ color: '#71717A' }}>{label}</span>
                <span className="text-sm font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#52525B' }}>System Status</p>
            {['Database', 'AI API', 'Storage', 'Auth'].map(s => (
              <div key={s} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#71717A' }}>{s}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />Healthy
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
          <p className="text-sm font-semibold mb-4" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Recent Activity</p>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-8 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
              ))}
            </div>
          ) : (
            <ul>
              {(data?.recentActivity ?? []).slice(0, 12).map((entry, i, arr) => (
                <li key={i} className="py-2.5 flex items-start gap-3"
                  style={{ borderBottom: i < arr.length - 1 ? `1px solid ${chartBorder}` : undefined }}>
                  <span className="text-[11px] whitespace-nowrap mt-0.5 w-28 shrink-0" style={{ color: '#52525B' }}>
                    {formatDate(entry.created_at as string)}
                  </span>
                  <span className="font-mono text-[11px] mt-0.5 whitespace-nowrap" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>
                    {entry.action as string}
                  </span>
                  <span className="truncate text-[11px]" style={{ color: '#71717A' }}>
                    {getActivityEmail(entry)}
                  </span>
                </li>
              ))}
              {(data?.recentActivity ?? []).length === 0 && (
                <li className="py-8 text-center text-sm" style={{ color: '#52525B' }}>No recent activity</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'
import { Users, FileText, MessageSquare, DollarSign, Activity, ArrowRight, RefreshCw, Mail, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import TimePeriodPicker, { type DateRange, rangeToQueryParams } from '@/components/admin/time-period-picker'
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  period: string
  // User
  totalUsers: number
  signupsInPeriod: number
  signupsDelta: number | null
  newSignupsToday: number
  newSignupsThisWeek: number
  newSignupsThisMonth: number
  newSignupsThisYear: number
  activeInPeriod: number
  dailyActiveUsers: number
  weeklyActiveUsers: number
  monthlyActiveUsers: number
  activePaidUsers: number
  freeUsers: number
  starterUsers: number
  proUsers: number
  agencyUsers: number
  tierDistribution: Array<{ tier: string; count: number }>
  // Documents
  totalDocuments: number
  documentsDelta: number | null
  totalDocumentsAllTime: number
  totalDocumentsToday: number
  totalDocumentsThisWeek: number
  totalDocumentsThisMonth: number
  totalDocumentsThisYear: number
  // Chat
  totalMessagesAllTime: number
  // Emails
  totalEmailsSent: number
  totalEmailsAllTime: number
  totalEmailsToday: number
  totalEmailsThisMonth: number
  emailsOpenedThisMonth: number
  emailsDeliveredThisMonth: number
  emailsBouncedThisMonth: number
  emailsOpened: number
  // AI
  aiRequests: number
  aiTokens: number
  aiCostINR: number
  totalAIRequestsThisMonth: number
  estimatedAICostThisMonth: number
  // Revenue
  currentMRR: number
  arr: number
  // Trends
  signupsTrend: Array<{ date: string; count: number }>
  documentsTrend: Array<{ date: string; count: number }>
  revenueTrend: Array<{ month: string; amount: number }>
  recentActivity: Array<Record<string, unknown>>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function getActivityEmail(entry: Record<string, unknown>): string {
  if (entry.user_email && typeof entry.user_email === 'string') return entry.user_email
  const meta = entry.metadata as Record<string, unknown> | null
  if (meta?.email && typeof meta.email === 'string') return meta.email
  if (entry.user_id && typeof entry.user_id === 'string') return entry.user_id.slice(0, 8) + '…'
  return 'system'
}

// Delta badge
function Delta({ val }: { val: number | null }) {
  if (val === null) return null
  const up = val > 0
  const zero = val === 0
  const color = zero ? '#71717A' : up ? '#22C55E' : '#EF4444'
  return (
    <span className="text-[11px] font-semibold" style={{ color }}>
      {zero ? '—' : `${up ? '+' : ''}${val}%`}
    </span>
  )
}

// ─── KPI tile (links to detail page) ─────────────────────────────────────────

function KpiTile({ label, value, sub, icon: Icon, href, loading, isDark, delta }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType
  href: string; loading: boolean; isDark: boolean; delta?: number | null
}) {
  const bg = isDark ? '#0A0A0A' : '#FFFFFF'
  const border = isDark ? '#1F1F1F' : '#E5E5E5'
  if (loading) return (
    <div className="rounded-2xl p-5 border animate-pulse" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="h-3 w-20 rounded mb-4" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
      <div className="h-8 w-24 rounded mb-2" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
    </div>
  )
  return (
    <Link href={href} className="group rounded-2xl p-5 border flex flex-col transition-all duration-200 hover:scale-[1.01]"
      style={{ backgroundColor: bg, borderColor: border }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest truncate" style={{ color: '#71717A' }}>{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0' }}>
            <Icon className="w-3.5 h-3.5" style={{ color: isDark ? '#A1A1AA' : '#52525B' }} />
          </div>
          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#71717A' }} />
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight mb-1 truncate" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>{value}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {delta !== undefined && <Delta val={delta ?? null} />}
        {sub && <p className="text-xs leading-relaxed" style={{ color: '#71717A' }}>{sub}</p>}
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [range, setRange] = useState<DateRange>({ period: 'month' })

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const fetchData = useCallback(async (r: DateRange) => {
    setLoading(true); setError(false)
    try {
      const qs = rangeToQueryParams(r)
      const res = await fetch(`/api/admin/overview?${qs}`)
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(range) }, [fetchData, range])

  const chartBg = isDark ? '#0A0A0A' : '#FAFAFA'
  const chartBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const gridStroke = isDark ? '#1A1A1A' : '#EBEBEB'
  const axisColor = '#71717A'
  const chartStroke = isDark ? '#FFFFFF' : '#0A0A0A'
  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? '#111111' : '#FFFFFF',
      border: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
      borderRadius: '10px', color: isDark ? '#F5F5F5' : '#0A0A0A', fontSize: 12,
    },
  }

  // Period-aware values
  const p = range.period
  const docsValue = p === 'today' ? (data?.totalDocumentsToday ?? 0)
    : p === 'week' ? (data?.totalDocumentsThisWeek ?? 0)
    : p === 'year' ? (data?.totalDocumentsThisYear ?? data?.totalDocumentsAllTime ?? 0)
    : p === 'all' ? (data?.totalDocumentsAllTime ?? 0)
    : (data?.totalDocuments ?? data?.totalDocumentsThisMonth ?? 0)  // month + custom

  const emailsValue = p === 'today' ? (data?.totalEmailsToday ?? 0)
    : p === 'all' ? (data?.totalEmailsAllTime ?? 0)
    : (data?.totalEmailsThisMonth ?? 0)

  const activeUsersValue = p === 'today' ? (data?.dailyActiveUsers ?? 0)
    : p === 'week' ? (data?.weeklyActiveUsers ?? 0)
    : p === 'year' ? (data?.activeInPeriod ?? 0)
    : p === 'all' ? (data?.totalUsers ?? 0)
    : (data?.monthlyActiveUsers ?? 0)

  const signupsValue = p === 'today' ? (data?.newSignupsToday ?? 0)
    : p === 'week' ? (data?.newSignupsThisWeek ?? 0)
    : p === 'year' ? (data?.newSignupsThisYear ?? 0)
    : p === 'all' ? (data?.totalUsers ?? 0)
    : (data?.newSignupsThisMonth ?? 0)

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: '#71717A' }} suppressHydrationWarning>{today}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TimePeriodPicker value={range} onChange={(r) => setRange(r)} />
          <button onClick={() => fetchData(range)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
            style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}>
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl text-sm flex items-center justify-between"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
          <span>Failed to load data.</span>
          <button onClick={() => fetchData(range)} className="underline text-xs">Retry</button>
        </div>
      )}

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile label="Total Users" icon={Users} loading={loading} isDark={isDark}
          href="/clorefy-ctrl-8x2m/analytics/engagement"
          value={(data?.totalUsers ?? 0).toLocaleString()}
          sub={`${data?.dailyActiveUsers ?? 0} DAU`} />
        <KpiTile label="Signups" icon={TrendingUp} loading={loading} isDark={isDark}
          href="/clorefy-ctrl-8x2m/analytics/engagement"
          value={signupsValue.toLocaleString()}
          delta={data?.signupsDelta}
          sub={`${data?.activePaidUsers ?? 0} paid`} />
        <KpiTile label="Documents" icon={FileText} loading={loading} isDark={isDark}
          href="/clorefy-ctrl-8x2m/analytics/documents"
          value={docsValue.toLocaleString()}
          delta={data?.documentsDelta}
          sub={`${data?.totalDocumentsAllTime ?? 0} all time`} />
        <KpiTile label="Emails Sent" icon={Mail} loading={loading} isDark={isDark}
          href="/clorefy-ctrl-8x2m/email-campaigns"
          value={emailsValue.toLocaleString()}
          sub={`${data?.emailsOpened ?? 0} opened`} />
        <KpiTile label="AI Requests" icon={MessageSquare} loading={loading} isDark={isDark}
          href="/clorefy-ctrl-8x2m/ai-usage"
          value={(data?.aiRequests ?? 0).toLocaleString()}
          sub={`₹${(data?.aiCostINR ?? 0).toLocaleString()} est.`} />
        <KpiTile label="MRR" icon={DollarSign} loading={loading} isDark={isDark}
          href="/clorefy-ctrl-8x2m/revenue"
          value={`₹${(data?.currentMRR ?? 0).toLocaleString()}`}
          sub={`₹${((data?.arr ?? 0)).toLocaleString()} ARR`} />
      </div>

      {/* ── Active users row ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>
          Active Users
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'DAU', value: data?.dailyActiveUsers ?? 0, sub: 'Last 24 hours' },
            { label: 'WAU', value: data?.weeklyActiveUsers ?? 0, sub: 'Last 7 days' },
            { label: 'MAU', value: data?.monthlyActiveUsers ?? 0, sub: 'Last 30 days' },
            { label: 'Total Active', value: data?.activeInPeriod ?? 0, sub: 'In selected period' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-2xl border p-4"
              style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
              {loading ? (
                <div className="h-8 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
              ) : (
                <>
                  <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#71717A' }}>{label}</p>
                  <p className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>{value.toLocaleString()}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>{sub}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Plan breakdown ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>
          Plan Breakdown
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Free', value: data?.freeUsers ?? 0, color: '#71717A' },
            { label: 'Starter', value: data?.starterUsers ?? 0, color: '#6366F1' },
            { label: 'Pro', value: data?.proUsers ?? 0, color: '#E07B39' },
            { label: 'Agency', value: data?.agencyUsers ?? 0, color: '#22C55E' },
          ].map(({ label, value, color }) => {
            const total = data?.totalUsers ?? 1
            const pct = total > 0 ? ((value / total) * 100).toFixed(0) : 0
            return (
              <div key={label} className="rounded-2xl border p-4"
                style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
                {loading ? (
                  <div className="h-8 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs font-medium" style={{ color: '#71717A' }}>{label}</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>{value.toLocaleString()}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>{pct}% of total</p>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Analytics nav cards ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>
          Sections
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/clorefy-ctrl-8x2m/analytics/engagement', icon: Users, title: 'User Engagement',
              desc: `${data?.totalUsers ?? '—'} users · ${data?.monthlyActiveUsers ?? '—'} MAU` },
            { href: '/clorefy-ctrl-8x2m/analytics/documents', icon: FileText, title: 'Documents & AI',
              desc: `${(data?.totalDocumentsAllTime ?? 0).toLocaleString()} total docs generated` },
            { href: '/clorefy-ctrl-8x2m/analytics/activity', icon: Activity, title: 'Peak Activity',
              desc: 'Hourly heatmaps by document type' },
          ].map(({ href, icon: Icon, title, desc }) => (
            <Link key={href} href={href}
              className="group flex items-start gap-4 rounded-2xl border p-4 transition-all duration-200 hover:scale-[1.01]"
              style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0' }}>
                <Icon className="w-4 h-4" style={{ color: isDark ? '#A1A1AA' : '#52525B' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{title}</p>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: '#71717A' }} />
                </div>
                <p className="text-xs mt-1" style={{ color: '#71717A' }}>{loading ? '—' : desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Trend charts ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>
          Trends — Last 60 Days
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Signups */}
          <div className="rounded-2xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
            <p className="text-sm font-semibold mb-4" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Signups</p>
            {loading ? <div className="h-36 rounded-xl animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} /> : (
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={data?.signupsTrend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 9 }} tickLine={false} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: axisColor, fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke={chartStroke} fill={chartStroke} fillOpacity={0.07} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Documents */}
          <div className="rounded-2xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
            <p className="text-sm font-semibold mb-4" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Documents</p>
            {loading ? <div className="h-36 rounded-xl animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} /> : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={data?.documentsTrend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 9 }} tickLine={false} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: axisColor, fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" fill="#E07B39" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Revenue */}
          <div className="rounded-2xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
            <p className="text-sm font-semibold mb-4" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Revenue (₹)</p>
            {loading ? <div className="h-36 rounded-xl animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} /> : (
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={data?.revenueTrend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 9 }} tickLine={false} />
                  <YAxis tick={{ fill: axisColor, fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Line type="monotone" dataKey="amount" stroke="#22C55E" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="rounded-2xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
        <p className="text-sm font-semibold mb-4" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Recent Activity</p>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
            ))}
          </div>
        ) : (
          <ul>
            {(data?.recentActivity ?? []).slice(0, 12).map((entry, i, arr) => (
              <li key={i} className="py-2 flex flex-wrap sm:flex-nowrap items-start gap-2"
                style={{ borderBottom: i < arr.length - 1 ? `1px solid ${chartBorder}` : undefined }}>
                <span className="text-[11px] sm:whitespace-nowrap shrink-0 sm:w-28" style={{ color: '#52525B' }}>
                  {formatDate(entry.created_at as string)}
                </span>
                <span className="font-mono text-[11px] break-all sm:whitespace-nowrap" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>
                  {entry.action as string}
                </span>
                <span className="text-[11px] break-all" style={{ color: '#71717A' }}>
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
    </div>
  )
}

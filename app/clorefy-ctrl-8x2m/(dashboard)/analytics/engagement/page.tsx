'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'
import { Users, TrendingUp, Activity, RefreshCw } from 'lucide-react'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

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
  signupsTrend: Array<{ date: string; count: number }>
  tierDistribution: Array<{ tier: string; count: number }>
}

function MetricCard({ label, value, sub, icon: Icon, loading, isDark }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; loading: boolean; isDark: boolean
}) {
  const bg = isDark ? '#0A0A0A' : '#FFFFFF'
  const border = isDark ? '#1F1F1F' : '#E5E5E5'
  if (loading) return (
    <div className="rounded-2xl p-6 border animate-pulse" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="h-3 w-24 rounded mb-4" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
      <div className="h-9 w-20 rounded mb-2" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
    </div>
  )
  return (
    <div className="rounded-2xl p-6 border" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#71717A' }}>{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0' }}>
          <Icon className="w-4 h-4" style={{ color: isDark ? '#A1A1AA' : '#52525B' }} />
        </div>
      </div>
      <p className="text-4xl font-bold tracking-tight mb-1.5" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: '#71717A' }}>{sub}</p>}
    </div>
  )
}

export default function EngagementPage() {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/overview')
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

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
      borderRadius: '10px', color: isDark ? '#F5F5F5' : '#0A0A0A', fontSize: 12,
    },
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>User Engagement</h1>
          <p className="text-sm mt-0.5" style={{ color: '#71717A' }}>Active users, signups, and plan distribution</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}>
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Active users */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>Active Users</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Users" icon={Users} loading={loading} isDark={isDark}
            value={(data?.totalUsers ?? 0).toLocaleString()} sub="All registered accounts" />
          <MetricCard label="DAU" icon={Activity} loading={loading} isDark={isDark}
            value={data?.dailyActiveUsers ?? 0} sub="Active in last 24 hours" />
          <MetricCard label="MAU" icon={Activity} loading={loading} isDark={isDark}
            value={data?.monthlyActiveUsers ?? 0} sub="Active in last 30 days" />
          <MetricCard label="Paid Users" icon={Users} loading={loading} isDark={isDark}
            value={data?.activePaidUsers ?? 0} sub="Non-free active accounts" />
        </div>
      </div>

      {/* Signups */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>New Signups</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Today" icon={TrendingUp} loading={loading} isDark={isDark} value={data?.newSignupsToday ?? 0} />
          <MetricCard label="This Week" icon={TrendingUp} loading={loading} isDark={isDark} value={data?.newSignupsThisWeek ?? 0} />
          <MetricCard label="This Month" icon={TrendingUp} loading={loading} isDark={isDark} value={data?.newSignupsThisMonth ?? 0} />
          <MetricCard label="This Year" icon={TrendingUp} loading={loading} isDark={isDark} value={data?.newSignupsThisYear ?? 0} />
        </div>
      </div>

      {/* Plan breakdown */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>Plan Breakdown</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Free', value: data?.freeUsers ?? 0, color: '#71717A' },
            { label: 'Starter', value: data?.starterUsers ?? 0, color: '#6366F1' },
            { label: 'Pro', value: data?.proUsers ?? 0, color: '#E07B39' },
            { label: 'Agency', value: data?.agencyUsers ?? 0, color: '#22C55E' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border p-5 flex flex-col gap-2"
              style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
              {loading ? <div className="h-8 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} /> : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium" style={{ color: '#71717A' }}>{label}</span>
                  </div>
                  <span className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>{value.toLocaleString()}</span>
                  <span className="text-xs" style={{ color: '#52525B' }}>
                    {data?.totalUsers ? `${((value / data.totalUsers) * 100).toFixed(0)}% of total` : '—'}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
          <p className="text-sm font-semibold mb-4" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Signups — Last 30 Days</p>
          {loading ? <div className="h-44 rounded-xl animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data?.signupsTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke={chartStroke} fill={chartStroke} fillOpacity={0.07} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
          <p className="text-sm font-semibold mb-4" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Tier Distribution</p>
          {loading ? <div className="h-44 rounded-xl animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={(data?.tierDistribution ?? []).map(d => ({ ...d, tier: d.tier.charAt(0).toUpperCase() + d.tier.slice(1) }))}
                  nameKey="tier" dataKey="count" cx="50%" cy="50%" outerRadius={70}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {(data?.tierDistribution ?? []).map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend formatter={(v) => <span style={{ color: axisColor, fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

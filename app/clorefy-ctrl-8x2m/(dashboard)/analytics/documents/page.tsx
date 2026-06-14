'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'
import { FileText, MessageSquare, RefreshCw } from 'lucide-react'
import TimePeriodPicker, { type DateRange, rangeToQueryParams } from '@/components/admin/time-period-picker'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface OverviewData {
  totalDocumentsAllTime: number
  totalDocumentsToday: number
  totalDocumentsThisWeek: number
  totalDocumentsThisMonth: number
  totalDocumentsThisYear?: number
  totalDocuments: number
  totalMessagesAllTime: number
  totalMessagesToday?: number
  totalMessagesThisWeek?: number
  totalMessagesThisMonth?: number
  totalMessagesInPeriod?: number
  totalAIRequestsThisMonth: number
  totalTokensThisMonth: number
  estimatedAICostThisMonth: number
  aiRequests?: number
  aiTokens?: number
  aiCostINR?: number
  documentsTrend: Array<{ date: string; count: number }>
  docTypeBreakdown?: Array<{ type: string; count: number }>
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
      <p className="text-3xl sm:text-4xl font-bold tracking-tight mb-1.5 truncate" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: '#71717A' }}>{sub}</p>}
    </div>
  )
}

export default function DocumentsAnalyticsPage() {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<DateRange>({ period: 'month' })

  const fetchData = useCallback(async (r: DateRange) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/overview?${rangeToQueryParams(r)}`)
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(range) }, [fetchData, range])

  const chartBg = isDark ? '#0A0A0A' : '#FAFAFA'
  const chartBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const gridStroke = isDark ? '#1A1A1A' : '#EBEBEB'
  const axisColor = '#71717A'
  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? '#111111' : '#FFFFFF',
      border: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
      borderRadius: '10px', color: isDark ? '#F5F5F5' : '#0A0A0A', fontSize: 12,
    },
  }

  // Period-aware doc count
  function docCount(): number {
    if (!data) return 0
    if (range.period === 'today') return data.totalDocumentsToday
    if (range.period === 'week') return data.totalDocumentsThisWeek
    if (range.period === 'year') return data.totalDocumentsThisYear ?? data.totalDocumentsAllTime
    if (range.period === 'all') return data.totalDocumentsAllTime
    // month + custom: use totalDocuments (which = docsInPeriod)
    return data.totalDocuments ?? data.totalDocumentsThisMonth
  }
  function msgCount(): number {
    if (!data) return 0
    if (range.period === 'today') return data.totalMessagesToday ?? 0
    if (range.period === 'week') return data.totalMessagesThisWeek ?? 0
    if (range.period === 'all') return data.totalMessagesAllTime
    return data.totalMessagesThisMonth ?? 0
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>Documents & AI</h1>
          <p className="text-sm mt-0.5" style={{ color: '#71717A' }}>Generation counts, chat messages, and AI usage</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TimePeriodPicker value={range} onChange={(r) => setRange(r)} />
          <button onClick={() => fetchData(range)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Document counts */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>Documents Generated</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="All Time" icon={FileText} loading={loading} isDark={isDark}
            value={(data?.totalDocumentsAllTime ?? 0).toLocaleString()} />
          <MetricCard label="Today" icon={FileText} loading={loading} isDark={isDark}
            value={data?.totalDocumentsToday ?? 0} />
          <MetricCard label="This Week" icon={FileText} loading={loading} isDark={isDark}
            value={data?.totalDocumentsThisWeek ?? 0} />
          <MetricCard label="This Month" icon={FileText} loading={loading} isDark={isDark}
            value={data?.totalDocumentsThisMonth ?? 0} />
        </div>
      </div>

      {/* Chat messages */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>Chat Messages</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="All Time" icon={MessageSquare} loading={loading} isDark={isDark}
            value={(data?.totalMessagesAllTime ?? 0).toLocaleString()} />
          <MetricCard label="Today" icon={MessageSquare} loading={loading} isDark={isDark}
            value={(data?.totalMessagesToday ?? 0)} />
          <MetricCard label="This Week" icon={MessageSquare} loading={loading} isDark={isDark}
            value={(data?.totalMessagesThisWeek ?? 0)} />
          <MetricCard label="This Month" icon={MessageSquare} loading={loading} isDark={isDark}
            value={(data?.totalMessagesThisMonth ?? 0)} />
        </div>
      </div>

      {/* AI usage */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>AI Usage — Selected Period</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="AI Requests" icon={FileText} loading={loading} isDark={isDark}
            value={(data?.aiRequests ?? data?.totalAIRequestsThisMonth ?? 0).toLocaleString()} />
          <MetricCard label="Tokens Used" icon={FileText} loading={loading} isDark={isDark}
            value={(data?.aiTokens ?? data?.totalTokensThisMonth ?? 0).toLocaleString()} />
          <MetricCard label="Est. Cost (₹)" icon={FileText} loading={loading} isDark={isDark}
            value={`₹${(data?.aiCostINR ?? data?.estimatedAICostThisMonth ?? 0).toLocaleString()}`} />
        </div>
      </div>

      {/* Highlighted period count */}
      <div className="rounded-2xl border p-5 flex items-center gap-6"
        style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#71717A' }}>
            Documents — selected period
          </p>
          <p className="text-4xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>
            {loading ? '—' : docCount().toLocaleString()}
          </p>
        </div>
        <div className="h-10 w-px" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#71717A' }}>
            Messages — selected period
          </p>
          <p className="text-4xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>
            {loading ? '—' : msgCount().toLocaleString()}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
        <p className="text-sm font-semibold mb-4" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Documents Generated — Last 30 Days</p>
        {loading ? <div className="h-52 rounded-xl animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.documentsTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#E07B39" radius={[3, 3, 0, 0]} name="Documents" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

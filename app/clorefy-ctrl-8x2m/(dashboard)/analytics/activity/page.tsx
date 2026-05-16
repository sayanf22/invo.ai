'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'
import { Clock, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

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
  dailyTrend: Array<Record<string, number | string>>
}

// Colour palette for all 9 document types
const DOC_COLORS: Record<string, string> = {
  invoice:              '#E07B39',
  contract:             '#6366F1',
  quote:                '#22C55E',
  quotation:            '#22C55E', // legacy alias
  proposal:             '#F59E0B',
  sow:                  '#06B6D4',
  change_order:         '#F97316',
  nda:                  '#8B5CF6',
  client_onboarding_form: '#EC4899',
  payment_followup:     '#EF4444',
}

// All 9 canonical types in display order
const ALL_DOC_TYPES = [
  "invoice", "contract", "quote", "proposal",
  "sow", "change_order", "nda", "client_onboarding_form", "payment_followup"
]

// Human-readable label for each type
function docTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    invoice: "Invoice", contract: "Contract", quote: "Quote", quotation: "Quote",
    proposal: "Proposal", sow: "SOW", change_order: "Change Order",
    nda: "NDA", client_onboarding_form: "Onboarding Form", payment_followup: "Payment Reminder",
  }
  return labels[type] ?? type.charAt(0).toUpperCase() + type.slice(1)
}

function formatHour(h: number): string {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

export default function ActivityPage() {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/activity')
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
  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? '#111111' : '#FFFFFF',
      border: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
      borderRadius: '10px', color: isDark ? '#F5F5F5' : '#0A0A0A', fontSize: 12,
    },
  }

  const Skeleton = () => (
    <div className="h-48 rounded-xl animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
  )

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>Activity & Peak Times</h1>
          <p className="text-sm mt-0.5" style={{ color: '#71717A' }}>When users generate documents — last 30 days (UTC)</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}>
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Summary cards per doc type */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>
          Last 30 Days — {!loading && data ? `${data.totalLast30Days.toLocaleString()} total documents` : ''}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(data?.byDocType ?? ALL_DOC_TYPES.map(type => ({ type, total: 0, peakHour: 0, hourly: [] }))).map(dt => (
            <div key={dt.type} className="rounded-2xl border p-5 flex flex-col gap-2"
              style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
              {loading ? <div className="h-16 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} /> : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DOC_COLORS[dt.type] ?? '#71717A' }} />
                    <span className="text-xs font-semibold capitalize" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>{docTypeLabel(dt.type)}</span>
                  </div>
                  <span className="text-3xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>{dt.total.toLocaleString()}</span>
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#71717A' }}>
                    <Clock className="w-3 h-3" />
                    Peak: {formatHour(dt.peakHour)} UTC
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Overall hourly + daily stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
          <p className="text-sm font-semibold mb-1" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Overall Hourly Activity</p>
          <p className="text-xs mb-4" style={{ color: '#71717A' }}>All document types combined (UTC hours)</p>
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.overallHourly ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="hour" tick={{ fill: axisColor, fontSize: 9 }} tickLine={false} tickFormatter={formatHour} interval={2} />
                <YAxis tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} labelFormatter={(v) => `${formatHour(Number(v))} UTC`} />
                <Bar dataKey="count" fill={chartStroke} radius={[2, 2, 0, 0]} name="Documents" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
          <p className="text-sm font-semibold mb-1" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Daily Trend by Type</p>
          <p className="text-xs mb-4" style={{ color: '#71717A' }}>Stacked by document type over last 30 days</p>
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data?.dailyTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 9 }} tickLine={false} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                {ALL_DOC_TYPES.map(type => (
                  <Area key={type} type="monotone" dataKey={type} stackId="1"
                    stroke={DOC_COLORS[type] ?? '#71717A'}
                    fill={DOC_COLORS[type] ?? '#71717A'}
                    fillOpacity={0.8} name={docTypeLabel(type)} />
                ))}
                <Legend formatter={(v) => <span style={{ color: axisColor, fontSize: 11 }}>{v}</span>} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Per-type hourly charts */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#3F3F46' : '#A1A1AA' }}>Hourly Peak per Document Type</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(data?.byDocType ?? []).map(dt => (
            <div key={dt.type} className="rounded-2xl border p-5" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DOC_COLORS[dt.type] ?? '#71717A' }} />
                <p className="text-sm font-semibold capitalize" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>{docTypeLabel(dt.type)}</p>
              </div>
              <p className="text-xs mb-4" style={{ color: '#71717A' }}>
                {dt.total} total · Peak at {formatHour(dt.peakHour)} UTC
              </p>
              {loading ? <Skeleton /> : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dt.hourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="hour" tick={{ fill: axisColor, fontSize: 9 }} tickLine={false} tickFormatter={formatHour} interval={2} />
                    <YAxis tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} labelFormatter={(v) => `${formatHour(Number(v))} UTC`} />
                    <Bar dataKey="count" fill={DOC_COLORS[dt.type] ?? '#71717A'} radius={[2, 2, 0, 0]} name="Documents" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

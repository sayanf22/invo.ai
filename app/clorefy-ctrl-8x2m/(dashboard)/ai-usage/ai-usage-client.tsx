'use client'

import { useState, useEffect, useCallback } from 'react'
import KpiCard from '@/components/admin/kpi-card'
import DataTable from '@/components/admin/data-table'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UsageRow extends Record<string, unknown> {
  id: string
  user_email: string | null
  doc_type: string | null
  success: boolean | null
  tokens: number | null
  generation_time_ms: number | null
  created_at: string | null
}

interface TopUser extends Record<string, unknown> {
  id: string
  email: string
  request_count: number
  tokens: number
  est_cost: number
  ai_requests_count?: number
  ai_tokens_used?: number
  estimated_cost_usd?: number
}

interface UsageData {
  summaryCards: {
    requestsToday: number
    requestsThisWeek: number
    requestsThisMonth: number
    tokensThisMonth: number
    estimatedCostThisMonth: number
  }
  topUsers: TopUser[]
  docTypeBreakdown: Array<{ type: string; count: number }>
  avgGenerationTimeMs: number
  successRate: number
  errorRate: number
  history: UsageRow[]
  historyTotal: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIUsageClient() {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'

  const PIE_COLORS = isDark
    ? ['#FFFFFF', '#A1A1AA', '#71717A', '#52525B', '#3F3F46']
    : ['#0A0A0A', '#52525B', '#71717A', '#A1A1AA', '#D4D4D8']

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? '#111111' : '#FFFFFF',
      border: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
      borderRadius: '8px',
      color: isDark ? '#F5F5F5' : '#0A0A0A',
    },
  }

  const chartBg = isDark ? '#0A0A0A' : '#FAFAFA'
  const chartBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const gridStroke = isDark ? '#1A1A1A' : '#E5E5E5'
  const axisColor = '#71717A'

  const historyColumns = [
    { key: 'user_email', header: 'User', render: (r: UsageRow) => <span className="text-xs" style={{ color: '#71717A' }}>{r.user_email ?? '—'}</span> },
    { key: 'doc_type', header: 'Doc Type', render: (r: UsageRow) => <span className="text-sm capitalize" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{r.doc_type ?? '—'}</span> },
    {
      key: 'success', header: 'Status', render: (r: UsageRow) => r.success
        ? <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>Success</span>
        : <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>Error</span>
    },
    { key: 'tokens', header: 'Tokens', render: (r: UsageRow) => <span className="text-sm" style={{ color: '#71717A' }}>{r.tokens?.toLocaleString() ?? '—'}</span> },
    { key: 'generation_time_ms', header: 'Gen Time', render: (r: UsageRow) => <span className="text-sm" style={{ color: '#71717A' }}>{r.generation_time_ms != null ? `${r.generation_time_ms}ms` : '—'}</span> },
    { key: 'created_at', header: 'Date', render: (r: UsageRow) => <span className="text-sm" style={{ color: '#71717A' }}>{formatDate(r.created_at)}</span> },
  ]

  const topUserColumns = [
    { key: 'email', header: 'User Email', render: (r: TopUser) => <span className="text-xs" style={{ color: '#71717A' }}>{r.email ?? '—'}</span> },
    { key: 'request_count', header: 'Requests', render: (r: TopUser) => <span style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{(r.request_count ?? r.ai_requests_count ?? 0).toLocaleString()}</span> },
    { key: 'tokens', header: 'Tokens', render: (r: TopUser) => <span style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{(r.tokens ?? r.ai_tokens_used ?? 0).toLocaleString()}</span> },
    { key: 'est_cost', header: 'Est. Cost', render: (r: TopUser) => <span style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>${(r.est_cost ?? r.estimated_cost_usd ?? 0).toFixed(4)}</span> },
  ]

  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [docType, setDocType] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [success, setSuccess] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (docType) params.set('docType', docType)
      if (userEmail) params.set('userEmail', userEmail)
      if (success) params.set('success', success)
      const res = await fetch(`/api/admin/ai-usage?${params}`)
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, dateFrom, dateTo, docType, userEmail, success])

  useEffect(() => { fetchData() }, [fetchData])

  const inputStyle = {
    backgroundColor: isDark ? '#111111' : '#FAFAFA',
    borderColor: isDark ? '#1A1A1A' : '#E5E5E5',
    color: isDark ? '#D4D4D8' : '#27272A',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>AI Usage</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Requests Today" value={data?.summaryCards?.requestsToday ?? 0} loading={loading} error={error} onRetry={fetchData} />
        <KpiCard title="Requests This Week" value={data?.summaryCards?.requestsThisWeek ?? 0} loading={loading} error={error} onRetry={fetchData} />
        <KpiCard title="Requests This Month" value={data?.summaryCards?.requestsThisMonth ?? 0} loading={loading} error={error} onRetry={fetchData} />
        <KpiCard title="Tokens This Month" value={data?.summaryCards?.tokensThisMonth ?? 0} loading={loading} error={error} onRetry={fetchData} />
        <KpiCard title="Est. Cost This Month" value={data?.summaryCards?.estimatedCostThisMonth ?? 0} prefix="$" loading={loading} error={error} onRetry={fetchData} />
      </div>

      {/* Avg generation time */}
      {!loading && data && (
        <div className="rounded-lg border p-4 inline-block" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
          <p className="text-xs mb-1" style={{ color: '#71717A' }}>Avg Generation Time</p>
          <p className="text-xl font-bold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{data.avgGenerationTimeMs?.toFixed(0) ?? 0}ms</p>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Doc type pie */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
          <p className="text-sm mb-4" style={{ color: '#71717A' }}>Document Type Breakdown</p>
          {loading ? (
            <div className="h-48 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data?.docTypeBreakdown ?? []} nameKey="type" dataKey="count" cx="50%" cy="50%" outerRadius={70}
                  label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {(data?.docTypeBreakdown ?? []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend formatter={(v) => <span style={{ color: axisColor, fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Success/Error bar chart */}
        <div className="rounded-lg border p-4" style={{ backgroundColor: chartBg, borderColor: chartBorder }}>
          <p className="text-sm mb-4" style={{ color: '#71717A' }}>Success vs Error</p>
          {loading ? (
            <div className="h-48 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[{ name: 'This Month', success: Math.round((data?.successRate ?? 0) * 100), error: Math.round((data?.errorRate ?? 0) * 100) }]}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend formatter={(v) => <span style={{ color: axisColor, fontSize: 12 }}>{v}</span>} />
                <Bar dataKey="success" fill="#22C55E" radius={[4, 4, 0, 0]} name="Success %" />
                <Bar dataKey="error" fill="#EF4444" radius={[4, 4, 0, 0]} name="Error %" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top 10 Users */}
      <div>
        <h2 className="text-base font-semibold mb-3" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Top 10 Users</h2>
        <DataTable
          columns={topUserColumns as Parameters<typeof DataTable>[0]['columns']}
          data={(data?.topUsers ?? []) as Record<string, unknown>[]}
          loading={loading}
          emptyState={<p style={{ color: '#71717A' }} className="text-sm">No data</p>}
        />
      </div>

      {/* Generation History */}
      <div>
        <h2 className="text-base font-semibold mb-3" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Generation History</h2>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input type="text" placeholder="User email…" value={userEmail} onChange={e => { setUserEmail(e.target.value); setPage(1) }}
            style={inputStyle} className="px-3 py-2 rounded-md border text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500" />
          <select value={docType} onChange={e => { setDocType(e.target.value); setPage(1) }}
            style={inputStyle} className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500">
            <option value="">All Types</option>
            <option value="invoice">Invoice</option>
            <option value="contract">Contract</option>
            <option value="quotation">Quotation</option>
            <option value="proposal">Proposal</option>
          </select>
          <select value={success} onChange={e => { setSuccess(e.target.value); setPage(1) }}
            style={inputStyle} className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500">
            <option value="">All</option>
            <option value="true">Success</option>
            <option value="false">Error</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            style={inputStyle} className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500" />
          <span style={{ color: '#71717A' }} className="text-sm self-center">to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
            style={inputStyle} className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500" />
        </div>

        {error && (
          <div className="p-4 rounded-md text-sm mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>
            Failed to load.{' '}<button onClick={fetchData} className="underline">Retry</button>
          </div>
        )}

        <DataTable
          columns={historyColumns as Parameters<typeof DataTable>[0]['columns']}
          data={(data?.history ?? []) as Record<string, unknown>[]}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={data?.historyTotal ?? 0}
          onPageChange={setPage}
          onPageSizeChange={s => { setPageSize(s); setPage(1) }}
          emptyState={<p style={{ color: '#71717A' }} className="text-sm">No records found</p>}
        />
      </div>
    </div>
  )
}

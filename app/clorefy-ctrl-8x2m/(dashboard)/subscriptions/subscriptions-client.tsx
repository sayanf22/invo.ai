'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import KpiCard from '@/components/admin/kpi-card'
import DataTable from '@/components/admin/data-table'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubRow extends Record<string, unknown> {
  id: string
  plan: string | null
  status: string | null
  amount_paid: number | null
  currency: string | null
  billing_cycle: string | null
  current_period_start: string | null
  current_period_end: string | null
  created_at: string | null
  profiles: { email: string | null; full_name: string | null } | null
  businesses: { country: string | null } | null
}

interface SubData {
  subscriptions: SubRow[]
  total: number
  page: number
  pageSize: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const COUNTRY_FLAGS: Record<string, string> = {
  IN: '🇮🇳', US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', CA: '🇨🇦', AU: '🇦🇺',
  SG: '🇸🇬', AE: '🇦🇪', PH: '🇵🇭', FR: '🇫🇷', NL: '🇳🇱',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubscriptionsClient() {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'

  const [data, setData] = useState<SubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Computed KPIs
  const [mrr, setMrr] = useState(0)
  const [arr, setArr] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (plan) params.set('plan', plan)
      if (status) params.set('status', status)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/admin/subscriptions?${params}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setData(json)
      // Calculate MRR from active subs
      const subs = (json.subscriptions ?? []) as SubRow[]
      const activeMrr = subs
        .filter((s: SubRow) => s.status === 'active' && s.plan !== 'free')
        .reduce((sum: number, s: SubRow) => sum + ((s.amount_paid ?? 0) / 100), 0)
      setMrr(activeMrr)
      setArr(activeMrr * 12)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, plan, status, dateFrom, dateTo])

  useEffect(() => { fetchData() }, [fetchData])

  function PlanBadge({ plan: p }: { plan: string | null }) {
    const t = p ?? 'free'
    const bg = isDark ? '#1A1A1A' : '#E5E5E5'
    const color = isDark ? '#A1A1AA' : '#52525B'
    let badgeBg = bg, badgeColor = color
    if (t === 'pro' || t === 'agency') {
      badgeBg = isDark ? '#FFFFFF' : '#0A0A0A'
      badgeColor = isDark ? '#0A0A0A' : '#FFFFFF'
    } else if (t === 'starter') {
      badgeBg = isDark ? '#27272A' : '#D4D4D8'
      badgeColor = isDark ? '#D4D4D8' : '#27272A'
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
        style={{ backgroundColor: badgeBg, color: badgeColor, border: t === 'agency' ? `1px solid ${isDark ? '#3F3F46' : '#A1A1AA'}` : undefined }}>
        {t}
      </span>
    )
  }

  function StatusBadge({ status: s }: { status: string | null }) {
    const st = s ?? 'unknown'
    const isActive = st === 'active'
    const isCancelled = st === 'cancelled'
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
        style={{
          backgroundColor: isActive ? 'rgba(34,197,94,0.15)' : isCancelled ? 'rgba(239,68,68,0.15)' : isDark ? '#1A1A1A' : '#E5E5E5',
          color: isActive ? '#22C55E' : isCancelled ? '#EF4444' : '#71717A',
        }}>
        {st}
      </span>
    )
  }

  const columns = [
    {
      key: 'user_name', header: 'User Name', render: (r: SubRow) => (
        <span className="text-sm font-medium" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
          {(r.profiles as any)?.full_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'email', header: 'Email', render: (r: SubRow) => (
        <span className="text-xs" style={{ color: '#71717A' }}>
          {(r.profiles as any)?.email ?? '—'}
        </span>
      ),
    },
    { key: 'plan', header: 'Plan', render: (r: SubRow) => <PlanBadge plan={r.plan} /> },
    { key: 'status', header: 'Status', render: (r: SubRow) => <StatusBadge status={r.status} /> },
    {
      key: 'country', header: 'Country', render: (r: SubRow) => {
        const c = (r.businesses as any)?.country ?? null
        if (!c) return <span style={{ color: '#71717A' }}>—</span>
        const flag = COUNTRY_FLAGS[c.toUpperCase()] ?? ''
        return <span className="text-sm" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{flag} {c.toUpperCase()}</span>
      },
    },
    {
      key: 'amount_paid', header: 'Amount', render: (r: SubRow) => (
        <span className="text-sm" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
          {r.amount_paid != null ? `₹${(r.amount_paid / 100).toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      key: 'billing_cycle', header: 'Billing Cycle', render: (r: SubRow) => (
        <span className="text-sm capitalize" style={{ color: '#71717A' }}>{r.billing_cycle ?? '—'}</span>
      ),
    },
    {
      key: 'period', header: 'Period', render: (r: SubRow) => (
        <span className="text-xs" style={{ color: '#71717A' }}>
          {formatDate(r.current_period_start)} → {formatDate(r.current_period_end)}
        </span>
      ),
    },
    {
      key: 'created_at', header: 'Created', render: (r: SubRow) => (
        <span className="text-sm" style={{ color: '#71717A' }}>{formatDate(r.created_at)}</span>
      ),
    },
  ]

  async function handleExport() {
    try {
      const params = new URLSearchParams({ pageSize: '10000' })
      if (plan) params.set('plan', plan)
      if (status) params.set('status', status)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/admin/subscriptions?${params}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      const rows = (json.subscriptions ?? []) as SubRow[]
      const header = 'User Name,Email,Plan,Status,Country,Amount,Billing Cycle,Period Start,Period End,Created'
      const csv = [header, ...rows.map(r =>
        [(r.profiles as any)?.full_name ?? '', (r.profiles as any)?.email ?? '', r.plan ?? '', r.status ?? '',
         (r.businesses as any)?.country ?? '', r.amount_paid != null ? (r.amount_paid / 100) : '',
         r.billing_cycle ?? '', r.current_period_start ?? '', r.current_period_end ?? '', r.created_at ?? ''].join(',')
      )].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Subscriptions</h1>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors"
          style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}>
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="MRR" value={mrr} prefix="₹" loading={loading} error={error} onRetry={fetchData} />
        <KpiCard title="ARR" value={arr} prefix="₹" loading={loading} error={error} onRetry={fetchData} />
        <KpiCard title="Total Subscriptions" value={data?.total ?? 0} loading={loading} error={error} onRetry={fetchData} />
        <KpiCard title="Active" value={(data?.subscriptions ?? []).filter((s: any) => s.status === 'active').length} loading={loading} error={error} onRetry={fetchData} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={plan} onChange={e => { setPlan(e.target.value); setPage(1) }}
          style={{ backgroundColor: isDark ? '#111111' : '#FAFAFA', borderColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}
          className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500">
          <option value="">All Plans</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="agency">Agency</option>
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          style={{ backgroundColor: isDark ? '#111111' : '#FAFAFA', borderColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}
          className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          style={{ backgroundColor: isDark ? '#111111' : '#FAFAFA', borderColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}
          className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500" />
        <span className="text-sm self-center" style={{ color: '#71717A' }}>to</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
          style={{ backgroundColor: isDark ? '#111111' : '#FAFAFA', borderColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}
          className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500" />
      </div>

      {error && (
        <div className="p-4 rounded-md text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#EF4444', border: '1px solid' }}>
          Failed to load.{' '}<button onClick={fetchData} className="underline">Retry</button>
        </div>
      )}

      <DataTable
        columns={columns as Parameters<typeof DataTable>[0]['columns']}
        data={(data?.subscriptions ?? []) as Record<string, unknown>[]}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={s => { setPageSize(s); setPage(1) }}
        emptyState={<p style={{ color: '#71717A' }} className="text-sm">No subscriptions found</p>}
      />
    </div>
  )
}

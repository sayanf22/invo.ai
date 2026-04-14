'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import KpiCard from '@/components/admin/kpi-card'
import DataTable from '@/components/admin/data-table'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentRow extends Record<string, unknown> {
  id: string
  user_email: string | null
  user_name: string | null
  amount: number | null
  amount_inr: number | null
  currency: string | null
  plan: string | null
  billing_cycle: string | null
  date: string | null
  payment_id: string | null
  subscription_id: string | null
  country: string | null
  status: string | null
  period_start: string | null
  period_end: string | null
}

interface PlanRevRow extends Record<string, unknown> {
  id: string
  plan: string
  subscribers: number
  revenue: number
}

interface RevenueData {
  mrr: number
  arr: number
  newRevenueThisMonth: number
  momChange: number
  revenueByPlan: Array<{ plan: string; count: number; revenue: number }>
  paymentHistory: PaymentRow[]
  paymentHistoryTotal: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RevenueClient() {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'

  function StatusBadge({ status }: { status: string | null }) {
    const s = status ?? 'unknown'
    const colorMap: Record<string, string> = {
      paid: '#22C55E', failed: '#EF4444', refunded: '#F59E0B', pending: '#EAB308', unknown: '#71717A',
    }
    const c = colorMap[s] ?? '#71717A'
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
        style={{ backgroundColor: `${c}20`, color: c }}>
        {s}
      </span>
    )
  }

  const COUNTRY_FLAGS: Record<string, string> = {
    IN: '🇮🇳', US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', CA: '🇨🇦', AU: '🇦🇺',
    SG: '🇸🇬', AE: '🇦🇪', PH: '🇵🇭', FR: '🇫🇷', NL: '🇳🇱',
  }

  const paymentColumns = [
    { key: 'user_name', header: 'User', render: (r: PaymentRow) => (
      <div>
        <span className="text-sm font-medium block" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{r.user_name ?? '—'}</span>
        <span className="text-xs" style={{ color: '#71717A' }}>{r.user_email ?? '—'}</span>
      </div>
    )},
    { key: 'amount', header: 'Amount', render: (r: PaymentRow) => {
      const curr = r.currency ?? 'INR'
      const symbol = curr === 'USD' ? '$' : '₹'
      const raw = r.amount ?? 0
      return (
        <div>
          <span className="text-sm font-medium" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{symbol}{raw.toLocaleString()}</span>
          {curr === 'USD' && r.amount_inr != null && (
            <span className="text-xs block" style={{ color: '#71717A' }}>≈ ₹{r.amount_inr.toLocaleString()}</span>
          )}
        </div>
      )
    }},
    { key: 'plan', header: 'Plan', render: (r: PaymentRow) => <span className="capitalize text-sm" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{r.plan ?? '—'}</span> },
    { key: 'country', header: 'Country', render: (r: PaymentRow) => {
      const c = (r.country ?? '').toUpperCase()
      const flag = COUNTRY_FLAGS[c] ?? ''
      return <span className="text-sm" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{flag} {c || '—'}</span>
    }},
    { key: 'billing_cycle', header: 'Cycle', render: (r: PaymentRow) => <span className="text-xs capitalize" style={{ color: '#71717A' }}>{r.billing_cycle ?? '—'}</span> },
    { key: 'payment_id', header: 'Payment ID', render: (r: PaymentRow) => <span className="text-xs font-mono" style={{ color: '#71717A' }}>{r.payment_id ?? '—'}</span> },
    { key: 'date', header: 'Date', render: (r: PaymentRow) => <span className="text-xs" style={{ color: '#71717A' }}>{formatDate(r.date)}</span> },
    { key: 'status', header: 'Status', render: (r: PaymentRow) => <StatusBadge status={r.status} /> },
  ]

  const planColumns = [
    { key: 'plan', header: 'Plan', render: (r: PlanRevRow) => <span className="capitalize font-medium" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{r.plan}</span> },
    { key: 'subscribers', header: 'Subscribers', render: (r: PlanRevRow) => <span style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{(r.count ?? r.subscribers ?? 0).toLocaleString()}</span> },
    { key: 'revenue', header: 'Revenue', render: (r: PlanRevRow) => <span style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>₹{(r.revenue ?? 0).toLocaleString()}</span> },
  ]

  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [statusFilter, setStatusFilter] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/revenue?${params}`)
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleExport() {
    try {
      const params = new URLSearchParams({ pageSize: '10000' })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/revenue?${params}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      const rows = (json.paymentHistory ?? []) as PaymentRow[]
      const header = 'User Name,Email,Amount,Currency,Amount INR,Plan,Country,Billing Cycle,Payment ID,Date,Status'
      const csv = [header, ...rows.map(r =>
        [r.user_name ?? '', r.user_email ?? '', r.amount ?? '', r.currency ?? '', r.amount_inr ?? '',
         r.plan ?? '', r.country ?? '', r.billing_cycle ?? '', r.payment_id ?? '', r.date ?? '', r.status ?? ''].join(',')
      )].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `revenue-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  const filteredPayments = statusFilter
    ? (data?.paymentHistory ?? []).filter(p => p.status === statusFilter)
    : (data?.paymentHistory ?? [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Revenue</h1>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors"
          style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}>
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="MRR" value={data?.mrr ?? 0} prefix="₹" loading={loading} error={error} onRetry={fetchData} />
        <KpiCard title="ARR" value={data?.arr ?? 0} prefix="₹" loading={loading} error={error} onRetry={fetchData} />
        <KpiCard title="New Revenue This Month" value={data?.newRevenueThisMonth ?? 0} prefix="₹" loading={loading} error={error} onRetry={fetchData} />
        <KpiCard title="MoM Change" value={data?.momChange ?? 0} suffix="%" loading={loading} error={error} onRetry={fetchData} />
      </div>

      {/* Revenue by Plan */}
      <div>
        <h2 className="text-base font-semibold mb-3" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Revenue by Plan</h2>
        <DataTable
          columns={planColumns as Parameters<typeof DataTable>[0]['columns']}
          data={(data?.revenueByPlan ?? []).map((r, i) => ({ ...r, id: String(i) })) as Record<string, unknown>[]}
          loading={loading}
          emptyState={<p style={{ color: '#71717A' }} className="text-sm">No plan data</p>}
        />
      </div>

      {/* Payment History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Payment History</h2>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            style={{ backgroundColor: isDark ? '#111111' : '#FAFAFA', borderColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}
            className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500">
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {error && (
          <div className="p-4 rounded-md text-sm mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>
            Failed to load.{' '}<button onClick={fetchData} className="underline">Retry</button>
          </div>
        )}

        <DataTable
          columns={paymentColumns as Parameters<typeof DataTable>[0]['columns']}
          data={filteredPayments as Record<string, unknown>[]}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={data?.paymentHistoryTotal ?? 0}
          onPageChange={setPage}
          onPageSizeChange={s => { setPageSize(s); setPage(1) }}
          emptyState={<p style={{ color: '#71717A' }} className="text-sm">No payments found</p>}
        />
      </div>
    </div>
  )
}

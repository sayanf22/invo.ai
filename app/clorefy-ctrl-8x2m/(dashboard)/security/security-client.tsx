'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import DataTable from '@/components/admin/data-table'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditRow extends Record<string, unknown> {
  id: string
  action: string | null
  email: string | null
  ip_address: string | null
  created_at: string | null
  metadata: Record<string, unknown> | null
}

interface BruteForceEvent {
  ip: string
  attempts: number
  last_seen: string
  emails: string[]
}

interface SuspiciousUser {
  email: string
  requests_per_hour: number
}

interface BlockedIP {
  id: string
  ip_address: string
  reason: string
  blocked_by: string
  created_at: string
  expires_at: string | null
}

interface SecurityData {
  logs: AuditRow[]
  total: number
  bruteForce: BruteForceEvent[]
  suspicious: SuspiciousUser[]
  blockedIPs: BlockedIP[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SecurityClient() {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'

  const containerBg = isDark ? '#0A0A0A' : '#FAFAFA'
  const containerBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const inputStyle = {
    backgroundColor: isDark ? '#111111' : '#FAFAFA',
    borderColor: isDark ? '#1A1A1A' : '#E5E5E5',
    color: isDark ? '#D4D4D8' : '#27272A',
  }

  const auditColumns = [
    { key: 'created_at', header: 'Time', render: (r: AuditRow) => <span className="text-xs whitespace-nowrap" style={{ color: '#71717A' }}>{formatDate(r.created_at)}</span> },
    { key: 'action', header: 'Action', render: (r: AuditRow) => <span className="font-mono text-xs" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{r.action ?? '—'}</span> },
    { key: 'email', header: 'User', render: (r: AuditRow) => <span className="text-xs" style={{ color: '#71717A' }}>{r.email ?? '—'}</span> },
    { key: 'ip_address', header: 'IP', render: (r: AuditRow) => <span className="text-xs font-mono" style={{ color: '#71717A' }}>{r.ip_address ?? '—'}</span> },
  ]

  const [data, setData] = useState<SecurityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [action, setAction] = useState('')
  const [email, setEmail] = useState('')
  const [ip, setIp] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Block IP form
  const [blockIp, setBlockIp] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [blockExpiry, setBlockExpiry] = useState('')
  const [blocking, setBlocking] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (action) params.set('action', action)
      if (email) params.set('email', email)
      if (ip) params.set('ip', ip)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/admin/security?${params}`)
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, action, email, ip, dateFrom, dateTo])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleBlockIP(e: React.FormEvent) {
    e.preventDefault()
    if (!blockReason.trim()) { toast.error('Reason is required'); return }
    setBlocking(true)
    try {
      const res = await fetch('/api/admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip_address: blockIp, reason: blockReason, expires_at: blockExpiry || undefined }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`${blockIp} blocked`)
      setBlockIp(''); setBlockReason(''); setBlockExpiry('')
      fetchData()
    } catch {
      toast.error('Failed to block IP')
    } finally {
      setBlocking(false)
    }
  }

  async function handleUnblockIP(ipAddr: string) {
    try {
      const res = await fetch('/api/admin/security', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip_address: ipAddr }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`${ipAddr} unblocked`)
      fetchData()
    } catch {
      toast.error('Failed to unblock IP')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }} />
        <h1 className="text-2xl font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Security</h1>
      </div>

      {/* Audit Log Filters */}
      <div className="flex flex-wrap gap-3">
        <input type="text" placeholder="Action…" value={action} onChange={e => { setAction(e.target.value); setPage(1) }}
          style={inputStyle} className="px-3 py-2 rounded-md border text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500" />
        <input type="text" placeholder="User email…" value={email} onChange={e => { setEmail(e.target.value); setPage(1) }}
          style={inputStyle} className="px-3 py-2 rounded-md border text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500" />
        <input type="text" placeholder="IP address…" value={ip} onChange={e => { setIp(e.target.value); setPage(1) }}
          style={inputStyle} className="px-3 py-2 rounded-md border text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500" />
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          style={inputStyle} className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500" />
        <span style={{ color: '#71717A' }} className="text-sm self-center">to</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
          style={inputStyle} className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500" />
      </div>

      {error && (
        <div className="p-4 rounded-md text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>
          Failed to load.{' '}<button onClick={fetchData} className="underline">Retry</button>
        </div>
      )}

      {/* Audit Log Table */}
      <DataTable
        columns={auditColumns as Parameters<typeof DataTable>[0]['columns']}
        data={(data?.logs ?? []) as Record<string, unknown>[]}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={s => { setPageSize(s); setPage(1) }}
        emptyState={<p style={{ color: '#71717A' }} className="text-sm">No audit logs found</p>}
      />

      {/* Brute Force Events */}
      <div className="rounded-lg border p-5" style={{ backgroundColor: containerBg, borderColor: containerBorder }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Brute Force Events</h2>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />)}</div>
        ) : (data?.bruteForce ?? []).length === 0 ? (
          <p style={{ color: '#71717A' }} className="text-sm">No brute force events detected</p>
        ) : (
          <div className="space-y-3">
            {(data?.bruteForce ?? []).map((ev, i) => (
              <div key={i} className="flex items-start justify-between p-3 rounded-md border"
                style={{ backgroundColor: isDark ? '#111111' : '#FFFFFF', borderColor: containerBorder }}>
                <div>
                  <p className="text-sm font-mono" style={{ color: '#EF4444' }}>{ev.ip}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#71717A' }}>{ev.attempts} attempts · Last seen {formatDate(ev.last_seen)}</p>
                  {ev.emails?.length > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>Targets: {ev.emails.slice(0, 3).join(', ')}{ev.emails.length > 3 ? ` +${ev.emails.length - 3}` : ''}</p>
                  )}
                </div>
                <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>Brute Force</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suspicious Activity */}
      <div className="rounded-lg border p-5" style={{ backgroundColor: containerBg, borderColor: containerBorder }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Suspicious Activity</h2>
        <p className="text-xs mb-3" style={{ color: '#52525B' }}>Users with &gt;50 requests/hour</p>
        {loading ? (
          <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />)}</div>
        ) : (data?.suspicious ?? []).length === 0 ? (
          <p style={{ color: '#71717A' }} className="text-sm">No suspicious activity detected</p>
        ) : (
          <div className="space-y-2">
            {(data?.suspicious ?? []).map((u, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-md border"
                style={{ backgroundColor: isDark ? '#111111' : '#FFFFFF', borderColor: containerBorder }}>
                <span className="text-sm" style={{ color: '#71717A' }}>{u.email}</span>
                <span className="text-sm font-medium" style={{ color: '#F59E0B' }}>{u.requests_per_hour} req/hr</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* IP Blocklist */}
      <div className="rounded-lg border p-5" style={{ backgroundColor: containerBg, borderColor: containerBorder }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>IP Blocklist</h2>

        {loading ? (
          <div className="space-y-2 mb-6">{[1, 2].map(i => <div key={i} className="h-12 rounded animate-pulse" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />)}</div>
        ) : (data?.blockedIPs ?? []).length === 0 ? (
          <p style={{ color: '#71717A' }} className="text-sm mb-6">No blocked IPs</p>
        ) : (
          <div className="space-y-2 mb-6">
            {(data?.blockedIPs ?? []).map((b) => (
              <div key={b.id} className="flex items-start justify-between p-3 rounded-md border"
                style={{ backgroundColor: isDark ? '#111111' : '#FFFFFF', borderColor: containerBorder }}>
                <div>
                  <p className="text-sm font-mono" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{b.ip_address}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#71717A' }}>
                    {b.reason} · Blocked by {b.blocked_by} · {formatDate(b.created_at)}
                    {b.expires_at && ` · Expires ${formatDate(b.expires_at)}`}
                  </p>
                </div>
                <button onClick={() => handleUnblockIP(b.ip_address)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                  style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add IP form */}
        <h3 className="text-sm font-medium mb-3" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>Block IP Address</h3>
        <form onSubmit={handleBlockIP} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input type="text" required placeholder="IP address…" value={blockIp} onChange={e => setBlockIp(e.target.value)}
            style={inputStyle} className="px-3 py-2 rounded-md border text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500" />
          <input type="text" required placeholder="Reason…" value={blockReason} onChange={e => setBlockReason(e.target.value)}
            style={inputStyle} className="px-3 py-2 rounded-md border text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500" />
          <input type="date" placeholder="Expiry (optional)" value={blockExpiry} onChange={e => setBlockExpiry(e.target.value)}
            style={inputStyle} className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500" />
          <button type="submit" disabled={blocking}
            className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium">
            {blocking ? 'Blocking…' : 'Block IP'}
          </button>
        </form>
      </div>
    </div>
  )
}

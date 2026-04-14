'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Download, UserX, RefreshCw } from 'lucide-react'
import DataTable from '@/components/admin/data-table'
import UserDetailDrawer from '@/components/admin/user-detail-drawer'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow extends Record<string, unknown> {
  id: string
  full_name: string | null
  email: string | null
  tier: string | null
  created_at: string | null
  last_active_at: string | null
  suspended_at: string | null
  documents_count?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UsersClient() {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'

  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [tier, setTier] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null)

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [search])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortDir,
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (tier) params.set('tier', tier)
      if (status) params.set('status', status)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setUsers(json.users ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, tier, status, dateFrom, dateTo, sortBy, sortDir])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  function handleSort(key: string) {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
    setPage(1)
  }

  async function handleExport() {
    const params = new URLSearchParams({ sortBy, sortDir })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (tier) params.set('tier', tier)
    if (status) params.set('status', status)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)

    const res = await fetch(`/api/admin/users/export?${params}`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportSelected() {
    const params = new URLSearchParams({ ids: selectedIds.join(',') })
    const res = await fetch(`/api/admin/users/export?${params}`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users-selected-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Badges ───────────────────────────────────────────────────────────────

  function TierBadge({ tier: t }: { tier: string | null }) {
    const v = t ?? 'free'
    let bg: string, color: string, border: string | undefined
    if (v === 'free') {
      bg = isDark ? '#1A1A1A' : '#E5E5E5'
      color = isDark ? '#71717A' : '#52525B'
    } else if (v === 'starter') {
      bg = isDark ? '#27272A' : '#D4D4D8'
      color = isDark ? '#D4D4D8' : '#27272A'
    } else if (v === 'pro') {
      bg = isDark ? '#FFFFFF' : '#0A0A0A'
      color = isDark ? '#0A0A0A' : '#FFFFFF'
    } else {
      // agency
      bg = isDark ? '#FFFFFF' : '#0A0A0A'
      color = isDark ? '#0A0A0A' : '#FFFFFF'
      border = isDark ? '#3F3F46' : '#A1A1AA'
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
        style={{ backgroundColor: bg, color, border: border ? `1px solid ${border}` : undefined }}>
        {v}
      </span>
    )
  }

  function StatusBadge({ suspended }: { suspended: boolean }) {
    return suspended ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
        Suspended
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
        Active
      </span>
    )
  }

  function Avatar({ name }: { name: string | null }) {
    const letter = (name ?? '?')[0]?.toUpperCase() ?? '?'
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
        style={{ backgroundColor: isDark ? '#27272A' : '#D4D4D8', color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
        {letter}
      </div>
    )
  }

  // ─── Columns ──────────────────────────────────────────────────────────────

  const columns = [
    {
      key: 'avatar',
      header: '',
      render: (row: UserRow) => <Avatar name={row.full_name} />,
    },
    {
      key: 'name_email',
      header: 'User',
      sortable: true,
      render: (row: UserRow) => (
        <div>
          <p className="text-sm font-medium" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{row.full_name ?? '—'}</p>
          <p className="text-xs" style={{ color: '#71717A' }}>{row.email ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      sortable: true,
      render: (row: UserRow) => <TierBadge tier={row.tier} />,
    },
    {
      key: 'documents_count',
      header: 'Docs',
      sortable: true,
      render: (row: UserRow) => (
        <span className="text-sm" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
          {(row.documents_count as number ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Signed Up',
      sortable: true,
      render: (row: UserRow) => (
        <span className="text-sm" style={{ color: '#71717A' }}>{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'last_active_at',
      header: 'Last Active',
      sortable: true,
      render: (row: UserRow) => (
        <span className="text-sm" style={{ color: '#71717A' }}>
          {row.last_active_at ? formatDate(row.last_active_at) : 'Never'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: UserRow) => <StatusBadge suspended={!!row.suspended_at} />,
    },
  ]

  const bulkActions = (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportSelected}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors"
        style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}
      >
        <Download className="w-3 h-3" />
        Export Selected
      </button>
      <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors"
        style={{ backgroundColor: isDark ? '#27272A' : '#D4D4D8', color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
        <RefreshCw className="w-3 h-3" />
        Bulk Tier Change
      </button>
      <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-red-700 hover:bg-red-600 text-white">
        <UserX className="w-3 h-3" />
        Bulk Suspend
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Users</h1>
          {!loading && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: '#71717A' }}>
              {total.toLocaleString()}
            </span>
          )}
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors"
          style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
          style={{
            backgroundColor: isDark ? '#111111' : '#FAFAFA',
            borderColor: isDark ? '#1A1A1A' : '#E5E5E5',
            color: isDark ? '#F5F5F5' : '#0A0A0A',
          }}
        />
        <div className="flex flex-wrap gap-3">
          <select
            value={tier}
            onChange={e => { setTier(e.target.value); setPage(1) }}
            style={{ backgroundColor: isDark ? '#111111' : '#FAFAFA', borderColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}
            className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">All Tiers</option>
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="agency">Agency</option>
          </select>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            style={{ backgroundColor: isDark ? '#111111' : '#FAFAFA', borderColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}
            className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              style={{ backgroundColor: isDark ? '#111111' : '#FAFAFA', borderColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}
              className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
            <span style={{ color: '#71717A' }} className="text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1) }}
              style={{ backgroundColor: isDark ? '#111111' : '#FAFAFA', borderColor: isDark ? '#1A1A1A' : '#E5E5E5', color: isDark ? '#D4D4D8' : '#27272A' }}
              className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>
          Failed to load users.{' '}
          <button onClick={fetchUsers} className="underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns as Parameters<typeof DataTable>[0]['columns']}
        data={users as Record<string, unknown>[]}
        loading={loading}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={bulkActions}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
        onRowClick={(row) => setDrawerUserId(row.id as string)}
        emptyState={<p style={{ color: '#71717A' }} className="text-sm">No users found</p>}
      />

      {/* User detail drawer */}
      <UserDetailDrawer
        userId={drawerUserId}
        onClose={() => setDrawerUserId(null)}
      />
    </div>
  )
}

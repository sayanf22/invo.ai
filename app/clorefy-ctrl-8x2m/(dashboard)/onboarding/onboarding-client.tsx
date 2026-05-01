'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Users, Clock, ChevronDown, ChevronRight, Check, Minus, Upload, MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'
import { TRACKED_FIELDS } from '@/lib/onboarding-utils'
import type { TrackedFieldName } from '@/lib/onboarding-utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingUser {
  id: string
  email: string | null
  full_name: string | null
  onboarding_status: 'completed' | 'in-progress' | 'dropped-off'
  current_phase: string | null
  fields_completed: number
  field_details: Record<string, boolean>
  used_extraction: boolean
  last_active_at: string | null
  upload_started_at: string | null
  chat_started_at: string | null
  logo_started_at: string | null
  payments_started_at: string | null
  completed_at: string | null
  business_data: Record<string, unknown> | null
}

interface OnboardingTrackingClientProps {
  initialUsers: OnboardingUser[]
  initialTotal: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'dropped-off', label: 'Dropped Off' },
]

const PHASE_OPTIONS = [
  { value: 'all', label: 'All Phases' },
  { value: 'upload', label: 'Upload' },
  { value: 'chat', label: 'Chat' },
  { value: 'logo', label: 'Logo' },
  { value: 'payments', label: 'Payments' },
]

const ERROR_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'with-errors', label: 'With Errors' },
  { value: 'without-errors', label: 'Without Errors' },
]

const STATUS_BADGE: Record<string, { label: string; bg: string; bgDark: string; color: string }> = {
  completed:     { label: 'Completed',   bg: '#E5E5E5', bgDark: '#27272A', color: '#0A0A0A' },
  'in-progress': { label: 'In Progress', bg: '#E5E5E5', bgDark: '#27272A', color: '#0A0A0A' },
  'dropped-off': { label: 'Dropped Off', bg: '#E5E5E5', bgDark: '#27272A', color: '#71717A' },
}

const PHASE_BADGE: Record<string, { label: string; bg: string; bgDark: string; color: string }> = {
  upload:    { label: 'Upload',    bg: '#E5E5E5', bgDark: '#27272A', color: '#0A0A0A' },
  chat:      { label: 'Chat',      bg: '#E5E5E5', bgDark: '#27272A', color: '#0A0A0A' },
  logo:      { label: 'Logo',      bg: '#E5E5E5', bgDark: '#27272A', color: '#0A0A0A' },
  payments:  { label: 'Payments',  bg: '#E5E5E5', bgDark: '#27272A', color: '#0A0A0A' },
  completed: { label: 'Completed', bg: '#E5E5E5', bgDark: '#27272A', color: '#0A0A0A' },
}

/** Display names for the 12 tracked fields. */
const TRACKED_FIELD_LABELS: Record<TrackedFieldName, string> = {
  businessType: 'Business Type',
  country: 'Country',
  businessName: 'Business Name',
  ownerName: 'Owner Name',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  taxDetails: 'Tax Details',
  services: 'Services',
  clientCountries: 'Client Countries',
  defaultCurrency: 'Default Currency',
  bankDetails: 'Bank Details',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a raw business field value for display in the detail view. */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value || '—'
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—'
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '')
    if (entries.length === 0) return '—'
    return entries.map(([k, v]) => `${k}: ${v}`).join(', ')
  }
  return String(value)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingTrackingClient({
  initialUsers,
  initialTotal,
}: OnboardingTrackingClientProps) {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'

  // Data state
  const [users, setUsers] = useState<OnboardingUser[]>(initialUsers)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all')
  const [phaseFilter, setPhaseFilter] = useState('all')
  const [errorsFilter, setErrorsFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Expanded row state
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  // Debounced search
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

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

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [statusFilter, phaseFilter, errorsFilter])

  // ─── Fetch data ───────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (phaseFilter !== 'all') params.set('phase', phaseFilter)
      if (errorsFilter !== 'all') params.set('errors', errorsFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/admin/onboarding?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setUsers(json.users ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, phaseFilter, errorsFilter, debouncedSearch])

  // Skip initial fetch since we have initialUsers
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    fetchUsers()
  }, [fetchUsers])

  // ─── Pagination ─────────────────────────────────────────────────────

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // ─── Styles ─────────────────────────────────────────────────────────

  const cardBg = isDark ? '#0A0A0A' : '#FFFFFF'
  const cardBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const textPrimary = isDark ? '#F5F5F5' : '#0A0A0A'
  const textSecondary = '#71717A'
  const inputBg = isDark ? '#111111' : '#FAFAFA'
  const inputBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const headerBg = isDark ? '#111111' : '#F5F5F5'
  const rowHoverBg = isDark ? '#111111' : '#FAFAFA'
  const detailBg = isDark ? '#0D0D0D' : '#F9FAFB'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold" style={{ color: textPrimary }}>
            Onboarding Tracking
          </h1>
          {!loading && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: textSecondary }}
            >
              {total.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: textSecondary }}
          />
          <input
            type="text"
            placeholder="Search by email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }}
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 cursor-pointer"
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: textSecondary }}
          />
        </div>

        {/* Phase filter */}
        <div className="relative">
          <select
            value={phaseFilter}
            onChange={e => setPhaseFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 cursor-pointer"
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }}
          >
            {PHASE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: textSecondary }}
          />
        </div>

        {/* Errors filter */}
        <div className="relative">
          <select
            value={errorsFilter}
            onChange={e => setErrorsFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 cursor-pointer"
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }}
          >
            {ERROR_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: textSecondary }}
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="p-4 rounded-md text-sm"
          style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#EF4444',
          }}
        >
          Failed to load onboarding data.{' '}
          <button onClick={fetchUsers} className="underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 animate-pulse"
                style={{ borderBottom: `1px solid ${cardBorder}` }}
              >
                <div className="h-4 rounded w-1/4" style={{ backgroundColor: isDark ? '#27272A' : '#D4D4D8' }} />
                <div className="h-4 rounded w-1/6" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
                <div className="h-4 rounded w-16" style={{ backgroundColor: isDark ? '#27272A' : '#D4D4D8' }} />
                <div className="h-4 rounded w-16" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
                <div className="h-4 rounded w-12" style={{ backgroundColor: isDark ? '#27272A' : '#D4D4D8' }} />
                <div className="h-4 rounded w-20" style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && users.length === 0 && (
        <div
          className="p-16 text-center rounded-lg border flex flex-col items-center"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <Users className="w-10 h-10 mb-4" style={{ color: isDark ? '#27272A' : '#D4D4D8' }} />
          <p className="font-medium text-lg" style={{ color: textPrimary }}>
            {debouncedSearch || statusFilter !== 'all' || phaseFilter !== 'all' || errorsFilter !== 'all'
              ? 'No users found'
              : 'No onboarding data'}
          </p>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            {debouncedSearch
              ? `No users matching "${debouncedSearch}"`
              : statusFilter !== 'all' || phaseFilter !== 'all' || errorsFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No users have started onboarding yet.'}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && users.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ color: textPrimary }}>
              <thead>
                <tr style={{ backgroundColor: headerBg }}>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: textSecondary }}>
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: textSecondary }}>
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: textSecondary }}>
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: textSecondary }}>
                    Phase
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: textSecondary }}>
                    Fields
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: textSecondary }}>
                    Last Active
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const statusCfg = STATUS_BADGE[user.onboarding_status] ?? STATUS_BADGE['in-progress']
                  const phaseCfg = user.current_phase ? PHASE_BADGE[user.current_phase] : null
                  const fieldsPercent = Math.round((user.fields_completed / 12) * 100)
                  const isExpanded = expandedUserId === user.id

                  return (
                    <React.Fragment key={user.id}>
                      <tr
                        className="transition-colors cursor-pointer"
                        style={{ borderBottom: isExpanded ? 'none' : `1px solid ${cardBorder}` }}
                        onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = rowHoverBg }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                      >
                        {/* Email */}
                        <td className="px-4 py-3 font-medium truncate max-w-[200px]">
                          <div className="flex items-center gap-2">
                            <ChevronRight
                              className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
                              style={{
                                color: textSecondary,
                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              }}
                            />
                            {user.email ?? '—'}
                          </div>
                        </td>

                        {/* Name */}
                        <td className="px-4 py-3 truncate max-w-[160px]" style={{ color: textSecondary }}>
                          {user.full_name ?? '—'}
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                            style={{ backgroundColor: isDark ? statusCfg.bgDark : statusCfg.bg, color: isDark ? '#D4D4D8' : statusCfg.color }}
                          >
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* Phase badge */}
                        <td className="px-4 py-3">
                          {phaseCfg ? (
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                              style={{ backgroundColor: isDark ? phaseCfg.bgDark : phaseCfg.bg, color: isDark ? '#D4D4D8' : phaseCfg.color }}
                            >
                              {phaseCfg.label}
                            </span>
                          ) : (
                            <span style={{ color: textSecondary }}>—</span>
                          )}
                        </td>

                        {/* Fields completed with progress bar */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium whitespace-nowrap" style={{ color: textPrimary }}>
                              {user.fields_completed}/12
                            </span>
                            <div
                              className="w-16 h-1.5 rounded-full overflow-hidden"
                              style={{ backgroundColor: isDark ? '#27272A' : '#E5E5E5' }}
                            >
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${fieldsPercent}%`,
                                  backgroundColor: isDark ? '#A1A1AA' : '#52525B',
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Last active */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: textSecondary }}>
                            <Clock className="w-3 h-3" />
                            {user.last_active_at
                              ? formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true })
                              : '—'}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable detail row */}
                      {isExpanded && (
                        <tr style={{ borderBottom: `1px solid ${cardBorder}` }}>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <div
                              className="px-6 py-5"
                              style={{ backgroundColor: detailBg, borderTop: `1px solid ${cardBorder}` }}
                            >
                              {/* Detail header row: Phase + Data Method */}
                              <div className="flex flex-wrap gap-6 mb-5">
                                {/* Current / Last Phase */}
                                <div>
                                  <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textSecondary }}>
                                    Current / Last Phase
                                  </span>
                                  <div className="mt-1">
                                    {user.current_phase ? (
                                      <span
                                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider"
                                        style={{
                                          backgroundColor: isDark ? '#27272A' : '#E5E5E5',
                                          color: isDark ? '#D4D4D8' : '#0A0A0A',
                                        }}
                                      >
                                        {(PHASE_BADGE[user.current_phase] ?? { label: user.current_phase }).label}
                                      </span>
                                    ) : (
                                      <span className="text-xs" style={{ color: textSecondary }}>—</span>
                                    )}
                                  </div>
                                </div>

                                {/* Data Entry Method */}
                                <div>
                                  <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textSecondary }}>
                                    Data Entry Method
                                  </span>
                                  <div className="mt-1 flex items-center gap-1.5">
                                    {user.used_extraction ? (
                                      <>
                                        <Upload className="w-3.5 h-3.5" style={{ color: textSecondary }} />
                                        <span className="text-xs font-medium" style={{ color: textPrimary }}>Upload</span>
                                      </>
                                    ) : (
                                      <>
                                        <MessageSquare className="w-3.5 h-3.5" style={{ color: textSecondary }} />
                                        <span className="text-xs font-medium" style={{ color: textPrimary }}>Manual</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Phase Timestamps */}
                                {(user.upload_started_at || user.chat_started_at || user.logo_started_at || user.payments_started_at || user.completed_at) && (
                                  <div>
                                    <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textSecondary }}>
                                      Phase Timestamps
                                    </span>
                                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                      {user.upload_started_at && (
                                        <span className="text-[11px]" style={{ color: textSecondary }}>
                                          Upload: {new Date(user.upload_started_at).toLocaleDateString()}
                                        </span>
                                      )}
                                      {user.chat_started_at && (
                                        <span className="text-[11px]" style={{ color: textSecondary }}>
                                          Chat: {new Date(user.chat_started_at).toLocaleDateString()}
                                        </span>
                                      )}
                                      {user.logo_started_at && (
                                        <span className="text-[11px]" style={{ color: textSecondary }}>
                                          Logo: {new Date(user.logo_started_at).toLocaleDateString()}
                                        </span>
                                      )}
                                      {user.payments_started_at && (
                                        <span className="text-[11px]" style={{ color: textSecondary }}>
                                          Payments: {new Date(user.payments_started_at).toLocaleDateString()}
                                        </span>
                                      )}
                                      {user.completed_at && (
                                        <span className="text-[11px] font-medium" style={{ color: textPrimary }}>
                                          Completed: {new Date(user.completed_at).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Field completion grid */}
                              <div>
                                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textSecondary }}>
                                  Field Completion ({user.fields_completed}/12)
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 mt-2">
                                  {(Object.keys(TRACKED_FIELDS) as TrackedFieldName[]).map(fieldKey => {
                                    const isCompleted = user.field_details?.[fieldKey] ?? false
                                    const label = TRACKED_FIELD_LABELS[fieldKey]
                                    const column = TRACKED_FIELDS[fieldKey]
                                    const rawValue = user.business_data?.[column] ?? null

                                    return (
                                      <div
                                        key={fieldKey}
                                        className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                                        style={{
                                          backgroundColor: isDark ? '#111111' : '#FFFFFF',
                                          border: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
                                        }}
                                      >
                                        {/* Status icon */}
                                        <div
                                          className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                                          style={{
                                            backgroundColor: isCompleted ? (isDark ? '#27272A' : '#E5E5E5') : isDark ? '#1A1A1A' : '#E5E5E5',
                                          }}
                                        >
                                          {isCompleted ? (
                                            <Check className="w-3 h-3" style={{ color: isDark ? '#D4D4D8' : '#0A0A0A' }} />
                                          ) : (
                                            <Minus className="w-3 h-3" style={{ color: textSecondary }} />
                                          )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                          <span
                                            className="text-xs font-medium block"
                                            style={{ color: isCompleted ? textPrimary : textSecondary }}
                                          >
                                            {label}
                                          </span>
                                          {/* Show actual value when business data exists */}
                                          {user.business_data && rawValue != null && isCompleted && (
                                            <span
                                              className="text-[11px] block truncate mt-0.5"
                                              style={{ color: textSecondary }}
                                              title={formatFieldValue(rawValue)}
                                            >
                                              {formatFieldValue(rawValue)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && total > PAGE_SIZE && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl border"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <span className="text-xs" style={{ color: textSecondary }}>
            {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5',
                color: textPrimary,
              }}
            >
              Previous
            </button>
            <span className="text-xs" style={{ color: textSecondary }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5',
                color: textPrimary,
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

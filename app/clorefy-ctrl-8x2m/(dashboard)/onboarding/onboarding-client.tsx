'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, Users, Clock, ChevronDown, ChevronRight, Check, Minus,
  FileUp, Keyboard, MessageSquare, FileText, Mail, LayoutDashboard,
  CreditCard,
} from 'lucide-react'
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
  total_sessions: number
  total_generations: number
  total_emails_sent: number
  total_messages: number
  tier: string | null
  signed_up_at: string | null
  has_payment_setup: boolean
  payment_method_type: 'gateway' | 'bank_details' | 'none'
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

const STATUS_BADGE: Record<string, { label: string; bg: string; bgDark: string; color: string; colorDark: string }> = {
  completed:     { label: 'Completed',   bg: 'rgba(16,185,129,0.1)',  bgDark: 'rgba(16,185,129,0.15)', color: '#059669', colorDark: '#34D399' },
  'in-progress': { label: 'In Progress', bg: 'rgba(59,130,246,0.1)',  bgDark: 'rgba(59,130,246,0.15)', color: '#2563EB', colorDark: '#60A5FA' },
  'dropped-off': { label: 'Dropped Off', bg: 'rgba(239,68,68,0.08)',  bgDark: 'rgba(239,68,68,0.12)',  color: '#DC2626', colorDark: '#F87171' },
}

const PHASE_BADGE: Record<string, { label: string; bg: string; bgDark: string; color: string; colorDark: string }> = {
  upload:    { label: 'Upload',    bg: 'rgba(99,102,241,0.1)',  bgDark: 'rgba(99,102,241,0.15)', color: '#4F46E5', colorDark: '#818CF8' },
  chat:      { label: 'Chat',      bg: 'rgba(168,85,247,0.1)',  bgDark: 'rgba(168,85,247,0.15)', color: '#7C3AED', colorDark: '#A78BFA' },
  logo:      { label: 'Logo',      bg: 'rgba(245,158,11,0.1)',  bgDark: 'rgba(245,158,11,0.15)', color: '#D97706', colorDark: '#FBBF24' },
  payments:  { label: 'Payments',  bg: 'rgba(16,185,129,0.1)',  bgDark: 'rgba(16,185,129,0.15)', color: '#059669', colorDark: '#34D399' },
  completed: { label: 'Completed', bg: 'rgba(16,185,129,0.1)',  bgDark: 'rgba(16,185,129,0.15)', color: '#059669', colorDark: '#34D399' },
}

const FUNNEL_PHASES = ['upload', 'chat', 'logo', 'payments', 'completed'] as const
const FUNNEL_LABELS: Record<string, string> = {
  upload: 'Upload',
  chat: 'Chat',
  logo: 'Logo',
  payments: 'Payments',
  completed: 'Completed',
}

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

// Phase ordering for the stepper
const PHASE_ORDER = ['upload', 'chat', 'logo', 'payments', 'completed'] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Get the index of a phase in the ordered list, -1 if not found */
function getPhaseIndex(phase: string | null): number {
  if (!phase) return -1
  return PHASE_ORDER.indexOf(phase as typeof PHASE_ORDER[number])
}

/** Count users at each funnel phase */
function computeFunnelCounts(users: OnboardingUser[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const phase of FUNNEL_PHASES) {
    counts[phase] = 0
  }
  for (const user of users) {
    if (user.onboarding_status === 'completed') {
      counts['completed']++
    } else if (user.current_phase && counts[user.current_phase] !== undefined) {
      counts[user.current_phase]++
    }
  }
  return counts
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

  // ─── Computed values ────────────────────────────────────────────────

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Summary stats
  const completedCount = users.filter(u => u.onboarding_status === 'completed').length
  const inProgressCount = users.filter(u => u.onboarding_status === 'in-progress').length
  const droppedOffCount = users.filter(u => u.onboarding_status === 'dropped-off').length
  const completedPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0

  // Funnel counts
  const funnelCounts = computeFunnelCounts(users)

  // ─── Styles ─────────────────────────────────────────────────────────

  const cardBg = isDark ? '#0A0A0A' : '#FFFFFF'
  const cardBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const textPrimary = isDark ? '#F5F5F5' : '#0A0A0A'
  const textSecondary = '#71717A'
  const textTertiary = '#A1A1AA'
  const inputBg = isDark ? '#111111' : '#FAFAFA'
  const inputBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const headerBg = isDark ? '#111111' : '#F5F5F5'
  const rowHoverBg = isDark ? '#111111' : '#FAFAFA'
  const detailBg = isDark ? '#0D0D0D' : '#F9FAFB'
  const subtleBg = isDark ? '#111111' : '#FAFAFA'

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

      {/* A. Summary Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: total },
          { label: 'Completed', value: completedCount, suffix: completedPercent > 0 ? ` (${completedPercent}%)` : '' },
          { label: 'In Progress', value: inProgressCount },
          { label: 'Dropped Off', value: droppedOffCount },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border px-5 py-4"
            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
          >
            <div className="text-2xl font-semibold" style={{ color: textPrimary }}>
              {stat.value.toLocaleString()}
              {stat.suffix && (
                <span className="text-sm font-normal ml-1" style={{ color: textSecondary }}>
                  {stat.suffix}
                </span>
              )}
            </div>
            <div className="text-xs mt-1" style={{ color: textSecondary }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* B. Phase Funnel Visual */}
      <div
        className="rounded-xl border px-6 py-5"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        <div className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: textSecondary }}>
          Onboarding Funnel
        </div>
        <div className="flex items-center justify-between">
          {FUNNEL_PHASES.map((phase, idx) => {
            const count = funnelCounts[phase] || 0
            const hasPeople = count > 0
            const filledColor = isDark ? '#F5F5F5' : '#0A0A0A'
            const emptyColor = isDark ? '#27272A' : '#E5E5E5'
            const lineColor = isDark ? '#27272A' : '#E5E5E5'

            return (
              <React.Fragment key={phase}>
                {idx > 0 && (
                  <div className="flex-1 h-px mx-1" style={{ backgroundColor: lineColor }} />
                )}
                <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{
                      backgroundColor: hasPeople ? filledColor : emptyColor,
                      color: hasPeople ? (isDark ? '#0A0A0A' : '#FFFFFF') : textTertiary,
                    }}
                  >
                    {count}
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: hasPeople ? textPrimary : textTertiary }}>
                    {FUNNEL_LABELS[phase]}
                  </span>
                </div>
              </React.Fragment>
            )
          })}
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

      {/* C. Enhanced Table */}
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
                    Tier
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: textSecondary }}>
                    Sessions
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: textSecondary }}>
                    Docs Generated
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
                            style={{ backgroundColor: isDark ? statusCfg.bgDark : statusCfg.bg, color: isDark ? statusCfg.colorDark : statusCfg.color }}
                          >
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* Phase badge */}
                        <td className="px-4 py-3">
                          {phaseCfg ? (
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                              style={{ backgroundColor: isDark ? phaseCfg.bgDark : phaseCfg.bg, color: isDark ? phaseCfg.colorDark : phaseCfg.color }}
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
                                  backgroundColor: '#3B82F6',
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Tier */}
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider"
                            style={{
                              backgroundColor: isDark ? '#27272A' : '#E5E5E5',
                              color: isDark ? '#D4D4D8' : '#0A0A0A',
                            }}
                          >
                            {user.tier || 'free'}
                          </span>
                        </td>

                        {/* Sessions */}
                        <td className="px-4 py-3 text-xs" style={{ color: textSecondary }}>
                          {user.total_sessions}
                        </td>

                        {/* Docs Generated */}
                        <td className="px-4 py-3 text-xs" style={{ color: textSecondary }}>
                          {user.total_generations}
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

                      {/* Expandable detail row — always rendered, animated */}
                      <tr style={{ borderBottom: `1px solid ${cardBorder}` }}>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateRows: isExpanded ? '1fr' : '0fr',
                              transition: 'grid-template-rows 300ms ease-out',
                            }}
                          >
                            <div style={{ overflow: 'hidden' }}>
                              <div
                                className="px-6 py-5 space-y-5"
                                style={{
                                  backgroundColor: detailBg,
                                  borderTop: isExpanded ? `1px solid ${cardBorder}` : 'none',
                                  opacity: isExpanded ? 1 : 0,
                                  transition: 'opacity 200ms ease-out 100ms',
                                }}
                              >
                              {/* 1. Phase Progress Visual — Horizontal Stepper */}
                              <div>
                                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textSecondary }}>
                                  Phase Progress
                                </span>
                                <div className="flex items-center mt-3">
                                  {PHASE_ORDER.map((phase, idx) => {
                                    const userPhaseIdx = user.onboarding_status === 'completed'
                                      ? PHASE_ORDER.length - 1
                                      : getPhaseIndex(user.current_phase)
                                    const isReached = idx <= userPhaseIdx
                                    const filledCircle = isDark ? '#F5F5F5' : '#0A0A0A'
                                    const emptyCircle = isDark ? '#27272A' : '#E5E5E5'
                                    const lineColor = isDark ? '#27272A' : '#E5E5E5'
                                    const lineFilledColor = isDark ? '#71717A' : '#71717A'

                                    // Get timestamp for this phase
                                    const timestamps: Record<string, string | null> = {
                                      upload: user.upload_started_at,
                                      chat: user.chat_started_at,
                                      logo: user.logo_started_at,
                                      payments: user.payments_started_at,
                                      completed: user.completed_at,
                                    }
                                    const ts = timestamps[phase]

                                    return (
                                      <React.Fragment key={phase}>
                                        {idx > 0 && (
                                          <div
                                            className="flex-1 h-px mx-1"
                                            style={{ backgroundColor: isReached ? lineFilledColor : lineColor }}
                                          />
                                        )}
                                        <div className="flex flex-col items-center min-w-[64px]">
                                          <div
                                            className="w-7 h-7 rounded-full flex items-center justify-center"
                                            style={{
                                              backgroundColor: isReached ? filledCircle : emptyCircle,
                                            }}
                                          >
                                            {isReached ? (
                                              <Check className="w-3.5 h-3.5" style={{ color: isDark ? '#0A0A0A' : '#FFFFFF' }} />
                                            ) : (
                                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: textTertiary }} />
                                            )}
                                          </div>
                                          <span
                                            className="text-[10px] font-medium mt-1"
                                            style={{ color: isReached ? textPrimary : textTertiary }}
                                          >
                                            {FUNNEL_LABELS[phase]}
                                          </span>
                                          {ts && (
                                            <span className="text-[9px] mt-0.5" style={{ color: textTertiary }}>
                                              {new Date(ts).toLocaleDateString()}
                                            </span>
                                          )}
                                        </div>
                                      </React.Fragment>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* 2. Activity Stats */}
                              <div>
                                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textSecondary }}>
                                  Activity Stats
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                                  {[
                                    { icon: LayoutDashboard, label: 'Document Sessions', value: user.total_sessions },
                                    { icon: FileText, label: 'Documents Generated', value: user.total_generations },
                                    { icon: Mail, label: 'Emails Sent', value: user.total_emails_sent },
                                    { icon: MessageSquare, label: 'Chat Messages', value: user.total_messages },
                                  ].map((stat) => (
                                    <div
                                      key={stat.label}
                                      className="rounded-xl border px-3 py-2.5"
                                      style={{ backgroundColor: isDark ? '#111111' : '#FFFFFF', borderColor: cardBorder }}
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <stat.icon className="w-3.5 h-3.5" style={{ color: textTertiary }} />
                                        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textSecondary }}>
                                          {stat.label}
                                        </span>
                                      </div>
                                      <div className="text-lg font-semibold" style={{ color: textPrimary }}>
                                        {stat.value}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* 3. User Info */}
                              <div>
                                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textSecondary }}>
                                  User Info
                                </span>
                                <div className="flex flex-wrap gap-6 mt-2">
                                  <div>
                                    <span className="text-[10px] uppercase tracking-wider" style={{ color: textTertiary }}>Tier</span>
                                    <div className="mt-0.5">
                                      <span
                                        className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider"
                                        style={{
                                          backgroundColor: isDark ? '#27272A' : '#E5E5E5',
                                          color: isDark ? '#D4D4D8' : '#0A0A0A',
                                        }}
                                      >
                                        {user.tier || 'free'}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] uppercase tracking-wider" style={{ color: textTertiary }}>Signed Up</span>
                                    <div className="text-xs font-medium mt-0.5" style={{ color: textPrimary }}>
                                      {user.signed_up_at ? new Date(user.signed_up_at).toLocaleDateString() : '—'}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] uppercase tracking-wider" style={{ color: textTertiary }}>Last Active</span>
                                    <div className="text-xs font-medium mt-0.5" style={{ color: textPrimary }}>
                                      {user.last_active_at
                                        ? formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true })
                                        : '—'}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] uppercase tracking-wider" style={{ color: textTertiary }}>Data Entry Method</span>
                                    <div className="mt-0.5 flex items-center gap-1.5">
                                      {user.used_extraction ? (
                                        <>
                                          <FileUp className="w-3.5 h-3.5" style={{ color: textSecondary }} />
                                          <span className="text-xs font-medium" style={{ color: textPrimary }}>AI Extraction</span>
                                        </>
                                      ) : (
                                        <>
                                          <Keyboard className="w-3.5 h-3.5" style={{ color: textSecondary }} />
                                          <span className="text-xs font-medium" style={{ color: textPrimary }}>Manual Entry</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] uppercase tracking-wider" style={{ color: textTertiary }}>Payment Setup</span>
                                    <div className="mt-0.5 flex items-center gap-1.5">
                                      {user.has_payment_setup ? (
                                        <>
                                          <CreditCard className="w-3.5 h-3.5" style={{ color: isDark ? '#34D399' : '#059669' }} />
                                          <span className="text-xs font-medium" style={{ color: textPrimary }}>
                                            {user.payment_method_type === 'gateway' ? 'Payment Gateway' : 'Bank Details'}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <CreditCard className="w-3.5 h-3.5" style={{ color: textTertiary }} />
                                          <span className="text-xs font-medium" style={{ color: textSecondary }}>Not Configured</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* 4. Field Completion Grid */}
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
                                            backgroundColor: isCompleted
                                              ? (isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)')
                                              : (isDark ? '#1A1A1A' : '#E5E5E5'),
                                          }}
                                        >
                                          {isCompleted ? (
                                            <Check className="w-3 h-3" style={{ color: isDark ? '#34D399' : '#059669' }} />
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
                            </div>
                          </div>
                        </td>
                      </tr>
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

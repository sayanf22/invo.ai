'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, AlertTriangle, Mail, Clock, CheckCircle, Filter, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorProfile {
  email: string | null
  full_name: string | null
}

export interface ErrorLog {
  id: string
  error_context: string
  error_message: string
  metadata: Record<string, unknown> | null
  status: string | null
  created_at: string
  user_id: string | null
  profiles: ErrorProfile | null
}

interface ErrorsClientProps {
  initialErrors: ErrorLog[]
  initialTotal: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

const CONTEXT_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'upload', label: 'Upload' },
  { value: 'chat', label: 'Chat' },
  { value: 'logo', label: 'Logo' },
  { value: 'payments', label: 'Payments' },
  { value: 'non-onboarding', label: 'Non-Onboarding' },
]

const PHASE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  upload:   { label: 'Upload',   bg: 'rgba(59,130,246,0.15)',  color: '#3B82F6' },
  chat:     { label: 'Chat',     bg: 'rgba(168,85,247,0.15)',  color: '#A855F7' },
  logo:     { label: 'Logo',     bg: 'rgba(249,115,22,0.15)',  color: '#F97316' },
  payments: { label: 'Payments', bg: 'rgba(34,197,94,0.15)',   color: '#22C55E' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract onboarding phase from error_context.
 * e.g. "onboarding_upload" → "upload", "onboarding_chat_ai_error" → "chat"
 */
function extractOnboardingPhase(errorContext: string): string | null {
  if (!errorContext.startsWith('onboarding')) return null
  const parts = errorContext.replace('onboarding_', '').split('_')
  const phase = parts[0]
  if (phase && PHASE_CONFIG[phase]) return phase
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ErrorsClient({ initialErrors, initialTotal }: ErrorsClientProps) {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'

  const [errors, setErrors] = useState<ErrorLog[]>(initialErrors)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [contextFilter, setContextFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)

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

  // Reset page when context filter changes
  useEffect(() => {
    setPage(1)
  }, [contextFilter])

  // ─── Fetch errors ─────────────────────────────────────────────────────

  const fetchErrors = useCallback(async () => {
    setLoading(true)
    setFetchError(false)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (contextFilter !== 'all') params.set('context_filter', contextFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/admin/errors?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setErrors(json.errors ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [page, contextFilter, debouncedSearch])

  // Fetch when page, filter, or search changes (skip initial load)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    fetchErrors()
  }, [fetchErrors])

  // ─── Display helpers ──────────────────────────────────────────────────

  function getUserDisplay(log: ErrorLog): { name: string; email: string | null } {
    if (!log.profiles) return { name: 'System / Anonymous', email: null }
    return {
      name: log.profiles.full_name || 'System / Anonymous',
      email: log.profiles.email,
    }
  }

  function getUserInitial(log: ErrorLog): string {
    const { name } = getUserDisplay(log)
    if (name === 'System / Anonymous') return '?'
    return name[0]?.toUpperCase() ?? '?'
  }

  // ─── Pagination ─────────────────────────────────────────────────────────

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // ─── Styles ─────────────────────────────────────────────────────────────

  const cardBg = isDark ? '#0A0A0A' : '#FFFFFF'
  const cardBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const textPrimary = isDark ? '#F5F5F5' : '#0A0A0A'
  const textSecondary = '#71717A'
  const inputBg = isDark ? '#111111' : '#FAFAFA'
  const inputBorder = isDark ? '#1A1A1A' : '#E5E5E5'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold" style={{ color: textPrimary }}>
            System Errors
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
        {/* Context filter dropdown */}
        <div className="relative">
          <Filter
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: textSecondary }}
          />
          <select
            value={contextFilter}
            onChange={e => setContextFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500 cursor-pointer"
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }}
          >
            {CONTEXT_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: textSecondary }}
          />
        </div>

        {/* Search input */}
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
            className="w-full pl-10 pr-4 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }}
          />
        </div>
      </div>

      {/* Error state */}
      {fetchError && (
        <div
          className="p-4 rounded-md text-sm"
          style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#EF4444',
          }}
        >
          Failed to load error logs.{' '}
          <button onClick={fetchErrors} className="underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="rounded-lg border p-5 animate-pulse"
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}
            >
              <div className="flex gap-4">
                <div
                  className="w-10 h-10 rounded-full"
                  style={{ backgroundColor: isDark ? '#27272A' : '#D4D4D8' }}
                />
                <div className="flex-1 space-y-3">
                  <div
                    className="h-4 rounded w-1/3"
                    style={{ backgroundColor: isDark ? '#27272A' : '#D4D4D8' }}
                  />
                  <div
                    className="h-3 rounded w-1/4"
                    style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }}
                  />
                  <div
                    className="h-16 rounded w-full"
                    style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !fetchError && errors.length === 0 && (
        <div
          className="p-16 text-center rounded-lg border flex flex-col items-center"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <CheckCircle className="w-10 h-10 mb-4" style={{ color: '#22C55E' }} />
          <p className="font-medium text-lg" style={{ color: textPrimary }}>
            {debouncedSearch || contextFilter !== 'all' ? 'No errors found' : 'No Errors'}
          </p>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            {debouncedSearch
              ? `No error logs matching "${debouncedSearch}"`
              : contextFilter !== 'all'
                ? `No errors matching the selected filter.`
                : 'The system is running smoothly.'}
          </p>
        </div>
      )}

      {/* Errors list */}
      {!loading && !fetchError && errors.length > 0 && (
        <div className="space-y-4">
          {errors.map(log => {
            const { name, email } = getUserDisplay(log)
            const phase = extractOnboardingPhase(log.error_context)
            const phaseCfg = phase ? PHASE_CONFIG[phase] : null

            return (
              <div
                key={log.id}
                className="rounded-lg border p-5 relative overflow-hidden transition-shadow hover:shadow-md"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              >
                {/* Status indicator bar */}
                {log.status === 'open' && (
                  <div
                    className="absolute top-0 left-0 w-1 h-full"
                    style={{ backgroundColor: '#EF4444' }}
                  />
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                  {/* Left: Avatar + Content */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
                      style={{
                        backgroundColor: isDark ? '#27272A' : '#D4D4D8',
                        color: isDark ? '#F5F5F5' : '#0A0A0A',
                      }}
                    >
                      {getUserInitial(log)}
                    </div>

                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Name, email, badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm" style={{ color: textPrimary }}>
                          {name}
                        </h3>

                        {email && (
                          <a
                            href={`mailto:${email}`}
                            className="inline-flex items-center gap-1 text-xs hover:underline"
                            style={{ color: textSecondary }}
                          >
                            <Mail className="w-3 h-3" />
                            {email}
                          </a>
                        )}

                        {/* Onboarding phase badge */}
                        {phaseCfg && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                            style={{ backgroundColor: phaseCfg.bg, color: phaseCfg.color }}
                          >
                            {phaseCfg.label}
                          </span>
                        )}

                        {/* Status badge */}
                        {log.status === 'open' ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' }}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Open
                          </span>
                        ) : log.status === 'resolved' ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                            style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22C55E' }}
                          >
                            <CheckCircle className="w-3 h-3" />
                            Resolved
                          </span>
                        ) : null}
                      </div>

                      {/* Error context + timestamp */}
                      <div className="flex items-center gap-3 text-xs" style={{ color: textSecondary }}>
                        <span className="font-mono">{log.error_context}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      {/* Error message */}
                      <div
                        className="rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed"
                        style={{
                          backgroundColor: isDark ? '#111111' : '#F5F5F5',
                          border: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
                          color: textPrimary,
                        }}
                      >
                        {log.error_message}
                      </div>

                      {/* Metadata */}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div
                          className="rounded-md p-3 text-xs font-mono break-all"
                          style={{
                            backgroundColor: isDark ? '#0D0D0D' : '#F9F9F9',
                            border: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
                            color: textSecondary,
                          }}
                        >
                          {JSON.stringify(log.metadata, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && !fetchError && total > PAGE_SIZE && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-lg border"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <span className="text-xs" style={{ color: textSecondary }}>
            {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
              className="px-3 py-1.5 text-xs rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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

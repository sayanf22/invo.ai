'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, MessageSquare, Mail, Clock, Save, Check, Eye, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupportProfile {
  email: string | null
  full_name: string | null
}

export interface SupportMessage {
  id: string
  message: string
  status: string
  admin_notes: string | null
  onboarding_phase: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
  user_id: string | null
  profiles: SupportProfile | null
}

interface SupportClientProps {
  initialMessages: SupportMessage[]
  initialTotal: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

const PHASE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  upload:   { label: 'Upload',   bg: 'rgba(59,130,246,0.15)',  color: '#3B82F6' },
  chat:     { label: 'Chat',     bg: 'rgba(168,85,247,0.15)',  color: '#A855F7' },
  logo:     { label: 'Logo',     bg: 'rgba(249,115,22,0.15)',  color: '#F97316' },
  payments: { label: 'Payments', bg: 'rgba(34,197,94,0.15)',   color: '#22C55E' },
}

const STATUS_CONFIG: Record<string, { label: string; bgLight: string; bgDark: string; color: string; dotColor: string }> = {
  unread:   { label: 'Unread',   bgLight: 'rgba(59,130,246,0.1)',  bgDark: 'rgba(59,130,246,0.15)', color: '#3B82F6', dotColor: '#3B82F6' },
  read:     { label: 'Read',     bgLight: '#E5E5E5',               bgDark: '#27272A',                color: '#71717A', dotColor: '#71717A' },
  resolved: { label: 'Resolved', bgLight: 'rgba(16,185,129,0.1)',  bgDark: 'rgba(16,185,129,0.15)', color: '#059669', dotColor: '#059669' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupportClient({ initialMessages, initialTotal }: SupportClientProps) {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'

  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Admin notes editing state
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

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

  // ─── Fetch messages ─────────────────────────────────────────────────────

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/admin/support?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setMessages(json.messages ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  // Fetch when page or search changes (skip initial load since we have initialMessages)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    fetchMessages()
  }, [fetchMessages])

  // ─── Status update with optimistic UI ───────────────────────────────────

  async function handleStatusChange(messageId: string, newStatus: string) {
    const prevMessages = [...messages]

    // Optimistic update
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, status: newStatus } : msg
      )
    )

    try {
      const res = await fetch('/api/admin/support', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: messageId, status: newStatus }),
      })

      if (!res.ok) throw new Error('Failed to update status')

      const json = await res.json()
      // Update with server response
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, ...json.message } : msg
        )
      )
    } catch {
      // Revert on error
      setMessages(prevMessages)
      toast.error('Failed to update status. Please try again.')
    }
  }

  // ─── Admin notes save ──────────────────────────────────────────────────

  async function handleSaveNotes(messageId: string) {
    setSavingNotes(true)
    try {
      const res = await fetch('/api/admin/support', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: messageId, admin_notes: notesValue }),
      })

      if (!res.ok) throw new Error('Failed to save notes')

      const json = await res.json()
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, ...json.message } : msg
        )
      )
      setEditingNotesId(null)
      toast.success('Notes saved')
    } catch {
      toast.error('Failed to save notes. Please try again.')
    } finally {
      setSavingNotes(false)
    }
  }

  function startEditingNotes(msg: SupportMessage) {
    setEditingNotesId(msg.id)
    setNotesValue(msg.admin_notes ?? '')
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  function getSenderName(msg: SupportMessage): string {
    if (!msg.profiles) return 'Anonymous'
    return msg.profiles.full_name || 'Anonymous'
  }

  function getSenderEmail(msg: SupportMessage): string | null {
    if (!msg.profiles) return null
    return msg.profiles.email
  }

  function getSenderInitial(msg: SupportMessage): string {
    const name = getSenderName(msg)
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
            Support Messages
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

      {/* Search */}
      <div className="relative">
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
          Failed to load support messages.{' '}
          <button onClick={fetchMessages} className="underline hover:no-underline">
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
      {!loading && !error && messages.length === 0 && (
        <div
          className="p-16 text-center rounded-lg border flex flex-col items-center"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        >
          <MessageSquare className="w-10 h-10 mb-4" style={{ color: isDark ? '#27272A' : '#D4D4D8' }} />
          <p className="font-medium text-lg" style={{ color: textPrimary }}>
            {debouncedSearch ? 'No messages found' : 'Inbox Zero'}
          </p>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            {debouncedSearch
              ? `No support messages matching "${debouncedSearch}"`
              : 'No pending support messages.'}
          </p>
        </div>
      )}

      {/* Messages list */}
      {!loading && !error && messages.length > 0 && (
        <div className="space-y-4">
          {messages.map(msg => {
            const senderName = getSenderName(msg)
            const senderEmail = getSenderEmail(msg)
            const statusCfg = STATUS_CONFIG[msg.status] ?? STATUS_CONFIG.unread
            const phaseCfg = msg.onboarding_phase
              ? PHASE_CONFIG[msg.onboarding_phase]
              : null
            const isEditingNotes = editingNotesId === msg.id

            return (
              <div
                key={msg.id}
                className="rounded-lg border p-5 relative overflow-hidden transition-shadow hover:shadow-md"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              >
                {/* Unread indicator bar */}
                {msg.status === 'unread' && (
                  <div
                    className="absolute top-0 left-0 w-1.5 h-full"
                    style={{ backgroundColor: '#2563EB' }}
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
                      {getSenderInitial(msg)}
                    </div>

                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Name, email, badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm" style={{ color: textPrimary }}>
                          {senderName}
                        </h3>

                        {senderEmail && (
                          <a
                            href={`mailto:${senderEmail}`}
                            className="inline-flex items-center gap-1 text-xs hover:underline"
                            style={{ color: textSecondary }}
                          >
                            <Mail className="w-3 h-3" />
                            {senderEmail}
                          </a>
                        )}

                        {/* Phase badge */}
                        {phaseCfg && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                            style={{ backgroundColor: phaseCfg.bg, color: phaseCfg.color }}
                          >
                            {phaseCfg.label}
                          </span>
                        )}

                        {/* Status badge */}
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            backgroundColor: isDark ? statusCfg.bgDark : statusCfg.bgLight,
                            color: statusCfg.color,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusCfg.dotColor }} />
                          {statusCfg.label}
                        </span>
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: textSecondary }}>
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </div>

                      {/* Message body */}
                      <div
                        className="rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed"
                        style={{
                          backgroundColor: isDark ? '#111111' : '#F5F5F5',
                          border: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
                          color: textPrimary,
                        }}
                      >
                        {msg.message}
                      </div>

                      {/* Admin notes */}
                      <div className="mt-2">
                        {isEditingNotes ? (
                          <div className="space-y-2">
                            <label className="text-xs font-medium" style={{ color: textSecondary }}>
                              Admin Notes
                            </label>
                            <textarea
                              value={notesValue}
                              onChange={e => setNotesValue(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500 resize-none"
                              style={{
                                backgroundColor: inputBg,
                                borderColor: inputBorder,
                                color: textPrimary,
                              }}
                              placeholder="Add internal notes about this message…"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSaveNotes(msg.id)}
                                disabled={savingNotes}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50"
                                style={{
                                  backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A',
                                  color: isDark ? '#0A0A0A' : '#FFFFFF',
                                }}
                              >
                                <Save className="w-3 h-3" />
                                {savingNotes ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingNotesId(null)}
                                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                                style={{
                                  backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5',
                                  color: textSecondary,
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditingNotes(msg)}
                            className="text-xs hover:underline"
                            style={{ color: textSecondary }}
                          >
                            {msg.admin_notes
                              ? `📝 ${msg.admin_notes}`
                              : '+ Add admin notes'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Status toggle buttons */}
                  <div className="flex sm:flex-col gap-2 shrink-0">
                    {msg.status !== 'read' && (
                      <button
                        onClick={() => handleStatusChange(msg.id, 'read')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors"
                        style={{
                          backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5',
                          color: textSecondary,
                        }}
                        title="Mark as read"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Read
                      </button>
                    )}
                    {msg.status !== 'resolved' && (
                      <button
                        onClick={() => handleStatusChange(msg.id, 'resolved')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors"
                        style={{
                          backgroundColor: 'rgba(16,185,129,0.1)',
                          color: '#059669',
                        }}
                        title="Mark as resolved"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Resolve
                      </button>
                    )}
                    {msg.status !== 'unread' && (
                      <button
                        onClick={() => handleStatusChange(msg.id, 'unread')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors"
                        style={{
                          backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5',
                          color: textSecondary,
                        }}
                        title="Mark as unread"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Unread
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && total > PAGE_SIZE && (
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

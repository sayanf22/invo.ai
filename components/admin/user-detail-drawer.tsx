'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmationDialog from './confirmation-dialog'
import TierOverrideModal from './tier-override-modal'
import { useAdminTheme } from './admin-theme-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDetailData {
  profile: Record<string, unknown> | null
  business: Record<string, unknown> | null
  usageStats: Record<string, unknown> | null
  recentDocuments: Array<Record<string, unknown>>
  recentAuditLogs: Array<Record<string, unknown>>
  recentEmails: Array<Record<string, unknown>>
  totalEmailsSent: number
}

interface Props {
  userId: string | null
  onClose: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: unknown): string {
  if (!iso || typeof iso !== 'string') return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatDateTime(iso: unknown): string {
  if (!iso || typeof iso !== 'string') return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function TierBadge({ tier, isDark }: { tier: unknown; isDark: boolean }) {
  const t = typeof tier === 'string' ? tier : 'free'
  const styles: Record<string, string> = {
    free: isDark ? 'bg-[#1A1A1A] text-[#71717A]' : 'bg-[#F0F0F0] text-[#52525B]',
    starter: 'bg-blue-900 text-blue-300',
    pro: 'bg-purple-900 text-purple-300',
    agency: 'bg-yellow-900 text-yellow-300',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${styles[t] ?? styles.free}`}>
      {t}
    </span>
  )
}

function Section({ title, isDark, children }: { title: string; isDark: boolean; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`, paddingTop: '1rem' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#71717A' }}>{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, value, isDark }: { label: string; value: React.ReactNode; isDark: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1">
      <span className="text-sm flex-shrink-0" style={{ color: '#71717A' }}>{label}</span>
      <span className="text-sm text-right" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{value ?? '—'}</span>
    </div>
  )
}

function Skeleton({ isDark }: { isDark: boolean }) {
  const pulse = isDark ? '#1A1A1A' : '#E5E5E5'
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full" style={{ backgroundColor: pulse }} />
        <div className="space-y-2">
          <div className="h-4 rounded w-32" style={{ backgroundColor: pulse }} />
          <div className="h-3 rounded w-48" style={{ backgroundColor: pulse }} />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-4 rounded w-full" style={{ backgroundColor: pulse }} />
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UserDetailDrawer({ userId, onClose }: Props) {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'
  const [data, setData] = useState<UserDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tierModalOpen, setTierModalOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    action: () => Promise<void>
    destructive?: boolean
  }>({ open: false, title: '', description: '', action: async () => {} })
  const [actionLoading, setActionLoading] = useState(false)

  const fetchUser = useCallback(async (id: string) => {
    setLoading(true)
    setData(null)
    try {
      const res = await fetch(`/api/admin/users/${id}`)
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      toast.error('Failed to load user details')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userId) fetchUser(userId)
  }, [userId, fetchUser])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const profile = data?.profile
  const business = data?.business
  const usage = data?.usageStats
  const isSuspended = !!profile?.suspended_at

  async function runAction(fn: () => Promise<Response>, successMsg: string) {
    setActionLoading(true)
    try {
      const res = await fn()
      if (!res.ok) throw new Error('Failed')
      toast.success(successMsg)
      fetchUser(userId!)
    } catch {
      toast.error('Action failed. Please try again.')
    } finally {
      setActionLoading(false)
      setConfirmDialog(d => ({ ...d, open: false }))
    }
  }

  function openConfirm(
    title: string,
    description: string,
    action: () => Promise<void>,
    destructive = false
  ) {
    setConfirmDialog({ open: true, title, description, action, destructive })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        style={{ opacity: userId ? 1 : 0, pointerEvents: userId ? 'auto' : 'none' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-labelledby="drawer-title"
        className="fixed inset-y-0 right-0 w-full max-w-xl overflow-y-auto z-50 transition-transform duration-300 ease-out"
        style={{
          transform: userId ? 'translateX(0)' : 'translateX(100%)',
          backgroundColor: isDark ? '#000000' : '#FFFFFF',
          borderLeft: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 px-6 py-4 flex items-center justify-between"
          style={{
            backgroundColor: isDark ? '#000000' : '#FFFFFF',
            borderBottom: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
          }}
        >
          <h2 id="drawer-title" className="text-lg font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>User Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md active:scale-95 transition-all duration-150"
            style={{ color: '#71717A' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? '#111111' : '#F0F0F0'
              e.currentTarget.style.color = isDark ? '#F5F5F5' : '#0A0A0A'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#71717A'
            }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {loading ? (
            <Skeleton isDark={isDark} />
          ) : !data ? (
            <p className="text-sm" style={{ color: '#71717A' }}>No data available.</p>
          ) : (
            <>
              {/* 1. Profile */}
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
                  style={{ backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A', color: isDark ? '#0A0A0A' : '#FFFFFF' }}
                >
                  {(typeof profile?.full_name === 'string' ? profile.full_name[0] : '?')?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-semibold truncate" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
                      {typeof profile?.full_name === 'string' ? profile.full_name : '—'}
                    </p>
                    <TierBadge tier={profile?.tier} isDark={isDark} />
                  </div>
                  <p className="text-sm truncate" style={{ color: '#71717A' }}>
                    {typeof profile?.email === 'string' ? profile.email : '—'}
                  </p>
                  <div className="flex gap-4 mt-1 text-xs" style={{ color: '#52525B' }}>
                    <span>Joined {formatDate(profile?.created_at)}</span>
                    <span>
                      Last active{' '}
                      {profile?.last_active_at ? formatDate(profile.last_active_at) : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Business */}
              {business && (
                <Section title="Business" isDark={isDark}>
                  <Field label="Business Name" value={business.business_name as string} isDark={isDark} />
                  <Field label="Country" value={business.country as string} isDark={isDark} />
                  <Field label="Industry" value={business.industry as string} isDark={isDark} />
                </Section>
              )}

              {/* 3. Usage Stats */}
              <Section title="Usage Stats" isDark={isDark}>
                <Field label="Documents" value={String(usage?.documents_count ?? 0)} isDark={isDark} />
                <Field label="Emails Sent (this month)" value={String(usage?.emails_count ?? 0)} isDark={isDark} />
                <Field label="Emails Sent (all time)" value={String(data.totalEmailsSent ?? 0)} isDark={isDark} />
                <Field label="AI Requests" value={String(usage?.ai_requests_count ?? 0)} isDark={isDark} />
                <Field label="Tokens Used" value={String(usage?.ai_tokens_used ?? 0)} isDark={isDark} />
                <Field
                  label="Est. Cost"
                  value={`${Number(usage?.estimated_cost_usd ?? 0).toFixed(4)}`}
                  isDark={isDark}
                />
              </Section>

              {/* 4. Recent Emails */}
              <Section title="Recent Emails" isDark={isDark}>
                {data.recentEmails.length === 0 ? (
                  <p className="text-sm" style={{ color: '#71717A' }}>No emails sent yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.recentEmails.map((email, i) => {
                      const status = typeof email.status === 'string' ? email.status : 'sent'
                      const statusColors: Record<string, string> = {
                        opened: '#22C55E',
                        delivered: '#3B82F6',
                        sent: '#71717A',
                        bounced: '#EF4444',
                        failed: '#EF4444',
                      }
                      return (
                        <li key={i} className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
                              {typeof email.recipient_email === 'string' ? email.recipient_email : '—'}
                            </span>
                            <span className="text-xs capitalize shrink-0" style={{ color: '#71717A' }}>
                              {typeof email.document_type === 'string' ? email.document_type : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-medium capitalize" style={{ color: statusColors[status] ?? '#71717A' }}>
                              {status}
                            </span>
                            <span className="text-xs" style={{ color: '#52525B' }}>
                              {formatDate(email.created_at)}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>

              {/* 5. Recent Documents */}
              <Section title="Recent Documents" isDark={isDark}>
                {data.recentDocuments.length === 0 ? (
                  <p className="text-sm" style={{ color: '#71717A' }}>No documents yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.recentDocuments.map((doc, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
                          {typeof doc.title === 'string' ? doc.title : 'Untitled'}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs capitalize" style={{ color: '#71717A' }}>
                            {typeof doc.document_type === 'string' ? doc.document_type : ''}
                          </span>
                          <span className="text-xs" style={{ color: '#52525B' }}>
                            {formatDate(doc.created_at)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* 6. Recent Audit Logs */}
              <Section title="Recent Audit Logs" isDark={isDark}>
                {data.recentAuditLogs.length === 0 ? (
                  <p className="text-sm" style={{ color: '#71717A' }}>No audit logs.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.recentAuditLogs.map((log, i) => (
                      <li key={i} className="flex items-start justify-between gap-2 text-sm">
                        <span className="font-mono text-xs flex-shrink-0" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>
                          {typeof log.action === 'string' ? log.action : ''}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0 text-xs" style={{ color: '#52525B' }}>
                          <span>{formatDateTime(log.created_at)}</span>
                          {typeof log.ip_address === 'string' && (
                            <span className="font-mono">{log.ip_address}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Action Buttons */}
              <Section title="Actions" isDark={isDark}>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => setTierModalOpen(true)}
                    className="px-3 py-1.5 text-sm rounded-md active:scale-95 transition-all duration-150"
                    style={{
                      backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A',
                      color: isDark ? '#0A0A0A' : '#FFFFFF',
                    }}
                  >
                    Change Tier
                  </button>
                  <button
                    onClick={() =>
                      openConfirm(
                        'Reset Usage',
                        'This will reset the monthly usage counters for this user. This cannot be undone.',
                        async () => {
                          await runAction(
                            () => fetch(`/api/admin/users/${userId}/reset-usage`, { method: 'POST' }),
                            'Usage reset successfully'
                          )
                        },
                        true
                      )
                    }
                    className="px-3 py-1.5 text-sm rounded-md active:scale-95 transition-all duration-150"
                    style={{
                      backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
                      color: isDark ? '#F5F5F5' : '#0A0A0A',
                    }}
                  >
                    Reset Usage
                  </button>
                  <button
                    onClick={() =>
                      openConfirm(
                        isSuspended ? 'Unsuspend User' : 'Suspend User',
                        isSuspended
                          ? 'This will restore access for this user.'
                          : 'This will immediately block this user from accessing the platform.',
                        async () => {
                          await runAction(
                            () =>
                              fetch(`/api/admin/users/${userId}/suspend`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ suspend: !isSuspended }),
                              }),
                            isSuspended ? 'User unsuspended' : 'User suspended'
                          )
                        },
                        !isSuspended
                      )
                    }
                    className={`px-3 py-1.5 text-sm rounded-md text-white active:scale-95 transition-all duration-150 ${
                      isSuspended
                        ? 'bg-green-700 hover:bg-green-600'
                        : 'bg-red-700 hover:bg-red-600'
                    }`}
                  >
                    {isSuspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                  <button
                    onClick={() => toast.info('Feature coming soon')}
                    className="px-3 py-1.5 text-sm rounded-md active:scale-95 transition-all duration-150"
                    style={{
                      backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
                      color: isDark ? '#F5F5F5' : '#0A0A0A',
                    }}
                  >
                    Reset Password
                  </button>
                </div>
              </Section>
            </>
          )}
        </div>
      </div>

      {/* Tier Override Modal */}
      {userId && (
        <TierOverrideModal
          open={tierModalOpen}
          onOpenChange={setTierModalOpen}
          userId={userId}
          currentTier={typeof profile?.tier === 'string' ? profile.tier : 'free'}
          onSuccess={() => {
            setTierModalOpen(false)
            fetchUser(userId)
          }}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(d => ({ ...d, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        destructive={confirmDialog.destructive}
        loading={actionLoading}
        onConfirm={confirmDialog.action}
      />
    </>
  )
}

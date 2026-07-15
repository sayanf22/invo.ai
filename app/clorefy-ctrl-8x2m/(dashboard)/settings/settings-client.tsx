'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'

// ─── Tier feature flags (static UI) ──────────────────────────────────────────

const TIER_FEATURES = [
  { tier: 'Free', features: ['5 documents/month', '10 generation messages/session', '200 chat messages/session', '5 emails/month', 'Invoice, contract, and quote'] },
  { tier: 'Starter', features: ['50 documents/month', '30 generation messages/session', '500 chat messages/session', '100 emails/month', 'All document types'] },
  { tier: 'Pro', features: ['150 documents/month', '50 generation messages/session', '1,500 chat messages/session', '250 emails/month', 'All document types'] },
  { tier: 'Agency', features: ['Unlimited documents', 'Unlimited messages', 'Unlimited emails', 'All document types'] },
]

interface Announcement {
  id: string
  message: string
  active: boolean
  created_by: string | null
  created_at: string
  expires_at: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsClient({ adminEmail }: { adminEmail: string }) {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'

  const containerBg = isDark ? '#0A0A0A' : '#FAFAFA'
  const containerBorder = isDark ? '#1A1A1A' : '#E5E5E5'
  const inputBg = isDark ? '#111111' : '#FAFAFA'

  // PIN change
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [changingPin, setChangingPin] = useState(false)

  // Announcement
  const [announcementMsg, setAnnouncementMsg] = useState('')
  const [announcementExpiry, setAnnouncementExpiry] = useState('')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true)
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  const fetchAnnouncements = useCallback(async () => {
    setLoadingAnnouncements(true)
    try {
      const res = await fetch('/api/admin/settings/announcement')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setAnnouncements(data.announcements ?? [])
    } catch {
      toast.error('Failed to load announcements')
    } finally {
      setLoadingAnnouncements(false)
    }
  }, [])

  useEffect(() => { void fetchAnnouncements() }, [fetchAnnouncements])

  const inputStyle = {
    backgroundColor: inputBg,
    borderColor: containerBorder,
    color: isDark ? '#F5F5F5' : '#0A0A0A',
  }

  async function handlePinChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      toast.error('New PIN must be exactly 6 digits')
      return
    }
    if (newPin !== confirmPin) {
      toast.error('PINs do not match')
      return
    }
    setChangingPin(true)
    try {
      const res = await fetch('/api/admin/settings/pin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed')
      }
      toast.success('PIN updated successfully')
      setCurrentPin(''); setNewPin(''); setConfirmPin('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update PIN')
    } finally {
      setChangingPin(false)
    }
  }

  async function handleAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    if (!announcementMsg.trim()) { toast.error('Message is required'); return }
    setPostingAnnouncement(true)
    try {
      const res = await fetch('/api/admin/settings/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: announcementMsg,
          expires_at: announcementExpiry || undefined,
        }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error ?? 'Failed to create announcement')
      }
      toast.success('Announcement created')
      setAnnouncementMsg(''); setAnnouncementExpiry('')
      await fetchAnnouncements()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create announcement')
    } finally {
      setPostingAnnouncement(false)
    }
  }

  async function deactivateAnnouncement(id: string) {
    setDeactivatingId(id)
    try {
      const res = await fetch('/api/admin/settings/announcement', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: false }),
      })
      if (!res.ok) throw new Error('Failed')
      setAnnouncements(current => current.filter(announcement => announcement.id !== id))
      toast.success('Announcement deactivated')
    } catch {
      toast.error('Failed to deactivate announcement')
    } finally {
      setDeactivatingId(null)
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Settings</h1>

      {/* Admin Info */}
      <div className="rounded-lg border p-5" style={{ backgroundColor: containerBg, borderColor: containerBorder }}>
        <h2 className="text-base font-semibold mb-3" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Admin Account</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
            style={{ backgroundColor: isDark ? '#27272A' : '#D4D4D8', color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
            {adminEmail[0]?.toUpperCase() ?? 'A'}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Admin</p>
            <p className="text-xs" style={{ color: '#71717A' }}>{adminEmail}</p>
          </div>
        </div>
      </div>

      {/* PIN Change */}
      <div className="rounded-lg border p-5" style={{ backgroundColor: containerBg, borderColor: containerBorder }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Change PIN</h2>
        <form onSubmit={handlePinChange} className="space-y-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: '#71717A' }}>Current PIN</label>
            <input type="password" required value={currentPin} onChange={e => setCurrentPin(e.target.value)}
              placeholder="••••••" maxLength={6} style={inputStyle}
              className="w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#71717A' }}>New PIN <span style={{ color: '#52525B' }}>(6 digits)</span></label>
            <input type="password" required value={newPin} onChange={e => setNewPin(e.target.value)}
              placeholder="••••••" maxLength={6} pattern="\d{6}" style={inputStyle}
              className="w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#71717A' }}>Confirm New PIN</label>
            <input type="password" required value={confirmPin} onChange={e => setConfirmPin(e.target.value)}
              placeholder="••••••" maxLength={6} style={inputStyle}
              className="w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500" />
          </div>
          <button type="submit" disabled={changingPin}
            className="px-4 py-2 rounded-md disabled:opacity-50 text-sm font-medium transition-colors"
            style={{ backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A', color: isDark ? '#0A0A0A' : '#FFFFFF' }}>
            {changingPin ? 'Updating…' : 'Update PIN'}
          </button>
        </form>
      </div>

      {/* Announcements */}
      <div className="rounded-lg border p-5" style={{ backgroundColor: containerBg, borderColor: containerBorder }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Announcements</h2>
        <p className="text-xs mb-4" style={{ color: '#52525B' }}>Create a system-wide announcement visible to all users.</p>
        <form onSubmit={handleAnnouncement} className="space-y-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: '#71717A' }}>Message</label>
            <textarea required value={announcementMsg} onChange={e => setAnnouncementMsg(e.target.value)}
              rows={3} placeholder="Announcement message…" style={inputStyle}
              className="w-full px-3 py-2 rounded-md border text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#71717A' }}>Expiry (optional)</label>
            <input type="datetime-local" value={announcementExpiry} onChange={e => setAnnouncementExpiry(e.target.value)}
              style={inputStyle} className="px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 focus:ring-gray-500" />
          </div>
          <button type="submit" disabled={postingAnnouncement}
            className="px-4 py-2 rounded-md disabled:opacity-50 text-sm font-medium transition-colors"
            style={{ backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A', color: isDark ? '#0A0A0A' : '#FFFFFF' }}>
            {postingAnnouncement ? 'Posting…' : 'Post Announcement'}
          </button>
        </form>
        <div className="mt-5 pt-4 border-t" style={{ borderColor: containerBorder }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Active announcements</h3>
          {loadingAnnouncements ? (
            <p className="text-xs" style={{ color: '#71717A' }}>Loading announcements…</p>
          ) : announcements.length === 0 ? (
            <p className="text-xs" style={{ color: '#71717A' }}>No active announcements.</p>
          ) : (
            <ul className="space-y-2">
              {announcements.map(announcement => (
                <li key={announcement.id} className="rounded-md border p-3" style={{ backgroundColor: isDark ? '#111111' : '#FFFFFF', borderColor: containerBorder }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm break-words" style={{ color: isDark ? '#D4D4D8' : '#27272A' }}>{announcement.message}</p>
                      <p className="text-[11px] mt-1" style={{ color: '#71717A' }}>
                        Created {new Date(announcement.created_at).toLocaleString()}
                        {announcement.expires_at ? ` · Expires ${new Date(announcement.expires_at).toLocaleString()}` : ' · No expiry'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={deactivatingId === announcement.id}
                      onClick={() => void deactivateAnnouncement(announcement.id)}
                      className="shrink-0 px-2.5 py-1.5 rounded text-xs disabled:opacity-50"
                      style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#EF4444' }}
                    >
                      {deactivatingId === announcement.id ? 'Deactivating…' : 'Deactivate'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Enforced Tier Limits */}
      <div className="rounded-lg border p-5" style={{ backgroundColor: containerBg, borderColor: containerBorder }}>
        <h2 className="text-base font-semibold mb-1" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Enforced Tier Limits</h2>
        <p className="text-xs mb-4" style={{ color: '#52525B' }}>Read-only values matching the server-side cost protection configuration.</p>
        <div className="space-y-4">
          {TIER_FEATURES.map(({ tier, features }) => (
            <div key={tier} className="p-3 rounded-md border" style={{ backgroundColor: isDark ? '#111111' : '#FFFFFF', borderColor: containerBorder }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{tier}</span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: '#71717A' }}>Server enforced</span>
              </div>
              <ul className="space-y-1">
                {features.map(f => (
                  <li key={f} className="text-xs flex items-center gap-2" style={{ color: '#71717A' }}>
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: isDark ? '#27272A' : '#D4D4D8' }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

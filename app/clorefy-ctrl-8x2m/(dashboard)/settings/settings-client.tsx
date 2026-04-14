'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useAdminTheme } from '@/components/admin/admin-theme-provider'

// ─── Tier feature flags (static UI) ──────────────────────────────────────────

const TIER_FEATURES = [
  { tier: 'Free', features: ['3 docs/month', '10 msgs/session', 'Basic templates'] },
  { tier: 'Starter', features: ['50 docs/month', '25 msgs/session', 'All templates', 'PDF export'] },
  { tier: 'Pro', features: ['150 docs/month', '30 msgs/session', 'All templates', 'PDF + DOCX export', 'Priority support'] },
  { tier: 'Agency', features: ['Unlimited docs', 'Unlimited msgs', 'All templates', 'All exports', 'Dedicated support'] },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsClient() {
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
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)

  // Maintenance mode toggle (static)
  const [maintenanceMode, setMaintenanceMode] = useState(false)

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
      if (!res.ok) throw new Error('Failed')
      toast.success('Announcement created')
      setAnnouncementMsg(''); setAnnouncementExpiry('')
    } catch {
      toast.error('Failed to create announcement')
    } finally {
      setPostingAnnouncement(false)
    }
  }

  function handleComingSoon() {
    toast.info('Coming soon — feature flags are not yet connected to the backend')
  }

  function handleMaintenanceToggle() {
    toast.info('Coming soon — maintenance mode is not yet connected to the backend')
    setMaintenanceMode(v => !v)
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Settings</h1>

      {/* Admin Info */}
      <div className="rounded-lg border p-5" style={{ backgroundColor: containerBg, borderColor: containerBorder }}>
        <h2 className="text-base font-semibold mb-3" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Admin Account</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
            style={{ backgroundColor: isDark ? '#27272A' : '#D4D4D8', color: isDark ? '#F5F5F5' : '#0A0A0A' }}>A</div>
          <div>
            <p className="text-sm font-medium" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Admin</p>
            <p className="text-xs" style={{ color: '#71717A' }}>Email is managed server-side</p>
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
        <p className="text-xs mt-4" style={{ color: '#52525B' }}>Note: A dedicated GET endpoint for listing announcements is not yet available.</p>
      </div>

      {/* Feature Flags */}
      <div className="rounded-lg border p-5" style={{ backgroundColor: containerBg, borderColor: containerBorder }}>
        <h2 className="text-base font-semibold mb-1" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Feature Flags</h2>
        <p className="text-xs mb-4" style={{ color: '#52525B' }}>Tier feature toggles — backend integration coming soon.</p>
        <div className="space-y-4">
          {TIER_FEATURES.map(({ tier, features }) => (
            <div key={tier} className="p-3 rounded-md border" style={{ backgroundColor: isDark ? '#111111' : '#FFFFFF', borderColor: containerBorder }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{tier}</span>
                <button onClick={handleComingSoon}
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                  style={{ backgroundColor: isDark ? '#27272A' : '#D4D4D8' }}>
                  <span className="inline-block h-3 w-3 translate-x-1 rounded-full transition-transform" style={{ backgroundColor: '#71717A' }} />
                </button>
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

      {/* Maintenance Mode */}
      <div className="rounded-lg border p-5" style={{ backgroundColor: containerBg, borderColor: containerBorder }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Maintenance Mode</h2>
            <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>Temporarily disable access for non-admin users.</p>
          </div>
          <button
            onClick={handleMaintenanceToggle}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
            style={{ backgroundColor: maintenanceMode ? '#F59E0B' : isDark ? '#27272A' : '#D4D4D8' }}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${maintenanceMode ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        {maintenanceMode && (
          <p className="text-xs mt-3" style={{ color: '#F59E0B' }}>⚠ Coming soon — this toggle is not yet connected to the backend.</p>
        )}
      </div>
    </div>
  )
}

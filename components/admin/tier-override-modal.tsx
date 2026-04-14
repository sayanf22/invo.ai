'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAdminTheme } from './admin-theme-provider'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  currentTier: string
  onSuccess: () => void
}

const TIERS = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'agency', label: 'Agency' },
]

const DURATIONS = [
  { value: '30', label: '1 month', days: 30 },
  { value: '60', label: '2 months', days: 60 },
  { value: '90', label: '3 months', days: 90 },
  { value: '180', label: '6 months', days: 180 },
  { value: '365', label: '1 year', days: 365 },
  { value: 'custom', label: 'Custom', days: 0 },
  { value: 'permanent', label: 'Permanent (no expiry)', days: 0 },
]

export default function TierOverrideModal({
  open,
  onOpenChange,
  userId,
  currentTier,
  onSuccess,
}: Props) {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'
  const [tier, setTier] = useState(currentTier)
  const [duration, setDuration] = useState('30')
  const [customDate, setCustomDate] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  function computeExpiresAt(): string | undefined {
    if (duration === 'permanent') return undefined
    if (duration === 'custom') {
      return customDate ? new Date(customDate).toISOString() : undefined
    }
    const days = DURATIONS.find(d => d.value === duration)?.days ?? 30
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  }

  async function handleConfirm() {
    if (!reason.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/tier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          expires_at: computeExpiresAt(),
          reason: reason.trim(),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`Tier changed to ${tier}`)
      setReason('')
      setDuration('30')
      setCustomDate('')
      onSuccess()
    } catch {
      toast.error('Failed to change tier. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md transition-all duration-200"
        style={{
          backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
          borderColor: isDark ? '#1A1A1A' : '#E5E5E5',
          color: isDark ? '#F5F5F5' : '#0A0A0A',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
            Change User Tier
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tier selector */}
          <div>
            <label className="block text-sm mb-2" style={{ color: isDark ? '#71717A' : '#71717A' }}>
              New Tier
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIERS.map((t) => (
                <label
                  key={t.value}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-all duration-150"
                  style={{
                    borderColor: tier === t.value
                      ? isDark ? '#FFFFFF' : '#0A0A0A'
                      : isDark ? '#1A1A1A' : '#E5E5E5',
                    backgroundColor: tier === t.value
                      ? isDark ? '#1F1F1F' : '#F0F0F0'
                      : isDark ? '#111111' : '#FAFAFA',
                    color: tier === t.value
                      ? isDark ? '#FFFFFF' : '#0A0A0A'
                      : isDark ? '#71717A' : '#52525B',
                  }}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={t.value}
                    checked={tier === t.value}
                    onChange={() => setTier(t.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{t.label}</span>
                  {t.value === currentTier && (
                    <span className="ml-auto text-xs" style={{ color: isDark ? '#52525B' : '#71717A' }}>current</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Duration dropdown */}
          <div>
            <label className="block text-sm mb-1" style={{ color: isDark ? '#71717A' : '#71717A' }}>
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 transition-all duration-150"
              style={{
                backgroundColor: isDark ? '#111111' : '#FAFAFA',
                borderColor: isDark ? '#1A1A1A' : '#E5E5E5',
                color: isDark ? '#F5F5F5' : '#0A0A0A',
              }}
            >
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Custom date picker (only when custom is selected) */}
          {duration === 'custom' && (
            <div>
              <label className="block text-sm mb-1" style={{ color: isDark ? '#71717A' : '#71717A' }}>
                Custom Expiry Date
              </label>
              <input
                type="date"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                className="w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-1 transition-all duration-150"
                style={{
                  backgroundColor: isDark ? '#111111' : '#FAFAFA',
                  borderColor: isDark ? '#1A1A1A' : '#E5E5E5',
                  color: isDark ? '#F5F5F5' : '#0A0A0A',
                }}
              />
            </div>
          )}

          {/* Required reason */}
          <div>
            <label className="block text-sm mb-1" style={{ color: isDark ? '#71717A' : '#71717A' }}>
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason for tier change…"
              rows={3}
              className="w-full px-3 py-2 rounded-md border text-sm resize-none focus:outline-none focus:ring-1 transition-all duration-150"
              style={{
                backgroundColor: isDark ? '#111111' : '#FAFAFA',
                borderColor: isDark ? '#1A1A1A' : '#E5E5E5',
                color: isDark ? '#F5F5F5' : '#0A0A0A',
              }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2 rounded-md text-sm active:scale-95 transition-all duration-150 disabled:opacity-50"
            style={{
              backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
              color: isDark ? '#F5F5F5' : '#0A0A0A',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim() || loading}
            className="px-4 py-2 rounded-md text-sm flex items-center gap-2 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A',
              color: isDark ? '#0A0A0A' : '#FFFFFF',
            }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Change
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

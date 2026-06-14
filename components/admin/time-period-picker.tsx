'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Calendar, X } from 'lucide-react'
import { useAdminTheme } from './admin-theme-provider'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom'

export interface DateRange {
  period: TimePeriod
  /** ISO date string YYYY-MM-DD or undefined */
  from?: string
  /** ISO date string YYYY-MM-DD or undefined */
  to?: string
}

interface TimePeriodPickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

const PRESET_OPTIONS: Array<{ value: TimePeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
]

/** Human-readable label for the current selection */
function rangeLabel(range: DateRange): string {
  if (range.period === 'custom' && range.from) {
    const from = range.from
    const to = range.to ?? 'now'
    return `${from} → ${to}`
  }
  return PRESET_OPTIONS.find(o => o.value === range.period)?.label ?? 'Period'
}

// ── Utility: convert DateRange to ISO cutoff strings ─────────────────────────

export function rangeToQueryParams(range: DateRange): string {
  return `period=${range.period}${range.from ? `&from=${range.from}` : ''}${range.to ? `&to=${range.to}` : ''}`
}

export function periodToISO(period: TimePeriod): { from: string | undefined; to: string | undefined } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  if (period === 'all' || period === 'custom') return { from: undefined, to: undefined }
  if (period === 'today') {
    const f = fmt(now)
    return { from: f, to: f }
  }
  if (period === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    return { from: fmt(d), to: undefined }
  }
  if (period === 'month') {
    return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: undefined }
  }
  // year
  return { from: `${now.getFullYear()}-01-01`, to: undefined }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TimePeriodPicker({ value, onChange }: TimePeriodPickerProps) {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'
  const [customOpen, setCustomOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(value.from ?? '')
  const [customTo, setCustomTo] = useState(value.to ?? '')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const bg = isDark ? '#0A0A0A' : '#FFFFFF'
  const pillBg = isDark ? '#1A1A1A' : '#F0F0F0'
  const activeBg = isDark ? '#FFFFFF' : '#0A0A0A'
  const activeColor = isDark ? '#0A0A0A' : '#FFFFFF'
  const inactiveColor = isDark ? '#71717A' : '#52525B'
  const border = isDark ? '#1A1A1A' : '#E5E5E5'
  const inputStyle = {
    backgroundColor: isDark ? '#111111' : '#FAFAFA',
    borderColor: border,
    color: isDark ? '#F5F5F5' : '#0A0A0A',
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCustomOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectPreset(period: TimePeriod) {
    if (period === 'custom') {
      setCustomOpen(true)
      return
    }
    setCustomOpen(false)
    onChange({ period })
  }

  function applyCustom() {
    if (!customFrom) return
    onChange({ period: 'custom', from: customFrom, to: customTo || undefined })
    setCustomOpen(false)
  }

  function clearCustom() {
    setCustomFrom('')
    setCustomTo('')
    onChange({ period: 'month' })
    setCustomOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Pill strip for presets */}
      <div
        className="inline-flex items-center rounded-xl p-1 gap-0.5 flex-wrap"
        style={{ backgroundColor: pillBg, border: `1px solid ${border}` }}
      >
        {PRESET_OPTIONS.map((opt) => {
          const isActive = value.period === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => selectPreset(opt.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95"
              style={{
                backgroundColor: isActive ? activeBg : 'transparent',
                color: isActive ? activeColor : inactiveColor,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {opt.value === 'custom' ? (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {value.period === 'custom' && value.from
                    ? `${value.from}${value.to ? ` → ${value.to}` : ''}`
                    : 'Custom'}
                </span>
              ) : opt.label}
            </button>
          )
        })}
      </div>

      {/* Custom date range dropdown */}
      {customOpen && (
        <div
          className="absolute left-0 top-full mt-2 z-50 rounded-2xl shadow-xl p-4 w-72"
          style={{ backgroundColor: bg, border: `1px solid ${border}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
              Custom date range
            </span>
            <button onClick={() => setCustomOpen(false)} style={{ color: inactiveColor }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: inactiveColor }}>From</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: inactiveColor }}>To (optional)</label>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={e => setCustomTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                style={inputStyle}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={clearCustom}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium"
                style={{ backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0', color: inactiveColor }}
              >
                Reset
              </button>
              <button
                onClick={applyCustom}
                disabled={!customFrom}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: activeBg, color: activeColor }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

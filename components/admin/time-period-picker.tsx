'use client'

import { useAdminTheme } from './admin-theme-provider'

export type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'all'

interface TimePeriodPickerProps {
  value: TimePeriod
  onChange: (period: TimePeriod) => void
}

const OPTIONS: Array<{ value: TimePeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
]

export default function TimePeriodPicker({ value, onChange }: TimePeriodPickerProps) {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'
  const inactiveBg = isDark ? '#1A1A1A' : '#F0F0F0'
  const activeBg = isDark ? '#FFFFFF' : '#0A0A0A'
  const activeColor = isDark ? '#0A0A0A' : '#FFFFFF'
  const inactiveColor = isDark ? '#71717A' : '#52525B'
  const border = isDark ? '#1A1A1A' : '#E5E5E5'

  return (
    <div
      className="inline-flex items-center rounded-lg p-0.5 gap-0.5"
      style={{ backgroundColor: inactiveBg, border: `1px solid ${border}` }}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150"
          style={{
            backgroundColor: value === opt.value ? activeBg : 'transparent',
            color: value === opt.value ? activeColor : inactiveColor,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** Convert a TimePeriod to ISO start date strings for filtering */
export function periodToDateRange(period: TimePeriod): { dateFrom: string | undefined; dateTo: string | undefined } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')

  if (period === 'all') return { dateFrom: undefined, dateTo: undefined }

  let from: Date
  if (period === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (period === 'week') {
    const day = now.getDay()
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
  } else {
    // year
    from = new Date(now.getFullYear(), 0, 1)
  }

  return {
    dateFrom: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    dateTo: undefined,
  }
}

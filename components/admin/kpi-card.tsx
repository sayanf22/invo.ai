'use client'

import { useEffect, useRef, useState } from 'react'
import SkeletonCard from './skeleton-card'
import { useAdminTheme } from './admin-theme-provider'

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function useCountUp(target: number, duration: number = 1200): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    startTimeRef.current = null
    setValue(0)

    function tick(timestamp: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp
      }
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      setValue(Math.round(easeOutCubic(progress) * target))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [target, duration])

  return value
}

interface KpiCardProps {
  title: string
  value: number
  prefix?: string
  suffix?: string
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  description?: string
}

export default function KpiCard({
  title,
  value,
  prefix,
  suffix,
  loading,
  error,
  onRetry,
  description,
}: KpiCardProps) {
  const { theme } = useAdminTheme()
  const displayValue = useCountUp(error || loading ? 0 : value)
  const isDark = theme === 'dark'

  if (loading) {
    return <SkeletonCard />
  }

  if (error) {
    return (
      <div
        className="rounded-lg p-4 border flex flex-col gap-2 transition-all duration-200"
        style={{
          backgroundColor: isDark ? '#0A0A0A' : '#FAFAFA',
          borderColor: isDark ? '#1A1A1A' : '#E5E5E5',
        }}
      >
        <p className="text-sm" style={{ color: isDark ? '#71717A' : '#71717A' }}>{title}</p>
        <p className="text-sm text-red-400">Failed to load data</p>
        {onRetry && (
          <button onClick={onRetry} className="text-xs underline self-start" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>Retry</button>
        )}
      </div>
    )
  }

  return (
    <div
      className="rounded-lg p-4 border transition-all duration-200 hover:scale-[1.02]"
      style={{
        backgroundColor: isDark ? '#0A0A0A' : '#FAFAFA',
        borderColor: isDark ? '#1A1A1A' : '#E5E5E5',
      }}
    >
      <p className="text-sm mb-1" style={{ color: isDark ? '#71717A' : '#71717A' }}>{title}</p>
      <p className="text-2xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#0A0A0A' }}>
        {prefix}{displayValue.toLocaleString()}{suffix}
      </p>
      {description && <p className="text-xs mt-1" style={{ color: isDark ? '#52525B' : '#71717A' }}>{description}</p>}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useAdminTheme } from './admin-theme-provider'
import AdminThemeToggle from './theme-toggle'

interface AdminHeaderProps {
  adminEmail: string
  sessionExpiresAt: number
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function AdminHeader({ adminEmail, sessionExpiresAt }: AdminHeaderProps) {
  const router = useRouter()
  const { theme } = useAdminTheme()
  const [remaining, setRemaining] = useState(() => sessionExpiresAt - Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(sessionExpiresAt - Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [sessionExpiresAt])

  const isWarning = remaining < 5 * 60 * 1000
  const isCritical = remaining < 2 * 60 * 1000
  const isDark = theme === 'dark'

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/clorefy-ctrl-8x2m/login')
  }

  return (
    <header
      className="flex items-center justify-between h-14 px-4 shrink-0 transition-colors duration-200"
      style={{
        backgroundColor: isDark ? '#000000' : '#FFFFFF',
        borderBottom: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
      }}
    >
      <span className="text-sm" style={{ color: isDark ? '#71717A' : '#71717A' }}>
        {adminEmail}
      </span>

      <div className="flex items-center gap-4">
        {/* Session countdown */}
        <span
          className="text-sm font-mono"
          style={{
            color: isCritical ? '#EF4444' : isWarning ? '#F59E0B' : '#71717A',
          }}
        >
          Session: {formatCountdown(remaining)}
        </span>

        {/* Theme toggle */}
        <AdminThemeToggle />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm active:scale-95 transition-all duration-150"
          style={{ color: isDark ? '#71717A' : '#71717A' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = isDark ? '#F5F5F5' : '#0A0A0A' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#71717A' }}
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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

// Map pathname → readable section name
function getSectionName(pathname: string): string {
  if (pathname === '/clorefy-ctrl-8x2m') return 'Dashboard'
  if (pathname.startsWith('/clorefy-ctrl-8x2m/analytics/engagement')) return 'User Engagement'
  if (pathname.startsWith('/clorefy-ctrl-8x2m/analytics/documents')) return 'Documents & AI'
  if (pathname.startsWith('/clorefy-ctrl-8x2m/analytics/activity')) return 'Peak Activity'
  if (pathname.startsWith('/clorefy-ctrl-8x2m/analytics')) return 'Analytics'
  if (pathname.startsWith('/clorefy-ctrl-8x2m/users')) return 'Users'
  if (pathname.startsWith('/clorefy-ctrl-8x2m/subscriptions')) return 'Subscriptions'
  if (pathname.startsWith('/clorefy-ctrl-8x2m/revenue')) return 'Revenue'
  if (pathname.startsWith('/clorefy-ctrl-8x2m/ai-usage')) return 'AI Usage'
  if (pathname.startsWith('/clorefy-ctrl-8x2m/security')) return 'Security'
  if (pathname.startsWith('/clorefy-ctrl-8x2m/settings')) return 'Settings'
  return 'Admin'
}

export default function AdminHeader({ adminEmail, sessionExpiresAt }: AdminHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme } = useAdminTheme()
  const [remaining, setRemaining] = useState(() => sessionExpiresAt - Date.now())

  useEffect(() => {
    const interval = setInterval(() => setRemaining(sessionExpiresAt - Date.now()), 1000)
    return () => clearInterval(interval)
  }, [sessionExpiresAt])

  const isWarning = remaining < 5 * 60 * 1000
  const isCritical = remaining < 2 * 60 * 1000
  const isDark = theme === 'dark'
  const border = isDark ? '#1A1A1A' : '#E5E5E5'

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/clorefy-ctrl-8x2m/login')
  }

  return (
    <header
      className="flex items-center justify-between h-14 px-5 shrink-0"
      style={{
        backgroundColor: isDark ? '#000000' : '#FFFFFF',
        borderBottom: `1px solid ${border}`,
      }}
    >
      {/* Section breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: '#52525B' }}>Admin</span>
        <span className="text-xs" style={{ color: '#3F3F46' }}>/</span>
        <span className="text-sm font-medium" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
          {getSectionName(pathname)}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Session countdown */}
        <span
          className="text-xs font-mono px-2 py-1 rounded-md"
          style={{
            color: isCritical ? '#EF4444' : isWarning ? '#F59E0B' : '#71717A',
            backgroundColor: isCritical
              ? 'rgba(239,68,68,0.1)'
              : isWarning
                ? 'rgba(245,158,11,0.1)'
                : isDark ? '#0A0A0A' : '#F5F5F5',
          }}
        >
          {formatCountdown(remaining)}
        </span>

        <AdminThemeToggle />

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm transition-all duration-150 active:scale-95"
          style={{ color: '#71717A' }}
          onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#F5F5F5' : '#0A0A0A' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#71717A' }}
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">Logout</span>
        </button>
      </div>
    </header>
  )
}

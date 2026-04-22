'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAdminTheme } from './admin-theme-provider'
import AdminSidebar from './admin-sidebar'
import AdminHeader from './admin-header'
import { cn } from '@/lib/utils'

interface AdminShellProps {
  adminEmail: string
  sessionExpiresAt: number
  children: React.ReactNode
}

export default function AdminShell({ adminEmail, sessionExpiresAt, children }: AdminShellProps) {
  const { theme } = useAdminTheme()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen(v => !v), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  // Close sidebar on route change (mobile navigation)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const isDark = theme === 'dark'

  return (
    <div
      className="flex h-screen overflow-hidden transition-colors duration-300"
      style={{
        backgroundColor: isDark ? '#000000' : '#FFFFFF',
        color: isDark ? '#F5F5F5' : '#0A0A0A',
      }}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-200"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar — hidden on mobile by default, shown via hamburger */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <AdminSidebar adminEmail={adminEmail} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <AdminHeader
          adminEmail={adminEmail}
          sessionExpiresAt={sessionExpiresAt}
          onToggleSidebar={toggleSidebar}
          sidebarOpen={sidebarOpen}
        />
        <main
          className="flex-1 overflow-auto p-4 sm:p-6"
          style={{ animation: 'adminFadeIn 0.3s ease-out' }}
        >
          <style>{`
            @keyframes adminFadeIn {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {children}
        </main>
      </div>
    </div>
  )
}

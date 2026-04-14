'use client'

import { useAdminTheme } from './admin-theme-provider'

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { theme } = useAdminTheme()
  return (
    <div
      className="flex h-screen transition-colors duration-300"
      style={{
        backgroundColor: theme === 'dark' ? '#000000' : '#FFFFFF',
        color: theme === 'dark' ? '#F5F5F5' : '#0A0A0A',
      }}
    >
      {children}
    </div>
  )
}

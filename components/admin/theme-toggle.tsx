'use client'

import { Sun, Moon } from 'lucide-react'
import { useAdminTheme } from './admin-theme-provider'

export default function AdminThemeToggle() {
  const { theme, toggleTheme } = useAdminTheme()

  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-white/20"
      style={{ backgroundColor: theme === 'dark' ? '#1A1A1A' : '#E5E5E5' }}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <span
        className="absolute top-0.5 flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 ease-in-out"
        style={{
          left: theme === 'dark' ? '2px' : 'calc(100% - 26px)',
          backgroundColor: theme === 'dark' ? '#111111' : '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      >
        {theme === 'dark' ? (
          <Moon className="w-3.5 h-3.5 text-[#F5F5F5]" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-[#0A0A0A]" />
        )}
      </span>
    </button>
  )
}

'use client'

import { createContext, useContext, useState, useEffect } from 'react'

type AdminTheme = 'dark' | 'light'

interface AdminThemeContextValue {
  theme: AdminTheme
  toggleTheme: () => void
}

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null)

export function useAdminTheme(): AdminThemeContextValue {
  const ctx = useContext(AdminThemeContext)
  // Safe fallback when used outside the provider (prevents SSR crashes)
  if (!ctx) return { theme: 'dark', toggleTheme: () => {} }
  return ctx
}

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AdminTheme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('admin-theme') as AdminTheme | null
    if (saved) setTheme(saved)
    setMounted(true)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('admin-theme', next)
  }

  // Prevent hydration mismatch — render children only after mount
  if (!mounted) {
    return (
      <AdminThemeContext.Provider value={{ theme: 'dark', toggleTheme }}>
        {children}
      </AdminThemeContext.Provider>
    )
  }

  return (
    <AdminThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </AdminThemeContext.Provider>
  )
}

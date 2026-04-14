'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Brain,
  DollarSign,
  Shield,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminTheme } from './admin-theme-provider'

const navLinks = [
  { href: '/clorefy-ctrl-8x2m', label: 'Overview', icon: LayoutDashboard },
  { href: '/clorefy-ctrl-8x2m/users', label: 'Users', icon: Users },
  { href: '/clorefy-ctrl-8x2m/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/clorefy-ctrl-8x2m/ai-usage', label: 'AI Usage', icon: Brain },
  { href: '/clorefy-ctrl-8x2m/revenue', label: 'Revenue', icon: DollarSign },
  { href: '/clorefy-ctrl-8x2m/security', label: 'Security', icon: Shield },
  { href: '/clorefy-ctrl-8x2m/settings', label: 'Settings', icon: Settings },
]

interface AdminSidebarProps {
  adminEmail: string
}

export default function AdminSidebar({ adminEmail }: AdminSidebarProps) {
  const pathname = usePathname()
  const { theme } = useAdminTheme()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth < 1024)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isDark = theme === 'dark'

  return (
    <aside
      className={cn(
        'flex flex-col transition-all duration-200 shrink-0',
        collapsed ? 'w-14' : 'w-56',
      )}
      style={{
        backgroundColor: isDark ? '#000000' : '#FAFAFA',
        color: isDark ? '#F5F5F5' : '#0A0A0A',
        borderRight: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}`,
      }}
    >
      {/* Logo / title */}
      <div
        className="flex items-center h-14 px-3"
        style={{ borderBottom: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}` }}
      >
        {!collapsed && (
          <span className="text-sm font-semibold truncate" style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>
            Admin Panel
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-1 px-2">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/clorefy-ctrl-8x2m'
              ? pathname === href
              : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-all duration-200 relative',
              )}
              style={{
                backgroundColor: isActive
                  ? isDark ? '#1F1F1F' : '#F0F0F0'
                  : 'transparent',
                color: isActive
                  ? isDark ? '#F5F5F5' : '#0A0A0A'
                  : isDark ? '#71717A' : '#52525B',
                borderLeft: isActive ? `2px solid ${isDark ? '#FFFFFF' : '#0A0A0A'}` : '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = isDark ? '#111111' : '#F0F0F0'
                  e.currentTarget.style.color = isDark ? '#F5F5F5' : '#0A0A0A'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = isDark ? '#71717A' : '#52525B'
                }
              }}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Admin email at bottom */}
      {!collapsed && (
        <div
          className="px-3 py-3"
          style={{ borderTop: `1px solid ${isDark ? '#1A1A1A' : '#E5E5E5'}` }}
        >
          <p className="text-xs truncate" style={{ color: isDark ? '#71717A' : '#52525B' }}>
            {adminEmail}
          </p>
        </div>
      )}
    </aside>
  )
}

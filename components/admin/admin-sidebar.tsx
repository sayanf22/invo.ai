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
  ChevronDown,
  ChevronRight,
  Activity,
  FileText,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminTheme } from './admin-theme-provider'

// ─── Nav structure ────────────────────────────────────────────────────────────

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  children?: NavItem[] // sub-items (like Supabase)
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/clorefy-ctrl-8x2m', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        href: '/clorefy-ctrl-8x2m/analytics',
        label: 'Analytics',
        icon: Activity,
        children: [
          { href: '/clorefy-ctrl-8x2m/analytics/engagement', label: 'User Engagement', icon: Users },
          { href: '/clorefy-ctrl-8x2m/analytics/documents', label: 'Documents & AI', icon: FileText },
          { href: '/clorefy-ctrl-8x2m/analytics/activity', label: 'Peak Activity', icon: TrendingUp },
        ],
      },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/clorefy-ctrl-8x2m/users', label: 'Users', icon: Users },
      { href: '/clorefy-ctrl-8x2m/subscriptions', label: 'Subscriptions', icon: CreditCard },
      { href: '/clorefy-ctrl-8x2m/revenue', label: 'Revenue', icon: DollarSign },
    ],
  },
  {
    label: 'Monitor',
    items: [
      { href: '/clorefy-ctrl-8x2m/ai-usage', label: 'AI Usage', icon: Brain },
      { href: '/clorefy-ctrl-8x2m/errors', label: 'Errors', icon: AlertTriangle },
      { href: '/clorefy-ctrl-8x2m/support', label: 'Support Feedback', icon: MessageSquare },
      { href: '/clorefy-ctrl-8x2m/security', label: 'Security', icon: Shield },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/clorefy-ctrl-8x2m/settings', label: 'Settings', icon: Settings },
    ],
  },
]

interface AdminSidebarProps {
  adminEmail: string
}

export default function AdminSidebar({ adminEmail }: AdminSidebarProps) {
  const pathname = usePathname()
  const { theme } = useAdminTheme()
  const [collapsed, setCollapsed] = useState(false)
  // Track which groups are open (all open by default)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Overview: true,
    Analytics: true,
    Manage: true,
    Monitor: true,
    System: true,
  })
  // Track which parent items with children are expanded
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    '/clorefy-ctrl-8x2m/analytics': true,
  })

  useEffect(() => {
    const handleResize = () => setCollapsed(window.innerWidth < 1280)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isDark = theme === 'dark'
  const bg = isDark ? '#000000' : '#FAFAFA'
  const border = isDark ? '#1A1A1A' : '#E5E5E5'
  const textMuted = isDark ? '#52525B' : '#A1A1AA'
  const textActive = isDark ? '#F5F5F5' : '#0A0A0A'
  const textInactive = isDark ? '#71717A' : '#52525B'
  const activeBg = isDark ? '#1A1A1A' : '#F0F0F0'
  const hoverBg = isDark ? '#111111' : '#F0F0F0'

  function isActive(href: string) {
    return href === '/clorefy-ctrl-8x2m'
      ? pathname === href
      : pathname.startsWith(href)
  }

  function toggleGroup(label: string) {
    if (collapsed) return
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function toggleItem(href: string) {
    if (collapsed) return
    setExpandedItems(prev => ({ ...prev, [href]: !prev[href] }))
  }

  function renderNavItem(item: NavItem, depth = 0) {
    const active = item.href === '/clorefy-ctrl-8x2m'
      ? pathname === item.href
      : pathname.startsWith(item.href)
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems[item.href] !== false

    // Auto-expand if a child is active
    const childActive = hasChildren && item.children!.some(c => pathname.startsWith(c.href))

    return (
      <div key={item.href}>
        {hasChildren ? (
          // Parent item with children — clicking toggles expansion
          <button
            type="button"
            onClick={() => toggleItem(item.href)}
            className={cn(
              'w-full flex items-center gap-3 rounded-md text-sm transition-all duration-150',
              collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2',
            )}
            style={{
              backgroundColor: (active || childActive) ? activeBg : 'transparent',
              color: (active || childActive) ? textActive : textInactive,
              borderLeft: !collapsed && (active || childActive) ? `2px solid ${isDark ? '#FFFFFF' : '#0A0A0A'}` : !collapsed ? '2px solid transparent' : undefined,
            }}
            onMouseEnter={e => {
              if (!active && !childActive) {
                e.currentTarget.style.backgroundColor = hoverBg
                e.currentTarget.style.color = textActive
              }
            }}
            onMouseLeave={e => {
              if (!active && !childActive) {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = textInactive
              }
            }}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                {(isExpanded || childActive)
                  ? <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                  : <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />
                }
              </>
            )}
          </button>
        ) : (
          // Leaf item — clicking navigates
          <Link
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md text-sm transition-all duration-150',
              collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2',
              depth > 0 && !collapsed ? 'pl-8' : '',
            )}
            style={{
              backgroundColor: active ? activeBg : 'transparent',
              color: active ? textActive : textInactive,
              borderLeft: !collapsed && active ? `2px solid ${isDark ? '#FFFFFF' : '#0A0A0A'}` : !collapsed ? '2px solid transparent' : undefined,
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.backgroundColor = hoverBg
                e.currentTarget.style.color = textActive
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = textInactive
              }
            }}
          >
            {depth > 0 && !collapsed ? (
              // Sub-item: dot indicator instead of icon
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: active ? (isDark ? '#FFFFFF' : '#0A0A0A') : '#52525B' }} />
            ) : (
              <item.icon className="h-4 w-4 shrink-0" />
            )}
            {!collapsed && <span>{item.label}</span>}
          </Link>
        )}

        {/* Children */}
        {hasChildren && !collapsed && (isExpanded || childActive) && (
          <div className="mt-0.5 space-y-0.5">
            {item.children!.map(child => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside
      className={cn('flex flex-col transition-all duration-200 shrink-0', collapsed ? 'w-14' : 'w-60')}
      style={{ backgroundColor: bg, borderRight: `1px solid ${border}` }}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
        {collapsed ? (
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: textActive }}>A</div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5', color: textActive }}>A</div>
            <span className="text-sm font-semibold" style={{ color: textActive }}>Admin Panel</span>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {NAV_GROUPS.map((group) => {
          const isOpen = openGroups[group.label] !== false
          const hasActiveItem = group.items.some(i =>
            i.href === '/clorefy-ctrl-8x2m' ? pathname === i.href : pathname.startsWith(i.href)
          )

          return (
            <div key={group.label}>
              {/* Group header */}
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-4 py-1.5 text-left transition-colors"
                  style={{ color: hasActiveItem ? textActive : textMuted }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest">
                    {group.label}
                  </span>
                  {group.items.length > 1 && (
                    isOpen
                      ? <ChevronDown className="w-3 h-3 opacity-50" />
                      : <ChevronRight className="w-3 h-3 opacity-50" />
                  )}
                </button>
              )}

              {/* Items */}
              {(collapsed || isOpen) && (
                <div className={cn('space-y-0.5', !collapsed && 'px-2 pb-2')}>
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = isActive(href)
                    return (
                      <Link
                        key={href}
                        href={href}
                        title={collapsed ? label : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-md text-sm transition-all duration-150',
                          collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2',
                        )}
                        style={{
                          backgroundColor: active ? activeBg : 'transparent',
                          color: active ? textActive : textInactive,
                          borderLeft: !collapsed && active ? `2px solid ${isDark ? '#FFFFFF' : '#0A0A0A'}` : !collapsed ? '2px solid transparent' : undefined,
                        }}
                        onMouseEnter={e => {
                          if (!active) {
                            e.currentTarget.style.backgroundColor = hoverBg
                            e.currentTarget.style.color = textActive
                          }
                        }}
                        onMouseLeave={e => {
                          if (!active) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = textInactive
                          }
                        }}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{label}</span>}
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* Divider between groups */}
              {!collapsed && (
                <div className="mx-4 my-1" style={{ borderTop: `1px solid ${border}` }} />
              )}
            </div>
          )
        })}
      </nav>

      {/* Admin email */}
      {!collapsed && (
        <div className="px-4 py-3 shrink-0" style={{ borderTop: `1px solid ${border}` }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ backgroundColor: isDark ? '#27272A' : '#D4D4D8', color: textActive }}>
              {adminEmail[0]?.toUpperCase() ?? 'A'}
            </div>
            <p className="text-xs truncate" style={{ color: textMuted }}>{adminEmail}</p>
          </div>
        </div>
      )}
    </aside>
  )
}

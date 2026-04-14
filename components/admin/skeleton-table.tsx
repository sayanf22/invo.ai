'use client'

import { useAdminTheme } from './admin-theme-provider'

export default function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  const { theme } = useAdminTheme()
  const border = theme === 'dark' ? 'border-[#1A1A1A]' : 'border-[#E5E5E5]'
  const pulse = theme === 'dark' ? 'bg-[#1A1A1A]' : 'bg-[#E5E5E5]'

  return (
    <div className="animate-pulse space-y-2">
      {/* Header */}
      <div className={`flex gap-4 pb-2 border-b ${border}`}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className={`h-4 rounded flex-1 ${pulse}`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className={`h-4 rounded flex-1 ${pulse}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

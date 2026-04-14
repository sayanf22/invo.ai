'use client'

import { useAdminTheme } from './admin-theme-provider'

export default function SkeletonCard() {
  const { theme } = useAdminTheme()
  const bg = theme === 'dark' ? 'bg-[#0A0A0A] border-[#1A1A1A]' : 'bg-[#FAFAFA] border-[#E5E5E5]'
  const pulse = theme === 'dark' ? 'bg-[#1A1A1A]' : 'bg-[#E5E5E5]'

  return (
    <div className={`rounded-lg p-4 border animate-pulse transition-all duration-200 ${bg}`}>
      <div className={`h-4 rounded w-1/2 mb-3 ${pulse}`} />
      <div className={`h-8 rounded w-3/4 mb-2 ${pulse}`} />
      <div className={`h-3 rounded w-1/3 ${pulse}`} />
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function AnalyticsPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/clorefy-ctrl-8x2m/analytics/engagement')
  }, [router])

  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  )
}

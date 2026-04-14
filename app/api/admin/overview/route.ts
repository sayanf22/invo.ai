import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin-auth'
import { getOverviewKPIs } from '@/lib/admin-queries'

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const data = await getOverviewKPIs()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[admin/overview] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

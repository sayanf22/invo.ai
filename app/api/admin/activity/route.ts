import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin-auth'
import { getActivityInsights } from '@/lib/admin-queries'

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const data = await getActivityInsights()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[admin/activity] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin-auth'
import { getSubscriptions } from '@/lib/admin-queries'

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { searchParams } = new URL(request.url)
    const data = await getSubscriptions({
      plan: searchParams.get('plan') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
    })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[admin/subscriptions] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

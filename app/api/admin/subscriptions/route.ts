import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin-auth'
import { getSubscriptions } from '@/lib/admin-queries'

function boundedPositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

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
      page: boundedPositiveInt(searchParams.get('page'), 1, 100_000),
      pageSize: boundedPositiveInt(searchParams.get('pageSize'), 20, 100),
    })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[admin/subscriptions] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

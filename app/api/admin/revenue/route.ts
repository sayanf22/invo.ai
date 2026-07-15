import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin-auth'
import { getRevenue } from '@/lib/admin-queries'

function boundedPositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { searchParams } = new URL(request.url)
    const data = await getRevenue({
      page: boundedPositiveInt(searchParams.get('page'), 1, 100_000),
      pageSize: boundedPositiveInt(searchParams.get('pageSize'), 25, 100),
      status: searchParams.get('status') ?? undefined,
    })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[admin/revenue] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

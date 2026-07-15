import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin-auth'
import { getAIUsage } from '@/lib/admin-queries'

function boundedPositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { searchParams } = new URL(request.url)
    const data = await getAIUsage({
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      docType: searchParams.get('docType') ?? undefined,
      userEmail: searchParams.get('userEmail') ?? undefined,
      success: searchParams.get('success') ?? undefined,
      page: boundedPositiveInt(searchParams.get('page'), 1, 100_000),
      pageSize: boundedPositiveInt(searchParams.get('pageSize'), 20, 100),
    })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[admin/ai-usage] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

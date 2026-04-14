import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin-auth'
import { getAIUsage } from '@/lib/admin-queries'

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
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
    })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[admin/ai-usage] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

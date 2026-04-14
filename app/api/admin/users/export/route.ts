import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin-auth'
import { getUsersPage } from '@/lib/admin-queries'

function escapeCsvField(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const data = await getUsersPage({
    search: searchParams.get('search') ?? undefined,
    tier: searchParams.get('tier') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    onboarding: searchParams.get('onboarding') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    sortBy: searchParams.get('sortBy') ?? undefined,
    sortDir: (searchParams.get('sortDir') as 'asc' | 'desc') ?? undefined,
    page: 1,
    pageSize: 10000,
  })

  const headers = ['id', 'full_name', 'email', 'tier', 'created_at', 'suspended_at', 'last_active_at']
  const rows = data.users.map(user =>
    headers.map(h => escapeCsvField((user as Record<string, unknown>)[h])).join(',')
  )
  const csvString = [headers.join(','), ...rows].join('\n')

  return new Response(csvString, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="users.csv"',
    },
  })
}

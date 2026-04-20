import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin-auth'
import { getUserDetail } from '@/lib/admin-queries'
import { isValidUUID } from '@/lib/admin-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const data = await getUserDetail(id)
  return NextResponse.json(data)
}

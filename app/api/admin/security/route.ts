import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { getSecurity } from '@/lib/admin-queries'
import { logAudit } from '@/lib/audit-log'

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { searchParams } = new URL(request.url)
    const data = await getSecurity({
      action: searchParams.get('action') ?? undefined,
      email: searchParams.get('email') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      ip: searchParams.get('ip') ?? undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
    })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[admin/security] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const body = await request.json()
    const { ip_address, reason, expires_at } = body

    if (!ip_address || typeof ip_address !== 'string') {
      return NextResponse.json({ error: 'ip_address is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error: insertError } = await supabase.from('ip_blocklist').insert({
      ip_address,
      reason: reason ?? null,
      blocked_by: adminEmail,
      expires_at: expires_at ?? null,
    })
    if (insertError) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    await logAudit(supabase, {
      user_id: 'admin',
      action: 'admin.ip_block',
      ip_address: ip,
      metadata: { ip_address, reason: reason ?? null, adminEmail },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/security] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const body = await request.json()
    const { ip_address } = body

    if (!ip_address || typeof ip_address !== 'string') {
      return NextResponse.json({ error: 'ip_address is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error: deleteError } = await supabase
      .from('ip_blocklist')
      .delete()
      .eq('ip_address', ip_address)
    if (deleteError) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    await logAudit(supabase, {
      user_id: 'admin',
      action: 'admin.ip_unblock',
      ip_address: ip,
      metadata: { ip_address, adminEmail },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/security] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

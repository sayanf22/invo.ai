import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { message, expires_at } = body

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error: insertError } = await supabase.from('system_announcements').insert({
    message: message.trim(),
    active: true,
    created_by: adminEmail,
    expires_at: expires_at ?? null,
  })
  if (insertError) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  await logAudit(supabase, {
    user_id: 'admin',
    action: 'admin.announcement_create',
    ip_address: ip,
    metadata: { message: message.trim(), adminEmail },
  })

  return NextResponse.json({ success: true })
}

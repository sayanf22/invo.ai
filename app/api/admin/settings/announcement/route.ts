import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'
import { getAdminClientIP, isValidUUID } from '@/lib/admin-utils'
import { sanitizeText } from '@/lib/sanitize'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await getAdminClient()
    .from('system_announcements')
    .select('id,message,active,created_by,created_at,expires_at')
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
  return NextResponse.json({ announcements: data ?? [] })
}

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: { message?: unknown; expires_at?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.message !== 'string' || !body.message.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }
  if (body.message.length > 500) {
    return NextResponse.json({ error: 'Message too long. Maximum 500 characters.' }, { status: 400 })
  }

  const sanitizedMessage = sanitizeText(body.message.trim())
  if (!sanitizedMessage) return NextResponse.json({ error: 'message is required' }, { status: 400 })

  let expiresAt: string | null = null
  if (body.expires_at !== undefined && body.expires_at !== null && body.expires_at !== '') {
    if (typeof body.expires_at !== 'string' || !Number.isFinite(Date.parse(body.expires_at))) {
      return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 })
    }
    expiresAt = new Date(body.expires_at).toISOString()
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase.from('system_announcements').insert({
    message: sanitizedMessage,
    active: true,
    created_by: adminEmail,
    expires_at: expiresAt,
  }).select('id,message,active,created_by,created_at,expires_at').single()
  if (error) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

  await logAudit(supabase, {
    user_id: 'admin',
    action: 'admin.announcement_create',
    ip_address: getAdminClientIP(request),
    metadata: { announcementId: data.id, adminEmail },
  }).catch(() => {})

  return NextResponse.json({ announcement: data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: { id?: unknown; active?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (typeof body.id !== 'string' || !isValidUUID(body.id) || body.active !== false) {
    return NextResponse.json({ error: 'A valid announcement id and active=false are required' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('system_announcements')
    .update({ active: false })
    .eq('id', body.id)
    .eq('active', true)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Failed to deactivate announcement' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })

  await logAudit(supabase, {
    user_id: 'admin',
    action: 'admin.announcement_deactivate',
    ip_address: getAdminClientIP(request),
    metadata: { announcementId: body.id, adminEmail },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}

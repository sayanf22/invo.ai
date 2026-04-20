import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'
import { isValidUUID, getAdminClientIP } from '@/lib/admin-utils'

const VALID_TIERS = ['free', 'starter', 'pro', 'agency']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  // Validate UUID format
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  const { tier, expires_at, reason } = body

  if (!VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Get current tier for audit log
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', id)
    .single()
  const oldTier = profile?.tier ?? 'free'

  // Update profile tier and expiry
  const updateData: Record<string, unknown> = { tier }
  updateData.tier_expires_at = expires_at ? expires_at : null
  const { error: updateError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  // Insert tier override record
  await supabase.from('admin_tier_overrides').insert({
    user_id: id,
    tier,
    expires_at: expires_at ?? null,
    reason: reason.trim(),
    admin_email: adminEmail,
  })

  const ip = getAdminClientIP(request)
  await logAudit(supabase, {
    user_id: 'admin',
    action: 'admin.tier_change',
    ip_address: ip,
    metadata: { userId: id, oldTier, newTier: tier, reason: reason.trim(), adminEmail },
  })

  return NextResponse.json({ success: true })
}

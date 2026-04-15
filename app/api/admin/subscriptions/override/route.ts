import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'

const VALID_TIERS = ['free', 'starter', 'pro', 'agency']

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { user_id, tier, expires_at, reason } = body

  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }
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

  // Get current tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user_id)
    .single()
  const oldTier = profile?.tier ?? 'free'

  // Update profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ tier, tier_expires_at: expires_at ?? null })
    .eq('id', user_id)
  if (updateError) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  // Insert override record
  await supabase.from('admin_tier_overrides').insert({
    user_id,
    tier,
    expires_at: expires_at ?? null,
    reason: reason.trim(),
    admin_email: adminEmail,
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  await logAudit(supabase, {
    user_id: 'admin',
    action: 'admin.tier_change',
    ip_address: ip,
    metadata: { userId: user_id, oldTier, newTier: tier, reason: reason.trim(), adminEmail },
  })

  // Send notification to the user
  const { createNotification, PLAN_NAMES } = await import('@/lib/notifications')
  const planLabel = PLAN_NAMES[tier] || tier
  if (tier !== 'free') {
    await createNotification(supabase, {
      user_id,
      type: 'subscription_free_grant',
      title: `${planLabel} Plan Granted 🎁`,
      message: `You've been granted the ${planLabel} plan${expires_at ? ` until ${new Date(expires_at).toLocaleDateString()}` : ''}. Enjoy the upgrade!`,
      metadata: { tier, oldTier, reason: reason.trim(), expires_at: expires_at ?? null },
    })
  }

  return NextResponse.json({ success: true })
}

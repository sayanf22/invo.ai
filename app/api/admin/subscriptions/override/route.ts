import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'
import { isValidUUID, getAdminClientIP } from '@/lib/admin-utils'

const VALID_TIERS = ['free', 'starter', 'pro', 'agency']

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { user_id, tier, expires_at, reason } = body

  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }
  if (!isValidUUID(user_id)) {
    return NextResponse.json({ error: 'Invalid user_id format' }, { status: 400 })
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

  // Update profile tier
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ tier, tier_expires_at: expires_at ?? null })
    .eq('id', user_id)
  if (updateError) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  // ── Sync subscriptions table ──────────────────────────────────────────────
  // The usage/stream routes read tier from `subscriptions`, not `profiles`.
  // We must upsert here so the tier takes effect immediately.
  const now = new Date()
  // If no expiry given, grant for 100 years (effectively permanent)
  const periodEnd = expires_at
    ? new Date(expires_at).toISOString()
    : new Date(now.getFullYear() + 100, now.getMonth(), now.getDate()).toISOString()

  if (tier === 'free') {
    // Downgrade to free: cancel any existing subscription
    await supabase
      .from('subscriptions' as any)
      .update({
        plan: 'free',
        status: 'cancelled',
        cancelled_at: now.toISOString(),
        updated_at: now.toISOString(),
        scheduled_downgrade: null,
      })
      .eq('user_id', user_id)
  } else {
    // Upgrade: upsert subscription row so tier is immediately active
    const { data: existingSub } = await supabase
      .from('subscriptions' as any)
      .select('id')
      .eq('user_id', user_id)
      .maybeSingle()

    if (existingSub) {
      await supabase
        .from('subscriptions' as any)
        .update({
          plan: tier,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd,
          cancelled_at: null,
          scheduled_downgrade: null,
          updated_at: now.toISOString(),
        })
        .eq('user_id', user_id)
    } else {
      await supabase
        .from('subscriptions' as any)
        .insert({
          user_id,
          plan: tier,
          status: 'active',
          billing_cycle: 'admin_grant',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd,
          amount_paid: 0,
          currency: 'USD',
        })
    }
  }

  // Insert override record
  await supabase.from('admin_tier_overrides').insert({
    user_id,
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

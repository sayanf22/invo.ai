import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'
import { isValidUUID, getAdminClientIP } from '@/lib/admin-utils'

const VALID_TIERS = ['free', 'starter', 'pro', 'agency'] as const
const MAX_REASON_LENGTH = 500

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role credentials')
  return createClient(url, key, { auth: { persistSession: false } })
}

function parseExpiresAt(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') throw new Error('expires_at must be a string or null')
  const d = new Date(raw)
  if (isNaN(d.getTime())) throw new Error('expires_at is not a valid date')
  if (d <= new Date()) throw new Error('expires_at must be in the future')
  return d.toISOString()
}

export async function POST(request: NextRequest) {
  // 1. Verify admin session
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 2. Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { user_id, tier, expires_at, reason } = body as Record<string, unknown>

  // 3. Validate inputs
  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }
  if (!isValidUUID(user_id)) {
    return NextResponse.json({ error: 'Invalid user_id format' }, { status: 400 })
  }
  if (typeof tier !== 'string' || !(VALID_TIERS as readonly string[]).includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
  }
  if (reason.trim().length > MAX_REASON_LENGTH) {
    return NextResponse.json({ error: `Reason must be ${MAX_REASON_LENGTH} characters or less` }, { status: 400 })
  }

  let parsedExpiresAt: string | null
  try {
    parsedExpiresAt = parseExpiresAt(expires_at)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  // 4. Build service client
  let supabase: ReturnType<typeof getServiceClient>
  try {
    supabase = getServiceClient()
  } catch {
    console.error('[admin/subscriptions/override] Missing SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // 5. Verify user exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, tier')
    .eq('id', user_id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const oldTier = profile.tier ?? 'free'

  // 6. Update profiles
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ tier, tier_expires_at: parsedExpiresAt })
    .eq('id', user_id)

  if (updateError) {
    console.error('[admin/subscriptions/override] profiles update error:', updateError)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // 7. Sync subscriptions — upsert to avoid race conditions
  const now = new Date()
  const periodEnd = parsedExpiresAt
    ?? new Date(now.getFullYear() + 100, now.getMonth(), now.getDate()).toISOString()

  if (tier === 'free') {
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
    const { error: subError } = await supabase
      .from('subscriptions' as any)
      .upsert(
        {
          user_id,
          plan: tier,
          status: 'active',
          billing_cycle: 'admin_grant',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd,
          cancelled_at: null,
          scheduled_downgrade: null,
          updated_at: now.toISOString(),
          amount_paid: 0,
          currency: 'USD',
        },
        { onConflict: 'user_id' }
      )

    if (subError) {
      console.error('[admin/subscriptions/override] subscriptions upsert error:', subError)
    }
  }

  // 8. Audit trail
  await supabase.from('admin_tier_overrides').insert({
    user_id,
    tier,
    expires_at: parsedExpiresAt,
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

  // 9. Notify user (non-fatal)
  try {
    const { createNotification, PLAN_NAMES } = await import('@/lib/notifications')
    const planLabel = (PLAN_NAMES as Record<string, string>)[tier] || tier
    if (tier !== 'free') {
      await createNotification(supabase, {
        user_id,
        type: 'subscription_free_grant',
        title: `${planLabel} Plan Granted 🎁`,
        message: `You've been granted the ${planLabel} plan${parsedExpiresAt ? ` until ${new Date(parsedExpiresAt).toLocaleDateString()}` : ''}. Enjoy the upgrade!`,
        metadata: { tier, oldTier, reason: reason.trim(), expires_at: parsedExpiresAt },
      })
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ success: true, tier, userId: user_id })
}

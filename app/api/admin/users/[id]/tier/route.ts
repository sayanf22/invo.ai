import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'
import { isValidUUID, getAdminClientIP } from '@/lib/admin-utils'

const VALID_TIERS = ['free', 'starter', 'pro', 'agency'] as const
type ValidTier = typeof VALID_TIERS[number]

const MAX_REASON_LENGTH = 500

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role credentials')
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Validate and parse an ISO date string from user input.
 * Returns null if the input is null/undefined (permanent grant).
 * Throws if the date is invalid or in the past.
 */
function parseExpiresAt(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') throw new Error('expires_at must be a string or null')
  const d = new Date(raw)
  if (isNaN(d.getTime())) throw new Error('expires_at is not a valid date')
  if (d <= new Date()) throw new Error('expires_at must be in the future')
  return d.toISOString()
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Verify admin session (JWT + email whitelist)
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  // 2. Validate user ID format
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 3. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { tier, expires_at, reason } = body as Record<string, unknown>

  // Validate tier — whitelist only
  if (typeof tier !== 'string' || !(VALID_TIERS as readonly string[]).includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  // Validate reason — required, string, max length
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
  }
  if (reason.trim().length > MAX_REASON_LENGTH) {
    return NextResponse.json({ error: `Reason must be ${MAX_REASON_LENGTH} characters or less` }, { status: 400 })
  }

  // Validate expires_at — must be a future date or null
  let parsedExpiresAt: string | null
  try {
    parsedExpiresAt = parseExpiresAt(expires_at)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  // 4. Build service client — fail loudly if key is missing
  let supabase: ReturnType<typeof getServiceClient>
  try {
    supabase = getServiceClient()
  } catch {
    console.error('[admin/tier] Missing SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // 5. Verify the target user actually exists (prevents phantom grants)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, tier')
    .eq('id', id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const oldTier = profile.tier ?? 'free'

  // 6. Update profiles table
  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({ tier: tier as ValidTier, tier_expires_at: parsedExpiresAt })
    .eq('id', id)

  if (profileUpdateError) {
    console.error('[admin/tier] profiles update error:', profileUpdateError)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // 7. Sync subscriptions table — use upsert to avoid race conditions
  const now = new Date()
  // If no expiry given, grant for 100 years (effectively permanent)
  const periodEnd = parsedExpiresAt
    ?? new Date(now.getFullYear() + 100, now.getMonth(), now.getDate()).toISOString()

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
      .eq('user_id', id)
  } else {
    // Upsert subscription — handles both new users and existing ones atomically
    const { error: subError } = await supabase
      .from('subscriptions' as any)
      .upsert(
        {
          user_id: id,
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
      console.error('[admin/tier] subscriptions upsert error:', subError)
      // Non-fatal — profiles was already updated, log and continue
    }
  }

  // 8. Insert audit record
  await supabase.from('admin_tier_overrides').insert({
    user_id: id,
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
    metadata: { userId: id, oldTier, newTier: tier, reason: reason.trim(), adminEmail },
  })

  // 9. Notify the user (non-fatal)
  try {
    const { createNotification, PLAN_NAMES } = await import('@/lib/notifications')
    const planLabel = (PLAN_NAMES as Record<string, string>)[tier] || tier
    if (tier !== 'free') {
      await createNotification(supabase, {
        user_id: id,
        type: 'subscription_free_grant',
        title: `${planLabel} Plan Granted 🎁`,
        message: `You've been granted the ${planLabel} plan${parsedExpiresAt ? ` until ${new Date(parsedExpiresAt).toLocaleDateString()}` : ''}. Enjoy the upgrade!`,
        metadata: { tier, oldTier, reason: reason.trim(), expires_at: parsedExpiresAt },
      })
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ success: true, tier, userId: id })
}

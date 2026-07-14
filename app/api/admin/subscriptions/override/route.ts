import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminSession } from "@/lib/admin-auth"
import { logAudit } from "@/lib/audit-log"
import { getAdminClientIP, isValidUUID } from "@/lib/admin-utils"
import { validateBodySize, validateOrigin } from "@/lib/api-auth"

const VALID_TIERS = ["free", "starter", "pro", "agency"] as const
const MAX_REASON_LENGTH = 500

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase service role credentials")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function parseExpiresAt(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== "string") throw new Error("expires_at must be a string or null")
  const value = new Date(raw)
  if (!Number.isFinite(value.getTime())) throw new Error("expires_at is not a valid date")
  if (value.getTime() <= Date.now()) throw new Error("expires_at must be in the future")
  return value.toISOString()
}

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request)
  if (originError) return originError
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const sizeError = validateBodySize(body, 4 * 1024)
  if (sizeError) return sizeError

  const { user_id: userId, tier, expires_at: expiresAt, reason } = body
  if (typeof userId !== "string" || !isValidUUID(userId)) {
    return NextResponse.json({ error: "Invalid user_id" }, { status: 400 })
  }
  if (typeof tier !== "string" || !(VALID_TIERS as readonly string[]).includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 })
  }
  if (typeof reason !== "string" || !reason.trim() || reason.trim().length > MAX_REASON_LENGTH) {
    return NextResponse.json({ error: `Reason is required and must be ${MAX_REASON_LENGTH} characters or less` }, { status: 400 })
  }

  let parsedExpiresAt: string | null
  try { parsedExpiresAt = parseExpiresAt(expiresAt) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid expiry" }, { status: 400 })
  }

  try {
    const supabase = getServiceClient()
    const { data, error } = await (supabase.rpc as any)("apply_admin_tier_override", {
      p_user_id: userId,
      p_tier: tier,
      p_expires_at: parsedExpiresAt,
      p_reason: reason.trim(),
      p_admin_email: adminEmail,
    })
    if (error) throw error
    if (!data?.applied) {
      const status = data?.reason === "user_not_found" ? 404 : 409
      return NextResponse.json({ error: data?.reason || "Tier override was rejected" }, { status })
    }

    await logAudit(supabase as any, {
      user_id: "admin",
      action: "admin.tier_change",
      ip_address: getAdminClientIP(request),
      metadata: { userId, oldTier: data.old_tier, newTier: tier, reason: reason.trim(), adminEmail },
    })

    try {
      const { createNotification, PLAN_NAMES } = await import("@/lib/notifications")
      const label = (PLAN_NAMES as Record<string, string>)[tier] || tier
      if (tier !== "free") await createNotification(supabase as any, {
        user_id: userId,
        type: "subscription_free_grant",
        title: `${label} Plan Granted 🎁`,
        message: `You've been granted the ${label} plan${parsedExpiresAt ? ` until ${new Date(parsedExpiresAt).toLocaleDateString()}` : ""}.`,
        metadata: { tier, oldTier: data.old_tier, reason: reason.trim(), expires_at: parsedExpiresAt },
      })
    } catch { /* notification does not control entitlement */ }

    return NextResponse.json({ success: true, tier, userId })
  } catch (error) {
    console.error("[admin/subscriptions/override] atomic override failed:", error)
    return NextResponse.json({ error: "Tier override failed" }, { status: 500 })
  }
}

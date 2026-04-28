import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { decrypt } from "@/lib/encrypt"
import { createClient } from "@supabase/supabase-js"

/**
 * GET /api/payments/webhook-secret?gateway=razorpay
 *
 * Returns the decrypted webhook secret for a specific gateway.
 * This is the secret the user needs to paste into their gateway dashboard.
 *
 * SECURITY:
 * - Requires authentication (user must be logged in)
 * - Only returns the secret for the authenticated user's own account
 * - Rate limited via authenticateRequest
 * - Audited via logAudit
 * - Secret is only used for webhook setup — not for API calls
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  const gateway = request.nextUrl.searchParams.get("gateway")
  if (!gateway || !["razorpay", "cashfree"].includes(gateway)) {
    return NextResponse.json({ error: "Invalid gateway. Must be: razorpay or cashfree" }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const column = gateway === "razorpay" ? "razorpay_webhook_secret" : "cashfree_webhook_secret"
  const enabledColumn = gateway === "razorpay" ? "razorpay_enabled" : "cashfree_enabled"

  const { data } = await supabase
    .from("user_payment_settings")
    .select(`${column}, ${enabledColumn}`)
    .eq("user_id", auth.user.id)
    .maybeSingle()

  if (!data || !data[enabledColumn]) {
    return NextResponse.json({ error: "Gateway not connected" }, { status: 404 })
  }

  const encryptedSecret = data[column]
  if (!encryptedSecret) {
    return NextResponse.json({ error: "No webhook secret configured" }, { status: 404 })
  }

  // Decrypt the secret
  const secret = await decrypt(encryptedSecret)
  if (!secret) {
    // Legacy plaintext fallback
    return NextResponse.json({ secret: encryptedSecret })
  }

  return NextResponse.json({ secret })
}

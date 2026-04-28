import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

/**
 * GET /api/payments/offline-methods
 * Returns the user's saved offline payment methods from their business profile.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  const { data } = await auth.supabase
    .from("businesses")
    .select("payment_methods")
    .eq("user_id", auth.user.id)
    .maybeSingle()

  return NextResponse.json({ methods: data?.payment_methods ?? null })
}

/**
 * POST /api/payments/offline-methods
 * Saves the user's offline payment methods to their business profile.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  let body: { methods: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!Array.isArray(body.methods)) {
    return NextResponse.json({ error: "methods must be an array" }, { status: 400 })
  }

  // Validate each method has id, label, enabled
  const methods = body.methods.filter((m: any) =>
    m && typeof m.id === "string" && typeof m.label === "string" && typeof m.enabled === "boolean"
  ).map((m: any) => ({
    id: String(m.id).slice(0, 50),
    label: String(m.label).slice(0, 100),
    details: typeof m.details === "string" ? m.details.slice(0, 500) : "",
    enabled: Boolean(m.enabled),
  }))

  const { error } = await auth.supabase
    .from("businesses")
    .update({ payment_methods: methods as any, updated_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)

  if (error) {
    console.error("Save offline methods error:", error)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

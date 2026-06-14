/**
 * POST /api/profile/progress
 *
 * Server-authoritative writes for the onboarding/plan funnel flags.
 *
 * SECURITY (fixes F-05): `plan_selected` and `onboarding_complete` are
 * protected at the database level (a trigger reverts client writes to these
 * columns). They may only be set by the service role. This endpoint is the
 * single trusted path that flips them — the user is authenticated via their
 * own session, and we only ever set the flags to `true` (a user can never
 * un-set another user's state, and cannot pass arbitrary values).
 *
 * Body: { planSelected?: true, onboardingComplete?: true }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createClient } from "@supabase/supabase-js"

function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  let body: { planSelected?: unknown; onboardingComplete?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Only allow flipping these flags to true (the legitimate forward transitions).
  const update: Record<string, boolean> = {}
  if (body.planSelected === true) update.plan_selected = true
  if (body.onboardingComplete === true) update.onboarding_complete = true

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const svc = getServiceRoleClient()
  const { error } = await svc
    .from("profiles")
    .update(update as never)
    .eq("id", auth.user.id)

  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated: Object.keys(update) })
}

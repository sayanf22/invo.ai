/**
 * POST /api/onboarding/autosave  (public, token-keyed)
 *
 * Persists the client's partial answers as they type so progress survives a
 * browser close. No auth — validates the token itself via a service-role client.
 * Writes only to draft_answers; never touches the immutable `answers`.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateBodySize } from "@/lib/api-auth"
import { ONBOARD_TOKEN_REGEX, sanitizeOnboardingAnswers, type OnboardingField } from "@/lib/onboarding-fields"

export const dynamic = "force-dynamic"

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// In-memory throttle for the autosave endpoint (max 30 req/min per token).
const autosaveThrottle = new Map<string, { ts: number; count: number }>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const sizeError = validateBodySize(body, 200 * 1024)
    if (sizeError) return sizeError

    const { token, answers } = body as { token?: string; answers?: Record<string, unknown> }
    if (!token || !ONBOARD_TOKEN_REGEX.test(token)) {
      return NextResponse.json({ error: "Invalid form link." }, { status: 404 })
    }

    // Lightweight abuse gate: cap autosave to 30 req/min per token (in-memory).
    // Not persistent — acceptable because the autosave only writes to draft_answers
    // (non-sensitive, no cost impact). This prevents a script from hammering the DB.
    const now = Date.now()
    const entry = autosaveThrottle.get(token)
    if (entry && now - entry.ts < 60_000 && entry.count >= 30) {
      return NextResponse.json({ error: "Too many saves. Please wait." }, { status: 429 })
    }
    if (!entry || now - entry.ts >= 60_000) {
      autosaveThrottle.set(token, { ts: now, count: 1 })
    } else {
      entry.count++
    }

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "Invalid answers." }, { status: 400 })
    }

    const admin = serviceClient()
    const { data: form, error } = await admin
      .from("onboarding_forms")
      .select("id, status, fields, expires_at")
      .eq("token", token)
      .single()

    if (error || !form) return NextResponse.json({ error: "Invalid form link." }, { status: 404 })
    if (form.status === "submitted") return NextResponse.json({ error: "This form has already been submitted." }, { status: 409 })
    if (form.expires_at && new Date(form.expires_at) < new Date()) {
      return NextResponse.json({ error: "This form link has expired." }, { status: 410 })
    }

    const clean = sanitizeOnboardingAnswers((form.fields as OnboardingField[]) || [], answers)

    await admin.from("onboarding_forms").update({
      draft_answers: clean,
      status: form.status === "pending" ? "in_progress" : form.status,
    }).eq("id", form.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Onboarding autosave error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not save progress." }, { status: 500 })
  }
}

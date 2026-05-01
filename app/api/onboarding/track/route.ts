/**
 * Onboarding Progress Tracking API
 * POST /api/onboarding/track
 *
 * Records onboarding phase transitions and field completion progress.
 * This is fire-and-forget tracking — it NEVER returns an error to the client
 * to avoid blocking the user's onboarding flow.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 13.1, 13.2, 13.3
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { ONBOARDING_PHASES } from "@/lib/onboarding-utils"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/** Valid phases for this endpoint (includes 'completed' unlike support submit). */
const VALID_PHASES = [...ONBOARDING_PHASES, "completed"] as const
type TrackingPhase = (typeof VALID_PHASES)[number]

/** Maps each phase to its corresponding timestamp column in onboarding_progress. */
const PHASE_TIMESTAMP_MAP: Record<TrackingPhase, string> = {
  upload: "upload_started_at",
  chat: "chat_started_at",
  logo: "logo_started_at",
  payments: "payments_started_at",
  completed: "completed_at",
}

interface TrackRequest {
  phase: string
  fields_completed?: number
  used_extraction?: boolean
}

export async function POST(request: NextRequest) {
  // Always return success — tracking must never block onboarding
  const successResponse = NextResponse.json({ success: true })

  try {
    // Authenticate the user
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    let body: TrackRequest
    try {
      body = await request.json()
    } catch {
      // Invalid JSON — silently succeed
      return successResponse
    }

    // Validate phase (required, must be one of the valid phases)
    if (
      !body.phase ||
      typeof body.phase !== "string" ||
      !(VALID_PHASES as readonly string[]).includes(body.phase)
    ) {
      // Invalid phase — silently succeed
      return successResponse
    }

    const phase = body.phase as TrackingPhase

    // Validate optional fields_completed (integer 0–12)
    if (body.fields_completed !== undefined && body.fields_completed !== null) {
      if (
        typeof body.fields_completed !== "number" ||
        !Number.isInteger(body.fields_completed) ||
        body.fields_completed < 0 ||
        body.fields_completed > 12
      ) {
        // Invalid fields_completed — silently succeed
        return successResponse
      }
    }

    // Validate optional used_extraction (boolean)
    if (body.used_extraction !== undefined && body.used_extraction !== null) {
      if (typeof body.used_extraction !== "boolean") {
        // Invalid used_extraction — silently succeed
        return successResponse
      }
    }

    // Use service role client for upsert (bypasses RLS)
    const serviceClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date().toISOString()

    // Build the upsert object dynamically
    const upsertData: Record<string, unknown> = {
      user_id: auth.user.id,
      current_phase: phase,
      updated_at: now,
    }

    // Set the corresponding phase timestamp
    const timestampColumn = PHASE_TIMESTAMP_MAP[phase]
    upsertData[timestampColumn] = now

    // Include optional fields if provided
    if (body.fields_completed !== undefined && body.fields_completed !== null) {
      upsertData.fields_completed = body.fields_completed
    }

    if (body.used_extraction !== undefined && body.used_extraction !== null) {
      upsertData.used_extraction = body.used_extraction
    }

    // Upsert onboarding_progress record
    const { error: upsertError } = await serviceClient
      .from("onboarding_progress")
      .upsert(upsertData as any, { onConflict: "user_id" })

    if (upsertError) {
      console.error("Onboarding tracking upsert error:", upsertError.message)
      // Silently succeed — don't block onboarding
      return successResponse
    }

    // Update profiles.last_active_at
    const { error: profileError } = await serviceClient
      .from("profiles")
      .update({ last_active_at: now })
      .eq("id", auth.user.id)

    if (profileError) {
      console.error("Profile last_active_at update error:", profileError.message)
      // Silently succeed — don't block onboarding
    }

    return successResponse
  } catch (error) {
    console.error("Unexpected error in onboarding tracking:", error)
    // Always return success — tracking must never block onboarding
    return successResponse
  }
}

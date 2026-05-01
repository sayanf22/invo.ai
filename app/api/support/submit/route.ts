/**
 * Support Message Submission API
 * POST /api/support/submit
 *
 * Allows authenticated users to submit support messages during onboarding.
 * Messages are stored in `support_messages` with optional onboarding phase context.
 *
 * Requirements: 2.3, 2.6, 12.1, 12.2, 12.3
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize } from "@/lib/api-auth"
import { validateSupportMessage, ONBOARDING_PHASES } from "@/lib/onboarding-utils"
import { sanitizeText } from "@/lib/sanitize"
import type { Json } from "@/lib/database.types"

interface SupportSubmitRequest {
  message: string
  onboarding_phase?: string
  metadata?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const body: SupportSubmitRequest = await request.json()

    // Validate body size (50KB max)
    const sizeError = validateBodySize(body, 50 * 1024)
    if (sizeError) return sizeError

    // Validate message field exists and is a string
    if (!body.message || typeof body.message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    // Sanitize the message
    const sanitizedMessage = sanitizeText(body.message)

    // Validate message length (3–2000 trimmed chars)
    if (!validateSupportMessage(sanitizedMessage)) {
      return NextResponse.json(
        { error: "Message must be between 3 and 2000 characters" },
        { status: 400 }
      )
    }

    // Validate optional onboarding_phase
    let onboardingPhase: string | null = null
    if (body.onboarding_phase !== undefined && body.onboarding_phase !== null) {
      if (
        typeof body.onboarding_phase !== "string" ||
        !(ONBOARDING_PHASES as readonly string[]).includes(body.onboarding_phase)
      ) {
        return NextResponse.json(
          { error: "Invalid onboarding phase. Must be one of: upload, chat, logo, payments" },
          { status: 400 }
        )
      }
      onboardingPhase = body.onboarding_phase
    }

    // Validate optional metadata
    let metadata: Json | null = null
    if (body.metadata !== undefined && body.metadata !== null) {
      if (typeof body.metadata !== "object" || Array.isArray(body.metadata)) {
        return NextResponse.json(
          { error: "Metadata must be an object" },
          { status: 400 }
        )
      }
      metadata = body.metadata as Json
    }

    // Insert into support_messages
    const { error: insertError } = await auth.supabase
      .from("support_messages")
      .insert({
        user_id: auth.user.id,
        message: sanitizedMessage,
        status: "unread",
        onboarding_phase: onboardingPhase,
        metadata: metadata ?? undefined,
      })

    if (insertError) {
      console.error("Support message insert error:", insertError.message)
      return NextResponse.json(
        { error: "Failed to submit support message" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Unexpected error in support submission:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

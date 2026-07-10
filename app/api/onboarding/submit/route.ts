/**
 * POST /api/onboarding/submit  (public, token-keyed)
 *
 * Finalizes the client's answers: writes the immutable `answers`, marks the
 * form submitted, fills the answers back into the document session so the owner
 * can export a completed PDF, notifies the owner (in-app + email), and does a
 * best-effort upsert into the owner's client book. No auth — validates the
 * token via a service-role client.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateBodySize, getClientIP } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"
import {
  ONBOARD_TOKEN_REGEX,
  sanitizeOnboardingAnswers,
  applyAnswersToContext,
  type OnboardingField,
  type FileRef,
} from "@/lib/onboarding-fields"

export const dynamic = "force-dynamic"

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Submit abuse guard: max 5 attempts/min per token (in-memory).
const submitThrottle = new Map<string, { ts: number; count: number }>()

function isEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const sizeError = validateBodySize(body, 200 * 1024)
    if (sizeError) return sizeError

    const { token, answers, clientName, clientEmail } = body as {
      token?: string
      answers?: Record<string, unknown>
      clientName?: string
      clientEmail?: string
    }

    if (!token || !ONBOARD_TOKEN_REGEX.test(token)) {
      return NextResponse.json({ error: "Invalid form link." }, { status: 404 })
    }

    // Abuse guard: cap submit to 5 attempts/min per token.
    const now = Date.now()
    const entry = submitThrottle.get(token)
    if (entry && now - entry.ts < 60_000 && entry.count >= 5) {
      return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 })
    }
    if (!entry || now - entry.ts >= 60_000) {
      submitThrottle.set(token, { ts: now, count: 1 })
    } else {
      entry.count++
    }

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "Invalid answers." }, { status: 400 })
    }

    const admin = serviceClient()
    const { data: form, error } = await admin
      .from("onboarding_forms")
      .select("id, user_id, session_id, status, fields, title, client_name, client_email, expires_at")
      .eq("token", token)
      .single()

    if (error || !form) return NextResponse.json({ error: "Invalid form link." }, { status: 404 })
    if (form.status === "submitted") {
      return NextResponse.json({ error: "This form has already been submitted." }, { status: 409 })
    }
    if (form.status === "expired") {
      return NextResponse.json({ error: "This form link is no longer active." }, { status: 410 })
    }
    if (form.expires_at && new Date(form.expires_at) < new Date()) {
      return NextResponse.json({ error: "This form link has expired." }, { status: 410 })
    }

    const fields = (form.fields as OnboardingField[]) || []
    const clean = sanitizeOnboardingAnswers(fields, answers)

    // Required-field validation (server-side enforcement).
    for (const field of fields) {
      if (!field.required) continue
      const val = clean[field.id]
      const empty = field.type === "file"
        ? !Array.isArray(val) || val.length === 0
        : typeof val !== "string" || val.trim().length === 0
      if (empty) {
        return NextResponse.json({ error: `Please answer: ${field.label}` }, { status: 400 })
      }
    }

    const submittedAt = new Date().toISOString()
    const resolvedName = (typeof clientName === "string" && clientName.trim())
      ? sanitizeText(clientName).slice(0, 200)
      : form.client_name
    const resolvedEmail = isEmail(clientEmail) ? clientEmail : form.client_email

    // Persist immutable answers.
    const { error: updateErr } = await admin.from("onboarding_forms").update({
      answers: clean,
      status: "submitted",
      submitted_at: submittedAt,
      client_name: resolvedName || null,
      client_email: resolvedEmail || null,
      ip_address: getClientIP(request),
      user_agent: (request.headers.get("user-agent") || "").slice(0, 500),
    }).eq("id", form.id)

    if (updateErr) {
      console.error("[onboarding] submit update failed:", updateErr.message)
      return NextResponse.json({ error: "Could not submit the form. Please try again." }, { status: 500 })
    }

    // Collect uploaded file names for the fill-back note.
    const fileNames: string[] = []
    for (const f of fields) {
      if (f.type !== "file") continue
      const refs = clean[f.id] as FileRef[] | undefined
      if (Array.isArray(refs)) for (const r of refs) if (r.fileName) fileNames.push(r.fileName)
    }

    // Fill answers back into the document session so the owner's PDF is complete.
    if (form.session_id) {
      const { data: session } = await admin
        .from("document_sessions")
        .select("context")
        .eq("id", form.session_id)
        .single()
      if (session) {
        const nextContext = applyAnswersToContext(
          (session.context ?? {}) as Record<string, unknown>,
          fields,
          clean,
          fileNames,
        )
        await admin.from("document_sessions")
          .update({ context: nextContext, updated_at: submittedAt })
          .eq("id", form.session_id)
          .then(() => {}, () => {})
      }
    }

    // Owner notification (in-app).
    const formTitle = form.title || "Client Onboarding"
    await admin.from("notifications").insert({
      user_id: form.user_id,
      type: "onboarding_submitted",
      title: "Onboarding form completed",
      message: `${resolvedName || "Your client"} completed "${formTitle}".`,
      read: false,
      metadata: {
        onboarding_form_id: form.id,
        session_id: form.session_id,
        client_name: resolvedName,
        client_email: resolvedEmail,
      },
    }).then(() => {}, () => {})

    // Best-effort client-book upsert (never blocks submission).
    if (resolvedName || resolvedEmail) {
      try {
        const { data: existing } = await admin
          .from("clients")
          .select("id")
          .eq("user_id", form.user_id)
          .eq("email", resolvedEmail || "")
          .limit(1)
        if (!existing || existing.length === 0) {
          await admin.from("clients").insert({
            user_id: form.user_id,
            name: resolvedName || resolvedEmail || "Client",
            email: resolvedEmail || null,
          }).then(() => {}, () => {})
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Onboarding submit error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not submit the form. Please try again." }, { status: 500 })
  }
}

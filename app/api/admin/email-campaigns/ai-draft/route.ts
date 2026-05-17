/**
 * POST /api/admin/email-campaigns/ai-draft
 *
 * Generates a personalized email subject and body using DeepSeek,
 * based on the target user's actual usage data and KPIs from Supabase.
 *
 * The AI receives:
 *   - User's name, business type, signup date
 *   - Days since last activity
 *   - Number of documents generated
 *   - Onboarding completion status
 *   - Current tier
 *   - Admin's intent/context (optional prompt)
 *
 * Returns: { subject: string, message: string }
 *
 * Auth: verifyAdminSession() required.
 * Rate: DeepSeek fast model — sub-3s latency.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface AiDraftBody {
  userId: string
  intent?: string  // optional admin context, e.g. "re-engagement after 2 weeks inactive"
  tone?: "friendly" | "professional" | "urgent"
}

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: AiDraftBody
  try { body = await request.json() }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { userId, intent, tone = "friendly" } = body

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }
  if (intent && intent.length > 500) {
    return NextResponse.json({ error: "intent too long" }, { status: 400 })
  }

  const supabase = getServiceClient()

  // ── Fetch all the user context we need ──────────────────────────────────────

  const [
    { data: profiles },
    { data: docRows },
    { data: businesses },
    { data: sendLogs },
  ] = await Promise.all([
    supabase.from("profiles")
      .select("email, full_name, onboarding_complete, last_active_at, created_at, tier")
      .eq("id", userId).limit(1),
    supabase.from("document_sessions")
      .select("id, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("businesses")
      .select("business_type, name, country").eq("user_id", userId).limit(1),
    supabase.from("user_email_send_log")
      .select("email_type, sent_at").eq("user_id", userId),
  ])

  const profile = profiles?.[0]
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const business = businesses?.[0]
  const docs = docRows ?? []
  const now = new Date()

  // Compute KPIs
  const signedUp = new Date(profile.created_at)
  const lastActive = profile.last_active_at ? new Date(profile.last_active_at) : signedUp
  const daysSinceActive = Math.floor((now.getTime() - lastActive.getTime()) / 86400000)
  const daysSinceSignup = Math.floor((now.getTime() - signedUp.getTime()) / 86400000)
  const docsCount = docs.length
  const lastDocDate = docs[0]?.created_at
    ? new Date(docs[0].created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null

  const sentEmailTypes = (sendLogs ?? []).map((l: any) => l.email_type)

  // Build the user context object for the AI
  const userContext = {
    firstName: profile.full_name?.split(" ")[0] ?? "there",
    businessName: business?.name ?? null,
    businessType: business?.business_type ?? null,
    country: business?.country ?? null,
    tier: profile.tier ?? "free",
    onboardingComplete: profile.onboarding_complete ?? false,
    daysSinceSignup,
    daysSinceActive,
    docsGenerated: docsCount,
    lastDocDate,
    emailsAlreadySent: sentEmailTypes,
  }

  // ── Build system prompt ───────────────────────────────────────────────────────

  const systemPrompt = `You are a customer success writer for Clorefy, an AI-powered platform that generates invoices, contracts, quotations, and proposals for businesses.

You write concise, personal, high-converting emails from the Clorefy team to individual users. These are 1:1 admin emails — not newsletters or bulk campaigns.

Rules:
- Write like a real human, not a marketing template
- Be specific — reference the user's actual usage data provided
- Never sound spammy or pushy
- Keep subject line under 60 characters
- Keep the email body under 180 words
- Never use all-caps, excessive exclamation marks, or emojis in subject
- Always end with a soft CTA — link to https://clorefy.com
- Support email: support@clorefy.com
- Tone: ${tone}

Respond ONLY with a JSON object: { "subject": "...", "message": "..." }
The message should be plain text (no HTML), with natural line breaks.`

  // Build user data summary for the prompt
  const dataLines = [
    `Name: ${userContext.firstName}`,
    userContext.businessName ? `Business: ${userContext.businessName}` : null,
    userContext.businessType ? `Business type: ${userContext.businessType}` : null,
    userContext.country ? `Country: ${userContext.country}` : null,
    `Tier: ${userContext.tier}`,
    `Onboarding: ${userContext.onboardingComplete ? "completed" : "NOT completed"}`,
    `Signed up: ${daysSinceSignup} days ago`,
    `Last active: ${daysSinceActive} days ago`,
    `Documents generated: ${docsCount}`,
    lastDocDate ? `Last document: ${lastDocDate}` : null,
    sentEmailTypes.length > 0 ? `Already sent: ${sentEmailTypes.join(", ")}` : "No previous lifecycle emails",
  ].filter(Boolean).join("\n")

  const userPrompt = [
    `USER DATA:\n${dataLines}`,
    intent ? `\nADMIN INTENT: ${intent}` : "",
    "\nWrite a direct, personalized email for this user. Reference their specific data naturally.",
  ].join("\n")

  // ── Call DeepSeek ─────────────────────────────────────────────────────────────

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 })
  }

  let aiResponse: { subject: string; message: string }

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.7,
        max_tokens: 500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[ai-draft] DeepSeek error:", err.slice(0, 200))
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 })
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? ""

    // Parse JSON from response — handle markdown code fences
    let parsed = content.trim()
    if (parsed.startsWith("```")) {
      parsed = parsed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim()
    }

    aiResponse = JSON.parse(parsed)

    if (!aiResponse.subject || !aiResponse.message) {
      throw new Error("Missing subject or message in AI response")
    }

    // Sanitize — truncate to safe lengths
    aiResponse.subject = String(aiResponse.subject).slice(0, 200)
    aiResponse.message = String(aiResponse.message).slice(0, 4000)

  } catch (err) {
    console.error("[ai-draft] parse/fetch error:", err)
    return NextResponse.json({ error: "Failed to generate email content" }, { status: 500 })
  }

  return NextResponse.json({
    subject: aiResponse.subject,
    message: aiResponse.message,
    // Return user context so the frontend can display it
    userContext: {
      name: profile.full_name,
      email: profile.email,
      daysSinceActive,
      docsGenerated: docsCount,
      tier: profile.tier,
      onboardingComplete: profile.onboarding_complete,
    },
  })
}

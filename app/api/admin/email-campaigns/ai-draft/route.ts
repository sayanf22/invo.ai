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
import { computeFunnelStage } from "@/lib/funnel-stage"

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
    { data: pastEmails },
    { data: progressRows },
  ] = await Promise.all([
    supabase.from("profiles")
      .select("email, full_name, onboarding_complete, plan_selected, last_active_at, created_at, tier, last_login_location, last_login_at")
      .eq("id", userId).limit(1),
    supabase.from("document_sessions")
      .select("id, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("businesses")
      .select("business_type, name, country").eq("user_id", userId).limit(1),
    supabase.from("user_email_send_log")
      .select("email_type, sent_at").eq("user_id", userId),
    // Previously-sent subject lines (manual admin emails) — so we never repeat one
    supabase.from("audit_logs")
      .select("metadata, created_at").eq("user_id", userId).eq("action", "admin.direct_email")
      .order("created_at", { ascending: false }).limit(15),
    // Onboarding progress — tells us exactly which phase they stalled at
    supabase.from("onboarding_progress")
      .select("current_phase, completed_at").eq("user_id", userId).limit(1),
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

  // Work out exactly where this user is in the journey / where they got stuck
  const funnel = computeFunnelStage({
    createdAt: profile.created_at,
    lastActiveAt: profile.last_active_at,
    planSelected: profile.plan_selected ?? false,
    onboardingComplete: profile.onboarding_complete ?? false,
    onboardingPhase: progressRows?.[0]?.current_phase ?? null,
    docsCount,
  })

  // Collect subjects already used for this user so the AI never repeats one
  const AUTO_SUBJECTS: Record<string, string> = {
    dropoff_1: "Your first doc is 1 click away ✨",
    dropoff_2: "One last nudge 👋",
    inactive_1: "Miss us yet? 👀",
    inactive_2: "Okay, last one 🙈",
  }
  const previousSubjects = Array.from(new Set([
    ...sentEmailTypes.map((t: string) => AUTO_SUBJECTS[t]).filter(Boolean),
    ...(pastEmails ?? [])
      .map((e: any) => (e.metadata && typeof e.metadata.subject === "string" ? e.metadata.subject : null))
      .filter(Boolean),
  ])) as string[]

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

THE SUBJECT LINE IS THE MOST IMPORTANT PART. Rules for the subject:
- Make it UNIQUE and fresh every single time — never reuse a phrasing, structure, or angle from the "ALREADY-USED SUBJECTS" list provided. If that list is given, your subject must be clearly different from all of them.
- Vary the angle each time: a curiosity gap, a question, a specific observation about their usage, a benefit, a gentle nudge, or a milestone. Rotate styles — do not default to the same pattern.
- Tie it to the user's ACTUAL activity (docs generated, days inactive, onboarding status, business type). Specific beats generic.
- Keep it SHORT — ideally 3 to 7 words, always under 50 characters so it shows fully on mobile.
- Playful and human, but credible. Clorefy handles real invoices and legal contracts, so never sound gimmicky, clickbaity, or like a sale. Curiosity, warmth, and wit — yes. Hype, false urgency, ALL-CAPS — no.
- Avoid tired clichés: "We miss you", "Quick question", "Just checking in", "Don't miss out".
- Emoji: at most ONE, only when tone is "friendly", and only if it genuinely fits. Never more than one. None for "professional" or "urgent".

Tone-specific calibration:
- friendly → warm, light, a little witty; one tasteful emoji allowed
- professional → clean, confident, benefit-led; no emoji
- urgent → direct and time-aware but never panicky or hypey; no emoji

Rules for the body (this is a real message from a real team — make it intelligent, not generic):
- Length: 60–110 words. Tight and respectful of their time. No filler, no fluff, no marketing padding.
- OPEN with their REAL situation, stated as a FACT from the data — e.g. "You finished setting up your account but haven't created your first document yet." Never open with a guess.
- ABSOLUTELY NO SPECULATION about their feelings, mood, or reasons. These phrasings are BANNED: "Maybe you're...", "Perhaps you...", "I imagine you...", "You might be...", "If you're feeling...", "Not sure if...", "We noticed you might...", "Maybe you're unsure...". If you don't know why they paused, DO NOT invent a reason — instead give a concrete helpful next step OR ask one genuine question.
- Ask AT MOST ONE question, and only if it's genuinely useful and specific (e.g. "What's the first document you need — an invoice or a contract?"). Never stack rhetorical or hypothetical questions. Do not guess what's holding them back.
- Give exactly ONE clear, concrete next step tied to their actual stage, linking to https://clorefy.com. Be specific about the payoff (e.g. "create your first invoice in about a minute").
- Sound like a knowledgeable human, not a template. No hype, no guilt-tripping, no "we'd love to", no fake urgency.
- NEVER invent a blocker the data doesn't show (no "password issues", "login trouble", "technical errors").
- For help/support, tell them to email support@clorefy.com. NEVER write "reply to this email", "just reply", or "respond to this message". When offering help, keep it natural — "if you hit any issues or have questions". Do NOT offer a "walkthrough", "demo", "call", "tour", or "onboarding session" — Clorefy is self-serve.
- Sign off as "The Clorefy Team" — NEVER a placeholder like "[Your name]" or "[Name]".
- Do NOT include a greeting line with the recipient's name (the template adds "Hey {firstName}," automatically) — start directly with the message body.
- Tone: ${tone}

Respond ONLY with a JSON object: { "subject": "...", "message": "..." }
The message should be plain text (no HTML), with natural line breaks.`

  // Build user data summary for the prompt
  const dataLines = [
    `Name: ${userContext.firstName}`,
    userContext.businessName ? `Business: ${userContext.businessName}` : null,
    userContext.businessType ? `Business type: ${userContext.businessType}` : null,
    userContext.country ? `Country: ${userContext.country}` : null,
    profile.last_login_location ? `Last login location: ${profile.last_login_location}` : null,
    `Tier: ${userContext.tier}`,
    `Onboarding: ${userContext.onboardingComplete ? "completed" : "NOT completed"}`,
    `CURRENT STAGE: ${funnel.detail}`,
    `Signed up: ${daysSinceSignup} days ago`,
    `Last active: ${daysSinceActive} days ago`,
    `Documents generated: ${docsCount}`,
    lastDocDate ? `Last document: ${lastDocDate}` : null,
    sentEmailTypes.length > 0 ? `Already sent: ${sentEmailTypes.join(", ")}` : "No previous lifecycle emails",
  ].filter(Boolean).join("\n")

  const userPrompt = [
    `USER DATA:\n${dataLines}`,
    previousSubjects.length > 0
      ? `\nALREADY-USED SUBJECTS (do NOT repeat or echo any of these — make something clearly different):\n${previousSubjects.map(s => `- ${s}`).join("\n")}`
      : "",
    intent ? `\nADMIN INTENT: ${intent}` : "",
    "\nWrite a direct, genuinely personalized email grounded in this user's REAL data. State facts, never speculate about their feelings or reasons. One concrete next step. The subject must be unique, short, and tied to their actual activity.",
  ].filter(Boolean).join("\n")

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
        temperature: 0.8,
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
      stage: funnel.label,
      stageDetail: funnel.detail,
      lastLoginLocation: profile.last_login_location ?? null,
    },
  })
}

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"

/**
 * POST /api/ai/action-intent
 *
 * Lightweight, dynamic intent classifier for a message sent about an EXISTING
 * document. Instead of brittle keyword matching, it asks the model to decide
 * what the user actually wants so phrasings like "create a link to send",
 * "send via link", or "actually just email it" are understood by meaning.
 *
 * Returns one of a small, fixed action set:
 *   - "email"    → deliver the document to the client by email
 *   - "link"     → create/get a shareable link (or the onboarding fill link)
 *   - "whatsapp" → share via WhatsApp
 *   - "send"     → wants to send/deliver but did not name a channel
 *   - "none"     → not a delivery request (editing, a question, or unrelated)
 *
 * The caller only invokes this when the message plausibly relates to delivery,
 * and falls back to keyword heuristics if this route is unavailable — so pure
 * edits and questions never pay for a classification call.
 */

const VALID_ACTIONS = ["email", "link", "whatsapp", "send", "none"] as const
type Action = (typeof VALID_ACTIONS)[number]

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    let body: { message?: unknown; documentType?: unknown; status?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const sizeError = validateBodySize(body, 8 * 1024)
    if (sizeError) return sizeError

    const message = sanitizeText(typeof body.message === "string" ? body.message : "").slice(0, 2000)
    if (!message) {
      return NextResponse.json({ action: "none" as Action })
    }
    const documentType = sanitizeText(typeof body.documentType === "string" ? body.documentType : "document").slice(0, 40)
    const status = sanitizeText(typeof body.status === "string" ? body.status : "").slice(0, 30)

    const { getSecret } = await import("@/lib/secrets")
    const apiKey = await getSecret("DEEPSEEK_API_KEY")
    if (!apiKey) {
      // No AI available — let the caller fall back to its keyword heuristic.
      return NextResponse.json({ action: "none" as Action, fallback: true })
    }

    const systemPrompt = `You classify what a user wants to do with an existing ${documentType}${status ? ` (current status: ${status})` : ""}.

Respond with STRICT JSON only: {"action":"<value>"}. No prose.

Allowed values:
- "email": the user wants to send/deliver/resend the document to their client by email.
- "link": the user wants to create, get, copy, or send a shareable link (e.g. "create a link to send", "send via link", "get me the link", "share the url").
- "whatsapp": the user wants to share it via WhatsApp.
- "send": the user wants to send/deliver it but did NOT name a channel (e.g. "send it", "send to the client", "deliver it").
- "none": anything else — editing or changing the document's content, asking a question, general chat, or a workflow mention that is not a request to deliver this document now (e.g. "this will be sent for approval").

Rules:
- Judge by MEANING, not keywords. A message can contain the word "send" and still be "none" (e.g. "add a note that says send payment on time").
- If the user is changing/adding/removing content, return "none".
- If the user is asking a question, return "none".
- Choose exactly one value.`

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 20,
        temperature: 0,
        stream: false,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ action: "none" as Action, fallback: true })
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content?.trim() || ""
    let action: Action = "none"
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed?.action === "string" && (VALID_ACTIONS as readonly string[]).includes(parsed.action)) {
        action = parsed.action as Action
      }
    } catch {
      // Non-JSON — try to recover a bare value, else default to none.
      const found = VALID_ACTIONS.find(a => raw.toLowerCase().includes(`"${a}"`) || raw.toLowerCase() === a)
      if (found) action = found
    }

    return NextResponse.json({ action })
  } catch (error) {
    console.error("action-intent error:", error instanceof Error ? error.message : error)
    // Never hard-fail the chat — the caller falls back to keyword heuristics.
    return NextResponse.json({ action: "none" as Action, fallback: true })
  }
}

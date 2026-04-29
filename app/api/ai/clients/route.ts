import { NextRequest } from "next/server"
import { authenticateRequest, sanitizeError, validateOrigin, validateBodySize } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"
import { clientSchema } from "@/lib/invoice-types"

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

interface AIClientExtractionResult {
  action: "create" | "update" | "clarify"
  clientData?: {
    name?: string
    email?: string
    phone?: string
    address?: string
    tax_id?: string
    notes?: string
  }
  targetClientName?: string
  clarifyingQuestion?: string
  message: string
}

const SYSTEM_PROMPT = `You are a client management assistant. Extract client information from the user's message and respond with JSON.

Response format:
{
  "action": "create" | "update" | "clarify",
  "clientData": { "name": "...", "email": "...", "phone": "...", "address": "...", "tax_id": "...", "notes": "..." },
  "targetClientName": "name of client to update (for update action)",
  "clarifyingQuestion": "question to ask (for clarify action)",
  "message": "friendly confirmation message to show the user"
}

Rules:
- Use "create" when user wants to add a new client
- Use "update" when user wants to modify an existing client (include targetClientName)
- Use "clarify" when you need more information (include clarifyingQuestion)
- Always include a friendly "message" field
- For clientData, only include fields that were mentioned
- name is required for create action
- Keep all field values concise and realistic`

function sseStream(message: string): ReadableStream {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: message })}\n\n`))
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "complete" })}\n\n`))
      controller.close()
    },
  })
}

/** Sanitize and validate AI-extracted client data using the same Zod schema */
function sanitizeAIClientData(raw: AIClientExtractionResult["clientData"]): Record<string, string | null> | null {
  if (!raw || typeof raw !== "object") return null

  // Build a partial object for Zod — only include fields that were provided
  const partial: Record<string, string> = {}
  if (raw.name) partial.name = String(raw.name).slice(0, 200)
  if (raw.email) partial.email = String(raw.email).slice(0, 254)
  if (raw.phone) partial.phone = String(raw.phone).slice(0, 50)
  if (raw.address) partial.address = String(raw.address).slice(0, 500)
  if (raw.tax_id) partial.tax_id = String(raw.tax_id).slice(0, 100)
  if (raw.notes) partial.notes = String(raw.notes).slice(0, 2000)

  // Validate with Zod (partial — only validate fields present)
  const result = clientSchema.partial().safeParse(partial)
  if (!result.success) return null

  return {
    name: result.data.name ? sanitizeText(result.data.name) : null,
    email: result.data.email ? sanitizeText(result.data.email) : null,
    phone: result.data.phone ? sanitizeText(result.data.phone) : null,
    address: result.data.address ? sanitizeText(result.data.address) : null,
    tax_id: result.data.tax_id ? sanitizeText(result.data.tax_id) : null,
    notes: result.data.notes ? sanitizeText(result.data.notes) : null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const originError = validateOrigin(request)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // Check user tier — free tier cannot use AI client management
    const { data: sub } = await (auth.supabase as any)
      .from("subscriptions")
      .select("plan")
      .eq("user_id", auth.user.id)
      .single()

    const userTier: string = sub?.plan ?? "free"
    if (userTier === "free") {
      return new Response(
        JSON.stringify({ error: "AI client management requires a paid plan" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const sizeError = validateBodySize(body, 50 * 1024) // 50KB max
    if (sizeError) return sizeError

    const { message, conversationHistory } = body as { message: unknown; conversationHistory: unknown }

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Enforce message length limit
    if (message.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Message too long. Maximum 2000 characters." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    if (!Array.isArray(conversationHistory)) {
      return new Response(
        JSON.stringify({ error: "conversationHistory must be an array" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Sanitize the user message before sending to AI
    const sanitizedMessage = sanitizeText(message)

    const { getSecret } = await import("@/lib/secrets")
    const apiKey = await getSecret("DEEPSEEK_API_KEY")
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )
    }

    // Build messages — sanitize history entries, cap at last 10
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-10).map((m: any) => ({
        role: String(m.role) === "user" ? "user" : "assistant",
        content: sanitizeText(String(m.content ?? "")).slice(0, 2000),
      })),
      { role: "user", content: sanitizedMessage },
    ]

    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages,
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    })

    if (!deepseekResponse.ok) {
      console.error("DeepSeek API error:", deepseekResponse.status)
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      )
    }

    const deepseekData = await deepseekResponse.json()
    const content = deepseekData.choices?.[0]?.message?.content ?? ""

    let parsed: AIClientExtractionResult
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = { action: "clarify", message: "I couldn't understand that. Could you rephrase?" }
    }

    // Validate action field
    if (!["create", "update", "clarify"].includes(parsed.action)) {
      parsed = { action: "clarify", message: "I couldn't understand that. Could you rephrase?" }
    }

    // Sanitize the response message from AI (shown to user)
    const responseMessage = sanitizeText(String(parsed.message || "Done!")).slice(0, 500)

    // Perform DB operation based on action
    if (parsed.action === "create" && parsed.clientData?.name) {
      const sanitizedData = sanitizeAIClientData(parsed.clientData)
      if (!sanitizedData?.name) {
        return new Response(sseStream("I need a client name to create a record. Could you provide one?"), {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
        })
      }

      const { error: insertError } = await (auth.supabase as any)
        .from("clients")
        .insert({ ...sanitizedData, user_id: auth.user.id })

      if (insertError) {
        console.error("Client insert error:", insertError)
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        )
      }
    } else if (parsed.action === "update" && parsed.targetClientName) {
      // Sanitize the target name before using in query
      const targetName = sanitizeText(String(parsed.targetClientName)).slice(0, 200)
      if (!targetName) {
        return new Response(sseStream("I couldn't identify which client to update. Could you be more specific?"), {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
        })
      }

      // Find client by name (case-insensitive) — scoped to authenticated user via RLS
      const { data: found } = await (auth.supabase as any)
        .from("clients")
        .select("id")
        .eq("user_id", auth.user.id)
        .ilike("name", targetName)
        .limit(1)
        .single()

      if (found?.id && parsed.clientData) {
        const sanitizedData = sanitizeAIClientData(parsed.clientData)
        if (sanitizedData) {
          // Only include non-null fields in the update payload
          const updatePayload: Record<string, string | null> = {}
          for (const [key, val] of Object.entries(sanitizedData)) {
            if (val !== null) updatePayload[key] = val
          }

          if (Object.keys(updatePayload).length > 0) {
            await (auth.supabase as any)
              .from("clients")
              .update(updatePayload)
              .eq("id", found.id)
              .eq("user_id", auth.user.id) // double-check ownership even with RLS
          }
        }
      }
    }
    // For "clarify" action, no DB operation — just stream the message back

    return new Response(sseStream(responseMessage), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (err) {
    console.error("AI clients route error:", err)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

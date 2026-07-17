import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"

interface GenerateMessageRequest {
  documentType: string
  clientName?: string
  senderName?: string
  referenceNumber?: string
  totalAmount?: string
  currency?: string
  dueDate?: string
  description?: string
  projectName?: string
  items?: Array<{ description: string; quantity: number; rate: number }>
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    let body: GenerateMessageRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    // Body size limit
    const sizeError = validateBodySize(body, 20 * 1024)
    if (sizeError) return sizeError

    // Use secure vault for API key
    const { getSecret } = await import("@/lib/secrets")
    const apiKey = await getSecret("DEEPSEEK_API_KEY")
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
    }

    const {
      documentType,
      clientName,
      senderName,
      referenceNumber,
      totalAmount,
      currency,
      dueDate,
      description,
      projectName,
      items,
    } = body

    // Sanitize all user-controlled inputs before injecting into AI prompt.
    const safeDocType = sanitizeText(documentType || "invoice").slice(0, 40)
    const normalizedDocType = safeDocType.toLowerCase().replace(/[\s-]+/g, "_")
    const isOnboardingForm = normalizedDocType === "client_onboarding_form"
    const safeClientName = sanitizeText(clientName || "").slice(0, 100)
    const safeSenderName = sanitizeText(senderName || "").slice(0, 100)
    const safeRef = sanitizeText(referenceNumber || "").slice(0, 50)
    const safeAmount = sanitizeText(totalAmount || "").slice(0, 30)
    const safeCurrency = sanitizeText(currency || "").slice(0, 10)
    const safeDueDate = sanitizeText(dueDate || "").slice(0, 30)
    const safeDescription = sanitizeText(description || "").slice(0, 300)
    const safeProjectName = sanitizeText(projectName || "").slice(0, 150)
    const safeItems = (items || []).slice(0, 5).map(i => sanitizeText(i.description || "").slice(0, 100))

    const docLabel = isOnboardingForm
      ? "client onboarding form"
      : safeDocType.charAt(0).toUpperCase() + safeDocType.slice(1).toLowerCase()
    const refText = safeRef ? ` ${safeRef}` : ""
    const amountText = safeAmount ? `${safeAmount}${safeCurrency ? ` (${safeCurrency})` : ""}` : ""
    const itemsSummary = safeItems.filter(Boolean).join(", ")

    const systemPrompt = isOnboardingForm
      ? `You are a professional business email writer. Write a short personal note inviting a client to complete a secure onboarding form.

Rules:
- Plain text only; no markdown, HTML, subject line, or placeholders
- Maximum 4 short sentences, including greeting and sign-off
- Say that the client should use the secure form link in the email
- Briefly explain that their answers and optional project files will help prepare the engagement
- Never say the form or any document is attached
- Do not invent deadlines, project details, or upload requirements
- Be warm, specific, and professional
- Sign off with the sender's first name or business name only`
      : `You are a professional business email writer. Write a SHORT, concise email body for sending business documents.

Rules:
- Plain text only (no markdown, no HTML, no asterisks)
- Maximum 4 short sentences, including greeting and sign-off
- Be warm and professional, not overly formal
- Do NOT include a subject line
- Do NOT use placeholder text — use the actual names provided
- Mention only the supplied document details; do not invent facts
- Sign off with the sender's first name or business name only`

    const contextLines = isOnboardingForm
      ? [
          `Project: ${safeProjectName || "not provided"}`,
          safeDescription ? `Project context: ${safeDescription}` : "",
        ]
      : [
          amountText ? `Amount: ${amountText}` : "",
          safeDueDate ? `Due date: ${safeDueDate}` : "",
          safeDescription ? `Description: ${safeDescription}` : "",
          itemsSummary ? `Main items: ${itemsSummary}` : "",
        ]

    const userPrompt = [
      isOnboardingForm
        ? `Write the invitation note to ${safeClientName || "the client"} from ${safeSenderName || "the business"}.`
        : `Write the email for sending a ${docLabel}${refText} to ${safeClientName || "the client"} from ${safeSenderName || "the business"}.`,
      ...contextLines.filter(Boolean),
    ].join("\n")

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 120,
        temperature: 0.7,
        stream: false,
      }),
    })

    if (!response.ok) {
      console.error("DeepSeek API error:", response.status)
      return NextResponse.json({ error: "AI service temporarily unavailable" }, { status: 502 })
    }

    const data = await response.json()
    const generatedMessage = data.choices?.[0]?.message?.content?.trim()

    if (!generatedMessage) {
      return NextResponse.json({ error: "Failed to generate message" }, { status: 500 })
    }

    return NextResponse.json({ message: generatedMessage })
  } catch (error) {
    console.error("Generate message error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

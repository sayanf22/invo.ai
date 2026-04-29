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
      items,
    } = body

    // Sanitize all user-controlled inputs before injecting into AI prompt
    const safeDocType = sanitizeText(documentType || "invoice").slice(0, 20)
    const safeClientName = sanitizeText(clientName || "").slice(0, 100)
    const safeSenderName = sanitizeText(senderName || "").slice(0, 100)
    const safeRef = sanitizeText(referenceNumber || "").slice(0, 50)
    const safeAmount = sanitizeText(totalAmount || "").slice(0, 30)
    const safeCurrency = sanitizeText(currency || "").slice(0, 10)
    const safeDueDate = sanitizeText(dueDate || "").slice(0, 30)
    const safeDescription = sanitizeText(description || "").slice(0, 200)
    const safeItems = (items || []).slice(0, 5).map(i => sanitizeText(i.description || "").slice(0, 100))

    const docLabel = safeDocType.charAt(0).toUpperCase() + safeDocType.slice(1).toLowerCase()
    const refText = safeRef ? ` ${safeRef}` : ""
    const amountText = safeAmount ? ` for ${safeCurrency} ${safeAmount}`.trim() : ""
    const dueDateText = safeDueDate ? `, due ${safeDueDate}` : ""
    const itemsSummary = safeItems.filter(Boolean).join(", ")

    const systemPrompt = `You are a professional business email writer. Write concise, warm, and professional email body text for sending business documents to clients. 

Rules:
- Write in plain text only (no markdown, no HTML)
- Keep it 3-5 short paragraphs
- Be professional but friendly
- Include a clear call to action
- End with a warm sign-off using the sender's name
- Do NOT include a subject line
- Do NOT use placeholder text like [name] — use the actual names provided
- If client name is unknown, use a generic greeting like "Hi there,"
- Keep total length under 300 words`

    const userPrompt = `Write a professional email body for sending a ${docLabel}${refText}${amountText}${dueDateText} to ${safeClientName || "the client"}.

Context:
- Document type: ${docLabel}
- Reference: ${safeRef || "N/A"}
- Amount: ${safeAmount ? `${safeCurrency} ${safeAmount}`.trim() : "not specified"}
- Due date: ${safeDueDate || "not specified"}
- Services/items: ${itemsSummary || safeDescription || "as per the document"}
- Sender name: ${safeSenderName || "the business"}
- Client name: ${safeClientName || "not specified"}

Write the email body text only. Start directly with the greeting.`

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
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
        max_tokens: 400,
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

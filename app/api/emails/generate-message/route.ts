import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

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

    const apiKey = process.env.DEEPSEEK_API_KEY
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

    const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
    const refText = referenceNumber ? ` ${referenceNumber}` : ""
    const amountText = totalAmount ? ` for ${currency || ""}${totalAmount}`.trim() : ""
    const dueDateText = dueDate ? `, due ${dueDate}` : ""
    const itemsSummary = items?.length
      ? items.slice(0, 3).map(i => i.description).filter(Boolean).join(", ")
      : ""

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

    const userPrompt = `Write a professional email body for sending a ${docLabel}${refText}${amountText}${dueDateText} to ${clientName || "the client"}.

Context:
- Document type: ${docLabel}
- Reference: ${referenceNumber || "N/A"}
- Amount: ${totalAmount ? `${currency || ""} ${totalAmount}`.trim() : "not specified"}
- Due date: ${dueDate || "not specified"}
- Services/items: ${itemsSummary || description || "as per the document"}
- Sender name: ${senderName || "the business"}
- Client name: ${clientName || "not specified"}

Write the email body text only. Start directly with the greeting.`

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
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

import type { InvoiceData } from "@/lib/invoice-types"

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

export interface AIGenerationRequest {
    prompt: string
    documentType: string
    businessContext?: {
        name: string
        address?: Record<string, string> | string
        country?: string
        currency?: string
        paymentTerms?: string
        signatory?: {
            name: string
            title: string
            email: string
        }
        taxRegistered?: boolean
        taxIds?: Record<string, string>
        phone?: string
        businessType?: string
        additionalNotes?: string
    }
    currentData?: Partial<InvoiceData>
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
}

export interface AIGenerationResponse {
    success: boolean
    data?: Partial<InvoiceData>
    message?: string
    error?: string
}

// ── Document Generation System Prompt ──────────────────────────────────

const GENERATION_SYSTEM_PROMPT = `You are Invo AI, a professional document generator. You create invoices, contracts, quotations, and proposals from user prompts.

## CORE RULES
1. ALWAYS respond with valid JSON: { "document": {...}, "message": "..." }
2. Generate the document IMMEDIATELY from whatever info the user provides. Don't refuse or ask too many questions.
3. Use the business profile data for all "from" fields — NEVER ask the user for their own business info.
4. Only ask about CLIENT/recipient info and document-specific details the user hasn't provided.
5. Your "message" should be 1-2 sentences: acknowledge what you created + ask ONE follow-up about missing info.
6. Every item in the "items" array MUST have: { "id": "unique-string", "description": "...", "quantity": number, "rate": number }

## UNDERSTANDING THE USER'S BUSINESS
You will receive a BUSINESS PROFILE and optionally BUSINESS SERVICES & PRICING INFO. This tells you:
- What the business sells (their products/services)
- Their pricing structure (plan names, prices)
- Their industry context

USE THIS INFORMATION to understand what the user is invoicing for. When the user says "invoice for X", match X against the business's known services and pricing. Examples:
- Business sells "QR menu services" with plans "Basic 249, Standard 399, Advanced 599, Premium 999"
- User says "invoice for airdrop advanced plan" → This is NOT about airdrops. "Airdrop" is likely a CLIENT or PROJECT name. "Advanced plan" matches the business's "Advanced" plan at 599. Create: item="Advanced Plan - QR Menu Service", rate=599, and if "airdrop" seems like a client/project, use it as toName or in the item description.
- User says "invoice for basic plan for John" → item="Basic Plan - QR Menu Service", rate=249, toName="John"

## SMART EXTRACTION FROM USER PROMPT
Parse the user's message carefully. Think about WHAT the user is invoicing FOR in the context of THEIR business:

### Step-by-step reasoning (do this internally, don't output it):
1. Read the user's prompt as a whole sentence
2. Check BUSINESS SERVICES & PRICING INFO — does any word in the prompt match a plan name, service, or product?
3. If yes, use the matching price from the business info
4. Identify what's the CLIENT vs what's the PRODUCT/SERVICE
5. If no price is mentioned and no plan matches, ask in your message

### Extraction Rules
- "for [plan_name]" where plan_name matches business pricing → use that plan's price as the item rate
- "for [name]" where name is a company/person → client name (toName)
- "for [name] for [plan]" → first is client, second is plan (or vice versa — use context)
- "for [plan] for [name]" → first is plan, second is client
- Numbers: "10k"=10000, "5k"=5000, "1.5k"=1500 → item rate/amount
- Capitalize names properly: "addmenu" → "AddMenu", "john doe" → "John Doe"
- If client name is provided, NEVER use "[Client Name]" placeholder. Use the actual name.
- Only use placeholders like "[To be provided]" for info the user truly did NOT mention.
- Create DESCRIPTIVE item names that reference the business's actual services, not just raw keywords.

## TEMPLATE/DESIGN DETECTION
Check user's message for template preferences:
- "modern" → templateId="modern", font="Helvetica", headerColor="#2563eb", tableColor="#eff6ff"
- "classic" → templateId="classic", font="Times-Roman", headerColor="#1e293b", tableColor="#f1f5f9"
- "bold" → templateId="bold", font="Helvetica", headerColor="#7c3aed", tableColor="#f5f3ff"
- "minimal"/"simple" → templateId="minimal", font="Helvetica", headerColor="", tableColor="#fafafa"
- "elegant"/"green" → templateId="elegant", font="Times-Roman", headerColor="#059669", tableColor="#ecfdf5"
- "corporate"/"navy"/"executive" → templateId="corporate", font="Helvetica", headerColor="#1e3a5f", tableColor="#f0f4f8"
- "creative"/"pink"/"rose" → templateId="creative", font="Helvetica", headerColor="#e11d48", tableColor="#fff1f2"
- "warm"/"earth"/"terracotta" → templateId="warm", font="Helvetica", headerColor="#c2410c", tableColor="#fff7ed"
- "geometric"/"shapes"/"angular"/"tech" → templateId="geometric", font="Roboto Mono", headerColor="#0d9488", tableColor="#f0fdfa"
- No preference → default to templateId="modern"
ALWAYS include the "design" object: { templateId, font, headerColor, tableColor, layout }

## PAYMENT INFO RULES
- NEVER include "paymentMethod" or "paymentInstructions" unless the user EXPLICITLY mentions payment method, bank details, or payment instructions.
- If the user doesn't mention payment info, set paymentMethod to "" (empty string) and paymentInstructions to "" (empty string).
- Do NOT default to "Bank Transfer" or any other payment method. Leave these fields EMPTY unless asked.

## TAX HANDLING
- If business is NOT tax-registered: taxRate MUST be 0. No GST/VAT/tax unless user explicitly asks.
- If business IS tax-registered: apply appropriate tax rate for the country.

## DOCUMENT STRUCTURE
The "document" object must include all relevant fields for the document type.

For Invoice, ALWAYS include these fields:
- documentType: "Invoice"
- invoiceNumber: "INV-XXXX" (random 4-digit number)
- issueDate/invoiceDate: today's date (YYYY-MM-DD format)
- dueDate: based on payment terms
- fromName, fromEmail, fromAddress, fromPhone: from business profile
- toName, toEmail, toAddress: client info (use placeholders only if truly unknown)
- items: array of { id, description, quantity, rate } — ALWAYS set rate > 0 when you know the price
- subtotal, taxRate, taxAmount, total: calculated correctly
- currency: from business profile
- paymentTerms: from business profile
- notes: a professional thank-you note
- design: template object

For Contract: title, parties, effectiveDate, terms, clauses, signatures, design
For Quotation: documentNumber, issueDate, validUntil, fromName, toName, items[], subtotal, total, currency, notes, design
For Proposal: title, preparedFor, preparedBy, date, sections[], pricing, timeline, design

## OUTPUT FORMAT
Respond with ONLY valid JSON (no markdown, no code fences):
{
  "document": { ... complete document data ... },
  "message": "Short friendly message about what was created + one follow-up question"
}`

// Build the full user-context prompt (system prompt is sent separately)
function buildPrompt(request: AIGenerationRequest): string {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const isoStr = now.toISOString()

    let prompt = `CURRENT DATE: ${dateStr} (${isoStr})\nDOCUMENT TYPE: ${request.documentType}\n`

    // Business profile context
    if (request.businessContext) {
        const addressStr = typeof request.businessContext.address === 'string'
            ? request.businessContext.address
            : [
                (request.businessContext.address as Record<string, string>)?.street,
                (request.businessContext.address as Record<string, string>)?.city,
                (request.businessContext.address as Record<string, string>)?.state,
                (request.businessContext.address as Record<string, string>)?.postalCode,
            ].filter(Boolean).join(", ")

        const taxStatus = request.businessContext.taxRegistered
            ? `REGISTERED — Tax IDs: ${JSON.stringify(request.businessContext.taxIds)}`
            : "NOT REGISTERED — set taxRate=0, no GST/VAT/tax unless user explicitly asks"

        prompt += `
BUSINESS PROFILE (use for all "from" fields):
- Company: ${request.businessContext.name}
- Address: ${addressStr || "Not provided"}
- Country: ${request.businessContext.country || "Not specified"}
- Currency: ${request.businessContext.currency || "USD"}
- Payment Terms: ${request.businessContext.paymentTerms || "Net 30"}
- Contact: ${request.businessContext.signatory?.name || ""} (${request.businessContext.signatory?.title || "Owner"})
- Email: ${request.businessContext.signatory?.email || ""}
- Phone: ${request.businessContext.phone || ""}
- Tax: ${taxStatus}
`
        // Include business services/pricing info if available — this is critical for the AI
        // to understand what the business sells and at what prices
        if (request.businessContext.additionalNotes) {
            prompt += `\nBUSINESS SERVICES & PRICING INFO:\n${request.businessContext.additionalNotes}\nIMPORTANT: Use the above services/pricing info to match the user's request. If the user mentions a plan name or service that matches, use the correct price from this info. For example, if the user says "invoice for advanced plan" and the pricing info lists "Advanced 599", set the item rate to 599.\n`
        }
    }

    // Conversation history
    if (request.conversationHistory && request.conversationHistory.length > 0) {
        prompt += `\nCONVERSATION HISTORY:\n${request.conversationHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}\n`
    }

    // Existing document data (for edits/updates)
    if (request.currentData && Object.keys(request.currentData).length > 0) {
        prompt += `\nEXISTING DOCUMENT DATA:\n${JSON.stringify(request.currentData, null, 2)}\n`
    }

    prompt += `\nUSER'S MESSAGE: "${request.prompt}"`

    return prompt
}

// Helper function for retry with exponential backoff
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 3
): Promise<Response> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, options)

            // If rate limited, wait and retry
            if (response.status === 429) {
                const retryAfter = response.headers.get('retry-after')
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000

                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, waitTime))
                    continue
                }
            }

            return response
        } catch (error) {
            lastError = error as Error
            if (attempt < maxRetries - 1) {
                const waitTime = Math.pow(2, attempt) * 1000
                await new Promise(resolve => setTimeout(resolve, waitTime))
            }
        }
    }

    throw lastError || new Error('Max retries exceeded')
}

// Non-streaming generation
export async function generateDocument(
    request: AIGenerationRequest
): Promise<AIGenerationResponse> {
    const apiKey = process.env.DEEPSEEK_API_KEY

    if (!apiKey) {
        return {
            success: false,
            error: "DeepSeek API key not configured. Add DEEPSEEK_API_KEY to .env.local",
        }
    }

    // Check for placeholder or invalid key format
    if (apiKey === "your_deepseek_api_key_here" || apiKey.length < 20) {
        return {
            success: false,
            error: "Please configure a valid DeepSeek API key at https://platform.deepseek.com/",
        }
    }

    try {
        const prompt = buildPrompt(request)

        const response = await fetchWithRetry(DEEPSEEK_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: GENERATION_SYSTEM_PROMPT },
                    { role: "user", content: prompt },
                ],
                temperature: 0.3,
                max_tokens: 4000,
                response_format: { type: "json_object" },
            }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            if (response.status === 401 || response.status === 403) {
                throw new Error("DeepSeek API key is invalid or expired. Please get a new key from https://platform.deepseek.com/")
            }
            if (response.status === 402) {
                throw new Error("DeepSeek API account has insufficient credits. Please add credits at https://platform.deepseek.com/")
            }
            if (response.status === 429) {
                const retryAfter = response.headers.get('retry-after')
                const waitMessage = retryAfter
                    ? `Please wait ${retryAfter} seconds and try again.`
                    : "Please wait a few minutes and try again."
                throw new Error(`DeepSeek API rate limit exceeded. ${waitMessage}`)
            }
            throw new Error(errorData.error?.message || `API error: ${response.status}`)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (!content) {
            throw new Error("No content in API response")
        }

        let cleanedContent = content.trim()

        if (cleanedContent.startsWith('```json')) {
            cleanedContent = cleanedContent.replace(/^```json\s*/i, '').replace(/```\s*$/, '')
        } else if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/```\s*$/, '')
        }

        cleanedContent = cleanedContent.trim()

        const parsedData = JSON.parse(cleanedContent)

        return {
            success: true,
            data: parsedData,
            message: "Document generated successfully",
        }
    } catch (error) {
        console.error("DeepSeek API error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to generate document",
        }
    }
}

// Streaming generation for real-time UI updates
export async function* streamGenerateDocument(
    request: AIGenerationRequest
): AsyncGenerator<{ type: "chunk" | "complete" | "error"; data: string }> {
    const apiKey = process.env.DEEPSEEK_API_KEY

    if (!apiKey) {
        yield { type: "error", data: "DeepSeek API key not configured. Add DEEPSEEK_API_KEY to .env" }
        return
    }

    if (apiKey === "your_deepseek_api_key_here" || apiKey.length < 20) {
        yield { type: "error", data: "Please configure a valid DeepSeek API key at https://platform.deepseek.com/" }
        return
    }

    try {
        const prompt = buildPrompt(request)

        const response = await fetch(DEEPSEEK_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: GENERATION_SYSTEM_PROMPT },
                    { role: "user", content: prompt },
                ],
                temperature: 0.3,
                max_tokens: 4000,
                stream: true,
            }),
        })

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                yield { type: "error", data: "DeepSeek API key is invalid or expired." }
                return
            }
            if (response.status === 402) {
                yield { type: "error", data: "DeepSeek account has insufficient credits." }
                return
            }
            if (response.status === 429) {
                yield { type: "error", data: "DeepSeek API rate limit exceeded. Please wait and try again." }
                return
            }
            throw new Error(`API error: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let fullContent = ""

        if (!reader) {
            throw new Error("No response body")
        }

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split("\n").filter((line) => line.startsWith("data: "))

            for (const line of lines) {
                const data = line.slice(6)
                if (data === "[DONE]") continue

                try {
                    const parsed = JSON.parse(data)
                    const content = parsed.choices?.[0]?.delta?.content || ""
                    if (content) {
                        fullContent += content
                        yield { type: "chunk", data: content }
                    }
                } catch {
                    // Skip invalid JSON chunks
                }
            }
        }

        let cleanedContent = fullContent.trim()

        if (cleanedContent.startsWith('```json')) {
            cleanedContent = cleanedContent.replace(/^```json\s*/i, '').replace(/```\s*$/, '')
        } else if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/```\s*$/, '')
        }

        cleanedContent = cleanedContent.trim()

        yield { type: "complete", data: cleanedContent }
    } catch (error) {
        yield {
            type: "error",
            data: error instanceof Error ? error.message : "Streaming failed",
        }
    }
}

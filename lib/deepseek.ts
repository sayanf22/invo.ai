import type { InvoiceData } from "@/lib/invoice-types"

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

export interface AIGenerationRequest {
    prompt: string
    documentType: string
    businessContext?: {
        name: string
        address?: Record<string, string>
        currency?: string
        paymentTerms?: string
        signatory?: {
            name: string
            title: string
            email: string
        }
    }
    currentData?: Partial<InvoiceData>
}

export interface AIGenerationResponse {
    success: boolean
    data?: Partial<InvoiceData>
    message?: string
    error?: string
}

// System prompts for different document types
const DOCUMENT_PROMPTS: Record<string, string> = {
    invoice: `You are an expert invoice generator. Given user input, generate professional invoice data.
Always return valid JSON matching the InvoiceData schema with these fields:
- documentType: "invoice"
- title: A clear invoice title
- invoiceNumber: Auto-generate if not specified (format: INV-YYYYMMDD-XXX)
- issueDate: Today's date if not specified
- dueDate: Based on payment terms
- clientName, clientCompany, clientAddress, clientEmail
- items: Array of {description, qty, rate, amount}
- subtotal, tax, taxRate, discount, total
- notes: Any special instructions
- paymentTerms, paymentInstructions
Fill in reasonable defaults for missing fields. Be professional and precise.`,

    contract: `You are an expert contract drafter. Given user input, generate professional contract data.
Always return valid JSON with these fields:
- documentType: "contract"
- title: Contract title (e.g., "Service Agreement")
- parties: Array of party names and roles
- effectiveDate: Start date
- terminationDate: End date if applicable
- terms: Array of contract terms/clauses
- compensation: Payment terms
- signatures: Placeholder for signature blocks
- jurisdiction: Governing law location
Generate comprehensive, legally-sound contract terms based on the request.`,

    nda: `You are an expert NDA drafter. Given user input, generate professional NDA data.
Always return valid JSON with these fields:
- documentType: "nda"
- title: "Non-Disclosure Agreement" or "Mutual Non-Disclosure Agreement"
- disclosingParty: Name and details
- receivingParty: Name and details
- purpose: Purpose of disclosure
- confidentialInfo: What's covered
- duration: How long confidentiality lasts
- obligations: Key obligations
- exclusions: What's not covered
- effectiveDate: Start date
Generate a comprehensive NDA that protects the disclosing party.`,

    agreement: `You are an expert legal document drafter. Given user input, generate professional agreement data.
Always return valid JSON with these fields:
- documentType: "agreement"
- title: Agreement title
- parties: Array of parties involved
- recitals: Background/context
- terms: Array of agreement terms
- effectiveDate: When it takes effect
- signatures: Placeholder for signatures
Generate a clear, comprehensive agreement based on the request.`,
}

// Build the full prompt with context
function buildPrompt(request: AIGenerationRequest): string {
    const systemPrompt = DOCUMENT_PROMPTS[request.documentType] || DOCUMENT_PROMPTS.invoice

    let contextSection = ""
    if (request.businessContext) {
        contextSection = `
Business Context:
- Company: ${request.businessContext.name}
- Address: ${JSON.stringify(request.businessContext.address || {})}
- Currency: ${request.businessContext.currency || "USD"}
- Payment Terms: ${request.businessContext.paymentTerms || "Net 30"}
- Signatory: ${request.businessContext.signatory?.name || "Not specified"} (${request.businessContext.signatory?.title || ""})
`
    }

    let currentDataSection = ""
    if (request.currentData && Object.keys(request.currentData).length > 0) {
        currentDataSection = `
Current Document Data (merge with and update this):
${JSON.stringify(request.currentData, null, 2)}
`
    }

    return `${systemPrompt}

${contextSection}
${currentDataSection}

User Request: ${request.prompt}

Respond with ONLY valid JSON. No markdown, no explanations, just the JSON object.`
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
        const response = await fetch(DEEPSEEK_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional document generator. Always respond with valid JSON only.",
                    },
                    {
                        role: "user",
                        content: buildPrompt(request),
                    },
                ],
                temperature: 0.3, // Lower for more deterministic output
                max_tokens: 4000,
                response_format: { type: "json_object" },
            }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            // Handle specific error codes
            if (response.status === 401 || response.status === 403) {
                throw new Error("DeepSeek API key is invalid or expired. Please get a new key from https://platform.deepseek.com/")
            }
            if (response.status === 402) {
                throw new Error("DeepSeek account has insufficient credits. Please add credits at https://platform.deepseek.com/")
            }
            if (response.status === 429) {
                throw new Error("Rate limit exceeded. Please try again in a few seconds.")
            }
            throw new Error(errorData.error?.message || `API error: ${response.status}`)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (!content) {
            throw new Error("No content in API response")
        }

        // Parse the JSON response
        const parsedData = JSON.parse(content)

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

    // Check for placeholder or invalid key
    if (apiKey === "your_deepseek_api_key_here" || apiKey.length < 20) {
        yield { type: "error", data: "Please configure a valid DeepSeek API key at https://platform.deepseek.com/" }
        return
    }

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional document generator. Always respond with valid JSON only.",
                    },
                    {
                        role: "user",
                        content: buildPrompt(request),
                    },
                ],
                temperature: 0.3,
                max_tokens: 4000,
                stream: true,
            }),
        })

        if (!response.ok) {
            // Handle specific error codes with clear messages
            if (response.status === 401 || response.status === 403) {
                yield { type: "error", data: "DeepSeek API key is invalid or expired. Please get a new key from https://platform.deepseek.com/" }
                return
            }
            if (response.status === 402) {
                yield { type: "error", data: "DeepSeek account has insufficient credits. Please add credits at https://platform.deepseek.com/" }
                return
            }
            if (response.status === 429) {
                yield { type: "error", data: "Rate limit exceeded. Please try again in a few seconds." }
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
                const data = line.slice(6) // Remove "data: " prefix
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

        yield { type: "complete", data: fullContent }
    } catch (error) {
        yield {
            type: "error",
            data: error instanceof Error ? error.message : "Streaming failed",
        }
    }
}

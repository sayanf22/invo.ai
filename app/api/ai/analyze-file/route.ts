import { NextResponse } from "next/server"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import { getSecret } from "@/lib/secrets"
import { sanitizeText } from "@/lib/sanitize"
import { checkCostLimit, trackUsage, getUserTier } from "@/lib/cost-protection"
import { checkRateLimit } from "@/lib/rate-limiter"
import { analyzeImagesWithKimiVision, resolveBedrockKey } from "@/lib/bedrock"

/**
 * POST /api/ai/analyze-file
 * Analyzes uploaded files (images, PDFs) to extract business information.
 *
 * MODEL ROUTING STRATEGY:
 * - PREFERRED: Kimi K2.5 vision (via Bedrock Mantle). Clients send pre-rasterized
 *   IMAGES as JSON `{ images: string[] }` — PDFs are rendered to images
 *   client-side (pdf.js) because Kimi cannot read PDFs natively. See
 *   `lib/attachment-analysis.ts`. This path uses NO OpenAI/GPT.
 * - LEGACY FALLBACK: the multipart `file` path still uses OpenAI GPT vision for
 *   backward compatibility; once all callers use the Kimi helper it is unused.
 * - GPT/Kimi are ONLY called when a file is physically attached by the user.
 * - All text-only chat messages use DeepSeek (via /api/ai/stream, /api/ai/onboarding, /api/ai/profile-update)
 * - After extraction, the structured data is passed back to the client, which
 *   sends it as HIDDEN reference context to DeepSeek for generation/chat.
 * 
 * SECURITY:
 * - Requires authentication (no anonymous access)
 * - Rate limited: 5 file analyses per minute per user (prevents API exhaustion)
 * - File size limit: 10MB
 * - File type whitelist: only images and PDFs
 * - OpenAI key fetched from Supabase Vault (never exposed to client)
 * - Input sanitization on extracted data
 */

const EXTRACTION_PROMPT = `You are a business document analysis AI. Analyze the provided document/image and extract ALL business and client information you can find.

This document is being uploaded by a user who wants to generate an invoice, contract, quotation, or proposal. The information in this document likely belongs to their CLIENT or contains details about a project/service.

Return a JSON object with these fields (use null for fields you cannot determine):

{
  "businessType": "freelancer|agency|ecommerce|professional|developer|other",
  "businessName": "Company/Business name found in the document",
  "ownerName": "Owner/Director/Contact person name",
  "email": "Business email",
  "phone": "Primary phone number with country code",
  "phone2": "Secondary phone number (if found)",
  "country": "2-letter country code (IN, US, GB, DE, CA, AU, SG, AE, PH, FR, NL)",
  "address": {
    "street": "Street address",
    "city": "City",
    "state": "State/Province",
    "postalCode": "ZIP/Postal code"
  },
  "taxId": "GST/VAT/Tax ID number",
  "clientCountries": ["array of 2-letter country codes where clients are based"],
  "defaultCurrency": "3-letter currency code (INR, USD, EUR, GBP, etc.)",
  "paymentTerms": "net_7|net_15|net_30|net_45|net_60|due_on_receipt",
  "bankDetails": {
    "bankName": "Bank name",
    "accountNumber": "Account number",
    "ifscCode": "IFSC/SWIFT/routing code",
    "accountHolderName": "Name on account"
  },
  "services": "List ALL services, products, packages, plans, or line items with their EXACT prices. Format: 'ServiceName - Price' for each. Include every tier, package, and offering. Example: 'Basic Website - Rs. 15,000, Dynamic Website - Rs. 25,000, E-commerce Website - Rs. 40,000'. Reproduce ALL pricing details VERBATIM.",
  "pricing": "Extract ALL pricing information as structured data. Include plan names, prices, currencies, billing periods. Example: 'Basic: 249/month, Standard: 399/month, Advanced: 599/month'. If no structured pricing found, use null.",
  "projectDescription": "Brief description of the project, work, or engagement described in the document",
  "additionalContext": "Any other relevant business information — industry, terms, deadlines, deliverables, important notes, policies, etc. Include verbatim any pricing notes, payment terms, or conditions mentioned."
}

IMPORTANT:
- Extract as much as possible from the document
- For fields you cannot determine, use null
- Pay special attention to: company names, contact details, services/products listed, prices/amounts, and project descriptions
- The "services" field MUST list every package, tier, and offering with their EXACT prices. Do NOT summarize — include all pricing details verbatim (e.g., "Basic Website Rs. 15,000, Dynamic Website Rs. 25,000")
- The "projectDescription" field should summarize what the document is about
- The "additionalContext" field should contain any extra details like payment terms, conditions, notes, and policies mentioned in the document
- Return ONLY valid JSON, no markdown or explanation`

/**
 * Persist a file-analysis failure to error_logs so production failures are
 * observable (the Cloudflare console is not visible to us). Fire-and-forget:
 * never throws, never blocks the response.
 */
async function logAnalyzeFailure(
    supabase: any,
    userId: string,
    reason: string,
    metadata: Record<string, unknown>
): Promise<void> {
    try {
        await supabase.from("error_logs").insert({
            user_id: userId,
            error_context: "ai_analyze_file",
            error_message: reason,
            metadata,
        })
    } catch {
        // swallow — logging must never break the request
    }
}

function buildFileContextSummary(extracted: any): string {
    const parts: string[] = []
    if (extracted.businessName) parts.push(`Business: ${extracted.businessName}`)
    if (extracted.ownerName) parts.push(`Contact: ${extracted.ownerName}`)
    if (extracted.email) parts.push(`Email: ${extracted.email}`)
    if (extracted.phone) parts.push(`Phone: ${extracted.phone}`)
    if (extracted.country) parts.push(`Country: ${extracted.country}`)
    if (extracted.address) {
        const addr = typeof extracted.address === 'string'
            ? extracted.address
            : [extracted.address.street, extracted.address.city, extracted.address.state, extracted.address.postalCode].filter(Boolean).join(', ')
        if (addr) parts.push(`Address: ${addr}`)
    }
    if (extracted.taxId) parts.push(`Tax ID: ${extracted.taxId}`)
    if (extracted.defaultCurrency) parts.push(`Currency: ${extracted.defaultCurrency}`)
    if (extracted.services) parts.push(`Services: ${extracted.services}`)
    if (extracted.pricing) parts.push(`Pricing: ${extracted.pricing}`)
    if (extracted.projectDescription) parts.push(`Project: ${extracted.projectDescription}`)
    if (extracted.additionalContext) parts.push(`Additional Info: ${extracted.additionalContext}`)
    return parts.join('\n')
}

/** Build the "generate a full document from the file" instruction (shared). */
function buildGeneratePrompt(docType: string, userMessage: string | null, businessContext: string | null): string {
    const businessInfo = businessContext
        ? `\n\nSENDER BUSINESS PROFILE (use as "Bill From"):\n${businessContext}`
        : ""
    const prefix = docType === "invoice" ? "INV" : docType === "quote" || docType === "quotation" ? "QUO"
        : docType === "estimate" ? "EST" : docType === "contract" ? "CTR" : "PROP"
    return `You are a professional document generator. Analyze the attached document image(s) and generate a complete ${docType}.

The attached document contains CLIENT/RECIPIENT information. Extract their details and use them as the "Bill To" / recipient.${businessInfo}

${userMessage ? `User's instruction: "${userMessage}"` : `Generate a ${docType} based on the information in the attached document.`}

Return ONLY valid JSON in this exact format:
{
  "document": {
    "documentType": "${docType.charAt(0).toUpperCase() + docType.slice(1)}",
    "referenceNumber": "${prefix}-${Date.now().toString().slice(-6)}",
    "date": "${new Date().toISOString().split("T")[0]}",
    "dueDate": "",
    "fromName": "", "fromEmail": "", "fromPhone": "", "fromAddress": "",
    "toName": "CLIENT NAME FROM DOCUMENT",
    "toEmail": "CLIENT EMAIL FROM DOCUMENT",
    "toPhone": "",
    "toAddress": "CLIENT ADDRESS FROM DOCUMENT",
    "items": [{"id": "1", "description": "SERVICE FROM DOCUMENT", "quantity": 1, "rate": 0}],
    "taxRate": 0, "discountValue": 0, "discountType": "percent", "shippingFee": 0,
    "notes": "", "terms": "", "currency": "INR"
  },
  "message": "Brief message about what was generated"
}

RULES:
- Extract client name, email, phone, address from the document for the "to" fields
- Extract services/items with prices from the document for the "items" array
- Every item MUST have id, description, quantity, and rate
- Do NOT compute totals — the system calculates them
- Return ONLY valid JSON, no markdown`
}

/** Recursively strip HTML tags from all string values. */
function sanitizeParsed(val: unknown): unknown {
    if (typeof val === "string") return val.replace(/<[^>]*>/g, "").trim()
    if (Array.isArray(val)) return val.map(sanitizeParsed)
    if (typeof val === "object" && val !== null) {
        const clean: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(val)) clean[k] = sanitizeParsed(v)
        return clean
    }
    return val
}

/**
 * Analyze pre-rasterized images with Kimi K2.5 vision. Expects a JSON body:
 * { images: string[] (data URLs), message?, mode?, documentType?, businessContext? }
 */
async function analyzeWithKimi(
    request: Request,
    auth: { user: { id: string }; supabase: unknown }
): Promise<Response> {
    const body = await request.json().catch(() => null) as {
        images?: unknown; message?: unknown; mode?: unknown
        documentType?: unknown; businessContext?: unknown
    } | null
    if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

    const images = Array.isArray(body.images)
        ? body.images.filter((u): u is string => typeof u === "string" && u.startsWith("data:image/"))
        : []
    if (images.length === 0) {
        return NextResponse.json({ error: "No readable image content provided" }, { status: 400 })
    }
    // SECURITY: bound the payload — max 8 images, ~8MB total base64.
    const boundedImages = images.slice(0, 8)
    const totalBytes = boundedImages.reduce((n, u) => n + u.length, 0)
    if (totalBytes > 12 * 1024 * 1024) {
        return NextResponse.json({ error: "Attachment too large. Try a smaller file." }, { status: 413 })
    }

    const userMessage = typeof body.message === "string" ? sanitizeText(body.message).slice(0, 10_000) : null
    const mode = body.mode === "generate" ? "generate" : "extract"
    const documentType = typeof body.documentType === "string" && body.documentType.trim()
        ? body.documentType.toLowerCase().trim()
        : "invoice"
    const businessContext = typeof body.businessContext === "string"
        ? sanitizeText(body.businessContext).slice(0, 5_000)
        : null

    const bedrockKey = resolveBedrockKey()
    if (!bedrockKey) {
        return NextResponse.json({ error: "Document analysis is temporarily unavailable. Please type your details in the chat instead." }, { status: 503 })
    }

    const instruction = mode === "generate"
        ? buildGeneratePrompt(documentType, userMessage, businessContext)
        : (userMessage ? `${EXTRACTION_PROMPT}\n\nAdditional context from the user: "${userMessage}"` : EXTRACTION_PROMPT)

    const content = await analyzeImagesWithKimiVision(boundedImages, instruction, bedrockKey, mode === "generate" ? 2500 : 1800)
    if (!content) {
        return NextResponse.json({ error: "AI service temporarily unavailable. Please try again." }, { status: 502 })
    }

    let parsed: Record<string, unknown> | null = null
    try {
        const cleaned = content.replace(/```json\s*/gi, "").replace(/```/g, "").trim()
        const start = cleaned.indexOf("{")
        const end = cleaned.lastIndexOf("}")
        parsed = JSON.parse(start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned)
    } catch {
        return NextResponse.json({ error: "Could not process the file" }, { status: 422 })
    }

    const sanitized = sanitizeParsed(parsed) as Record<string, unknown>

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await trackUsage(auth.supabase as any, auth.user.id, "generation", 0)

    if (mode === "generate") {
        return NextResponse.json({
            success: true,
            mode: "generate",
            document: (sanitized.document as Record<string, unknown>) || sanitized,
            message: (sanitized.message as string) || "Document generated from file.",
        })
    }

    return NextResponse.json({
        success: true,
        mode: "extract",
        extracted: sanitized,
        summary: buildFileContextSummary(sanitized),
        fieldsFound: Object.entries(sanitized).filter(([, v]) => v !== null && v !== "").length,
    })
}

export async function POST(request: Request) {
    // SECURITY: Reject cross-origin / CSRF requests before doing any work. This
    // is a state-changing POST that calls a paid OpenAI vision API, so it MUST
    // only be callable from our own site (same-origin browser fetch sends a
    // matching Origin/Referer). Combined with authenticateRequest + the per-user
    // rate limit below, this prevents anyone from driving up our OpenAI bill.
    const originError = validateOrigin(request as never)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // SECURITY: Per-user rate limit BEFORE any AI call. OpenAI vision is expensive,
    // so this endpoint gets its own tight 10/min cap to prevent cost-exhaustion abuse.
    // (The document-count cost check below does NOT throttle this route because file
    // analysis never increments the document counter.)
    const rateLimitError = await checkRateLimit(auth.user.id, "file_analysis", auth.supabase as never)
    if (rateLimitError) return rateLimitError

    // SECURITY: Fetch user tier and check cost limit BEFORE any AI call
    const userTier = await getUserTier(auth.supabase, auth.user.id)

    const costError = await checkCostLimit(auth.supabase, auth.user.id, "generation", userTier)
    if (costError) return costError

    // ── Kimi vision path (preferred) ──────────────────────────────────────────
    // Clients send pre-rasterized IMAGES as JSON (PDFs are rendered to images
    // client-side via pdf.js, since Kimi cannot read PDFs natively). This path
    // uses Kimi K2.5 vision exclusively — no OpenAI/GPT.
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
        try {
            const kimiResult = await analyzeWithKimi(request, auth)
            return kimiResult
        } catch (error: unknown) {
            console.error("Kimi analyze-file error:", error instanceof Error ? error.message : error)
            return NextResponse.json({ error: "Could not analyze the file. Please try again or type the details." }, { status: 502 })
        }
    }

    try {
        const formData = await request.formData()
        const file = formData.get("file") as File | null
        const userMessage = formData.get("message") as string | null
        const mode = formData.get("mode") as string | null // "extract" (default) or "generate"
        const documentType = formData.get("documentType") as string | null
        const businessContext = formData.get("businessContext") as string | null

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 })
        }

        // SECURITY: Validate prompt length (max 10,000 chars)
        if (userMessage && userMessage.length > 10_000) {
            return NextResponse.json({ error: "Message too long. Maximum 10,000 characters." }, { status: 400 })
        }

        // SECURITY: Sanitize user-provided text inputs
        const sanitizedUserMessage = userMessage ? sanitizeText(userMessage) : null

        // SECURITY: Truncate file context (businessContext) to 5,000 chars
        const truncatedBusinessContext = businessContext
            ? sanitizeText(businessContext).slice(0, 5_000)
            : null

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 })
        }

        // Validate file type
        const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: "Unsupported file type. Upload an image or PDF." }, { status: 400 })
        }

        const openaiKey = await getSecret("OPENAI_API_KEY")
        if (!openaiKey) {
            console.error("OPENAI_API_KEY not found. ENV keys available:", Object.keys(process.env).filter(k => k.includes("OPENAI") || k.includes("DEEPSEEK") || k.includes("SUPABASE_SERVICE")).join(", ") || "none")
            await logAnalyzeFailure(auth.supabase, auth.user.id, "openai_key_missing", {
                hint: "getSecret returned empty — key not in process.env, Worker binding, or Vault (needs SUPABASE_SERVICE_ROLE_KEY to reach Vault).",
            })
            return NextResponse.json({ error: "Document analysis is temporarily unavailable. Please type your details in the chat instead." }, { status: 503 })
        }

        // Convert file to base64 — use chunked approach for large files
        const bytes = await file.arrayBuffer()
        const uint8 = new Uint8Array(bytes)
        let binary = ""
        const chunkSize = 8192
        for (let i = 0; i < uint8.length; i += chunkSize) {
            binary += String.fromCharCode(...uint8.slice(i, i + chunkSize))
        }
        const base64 = btoa(binary)
        const mimeType = file.type
        const imageUrl = `data:${mimeType};base64,${base64}`

        // Build the message content based on file type
        const isImage = mimeType.startsWith("image/")
        const isPDF = mimeType === "application/pdf"

        let contentParts: any[]
        let activePrompt: string

        if (mode === "generate") {
            // GENERATION MODE: GPT reads the file and generates a complete document JSON
            const docType = documentType || "invoice"
            let businessInfo = ""
            if (truncatedBusinessContext) {
                try { businessInfo = `\n\nSENDER BUSINESS PROFILE (use as "Bill From"):\n${truncatedBusinessContext}` } catch {}
            }

            activePrompt = `You are a professional document generator. Analyze the attached document and generate a complete ${docType}.

The attached document contains CLIENT/RECIPIENT information. Extract their details and use them as the "Bill To" / recipient.${businessInfo}

${sanitizedUserMessage ? `User's instruction: "${sanitizedUserMessage}"` : `Generate a ${docType} based on the information in the attached document.`}

Return ONLY valid JSON in this exact format:
{
  "document": {
    "documentType": "${docType.charAt(0).toUpperCase() + docType.slice(1)}",
    "referenceNumber": "${docType === "invoice" ? "INV" : docType === "quotation" ? "QUO" : docType === "contract" ? "CTR" : "PROP"}-${Date.now().toString().slice(-6)}",
    "date": "${new Date().toISOString().split("T")[0]}",
    "dueDate": "",
    "fromName": "",
    "fromEmail": "",
    "fromPhone": "",
    "fromAddress": "",
    "toName": "CLIENT NAME FROM DOCUMENT",
    "toEmail": "CLIENT EMAIL FROM DOCUMENT",
    "toPhone": "",
    "toAddress": "CLIENT ADDRESS FROM DOCUMENT",
    "items": [{"id": "1", "description": "SERVICE FROM DOCUMENT", "quantity": 1, "rate": 0}],
    "taxRate": 0,
    "discountValue": 0,
    "discountType": "percent",
    "shippingFee": 0,
    "notes": "",
    "terms": "",
    "currency": "INR"
  },
  "message": "Brief message about what was generated"
}

RULES:
- Extract client name, email, phone, address from the document for the "to" fields
- Extract services/items with prices from the document for the "items" array
- Every item MUST have id, description, quantity, and rate
- Do NOT compute totals — the system calculates them
- Return ONLY valid JSON, no markdown`
        } else {
            // EXTRACTION MODE (default): just extract business info
            activePrompt = sanitizedUserMessage
                ? `${EXTRACTION_PROMPT}\n\nAdditional context from the user: "${sanitizedUserMessage}"`
                : EXTRACTION_PROMPT
        }

        const promptText = activePrompt

        if (isImage) {
            contentParts = [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ]
        } else if (isPDF) {
            contentParts = [
                { type: "text", text: promptText },
                { type: "file", file: { filename: file.name, file_data: imageUrl } },
            ]
        } else {
            return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
        }

        // Call OpenAI API with gpt-5.4-mini (supports images + PDFs natively, 3x cheaper than gpt-5.4)
        // A 55s timeout guards against a hung upstream request being killed opaquely
        // by the Cloudflare Worker (which would otherwise surface as a confusing
        // generic failure with no clear cause).
        let response: Response
        try {
            response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${openaiKey}`,
                },
                body: JSON.stringify({
                    model: "gpt-5.4-mini",
                    messages: [
                        {
                            role: "user",
                            content: contentParts,
                        },
                    ],
                    max_completion_tokens: 2000,
                    temperature: 0.1,
                }),
                signal: AbortSignal.timeout(55_000),
            })
        } catch (fetchErr: any) {
            // AbortSignal.timeout throws a TimeoutError; network drops throw too.
            const isTimeout = fetchErr?.name === "TimeoutError" || fetchErr?.name === "AbortError"
            console.error("OpenAI fetch failed:", fetchErr?.name, fetchErr?.message)
            await logAnalyzeFailure(auth.supabase, auth.user.id, isTimeout ? "openai_timeout" : "openai_network_error", {
                errorName: fetchErr?.name,
                errorMessage: fetchErr?.message,
                fileType: file.type,
                fileSizeKb: Math.round(file.size / 1024),
            })
            return NextResponse.json(
                { error: isTimeout ? "The document took too long to analyze. Please try a smaller file or type your details." : "AI service temporarily unavailable. Please try again." },
                { status: isTimeout ? 504 : 502 }
            )
        }

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: { message: "Unknown error" } }))
            const openaiCode: string = err?.error?.code || err?.error?.type || "unknown"
            const openaiMessage: string = err?.error?.message || "Unknown error"
            // Log the upstream status + code so production can distinguish the real
            // cause — a quota/billing failure, a transient rate limit, an auth/model
            // error, or a bad request all otherwise look identical to the user.
            console.error("OpenAI API error:", response.status, openaiCode, openaiMessage)
            await logAnalyzeFailure(auth.supabase, auth.user.id, `openai_${response.status}`, {
                upstreamStatus: response.status,
                openaiCode,
                openaiMessage,
                fileType: file.type,
                fileSizeKb: Math.round(file.size / 1024),
            })

            // Billing/quota exhaustion (OpenAI returns 429 with code
            // insufficient_quota). This is NOT transient — retrying won't help,
            // so tell the user plainly and DON'T advertise a retry.
            if (response.status === 429 && openaiCode === "insufficient_quota") {
                return NextResponse.json(
                    { error: "Document analysis is temporarily unavailable. Please type your details in the chat — it works exactly the same." },
                    { status: 503 }
                )
            }

            // Transient rate limit (TPM/RPM). Surface Retry-After so the client
            // can back off intelligently instead of a blind 5s retry.
            if (response.status === 429) {
                const retryAfter = response.headers.get("retry-after") || "15"
                return NextResponse.json(
                    { error: "AI service is busy. Please wait a moment and try again.", retryAfter: Number(retryAfter) || 15 },
                    { status: 429, headers: { "Retry-After": String(retryAfter) } }
                )
            }

            // Auth/model/config errors (401/403/404) are our fault, not transient.
            // Route the user to the manual path immediately rather than looping.
            if (response.status === 401 || response.status === 403 || response.status === 404) {
                return NextResponse.json(
                    { error: "Document analysis is temporarily unavailable. Please type your details in the chat instead." },
                    { status: 503 }
                )
            }

            return NextResponse.json({ error: "AI service temporarily unavailable. Please try again." }, { status: 502 })
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ""

        // Parse the JSON response
        let parsed: any = null
        try {
            const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
            parsed = JSON.parse(cleaned)
        } catch {
            console.error("Failed to parse OpenAI response:", content.slice(0, 500))
            return NextResponse.json({ error: "Could not process the file" }, { status: 422 })
        }

        // Sanitize all string values
        const sanitize = (val: any): any => {
            if (typeof val === "string") return val.replace(/<[^>]*>/g, "").trim()
            if (Array.isArray(val)) return val.map(sanitize)
            if (typeof val === "object" && val !== null) {
                const clean: any = {}
                for (const [k, v] of Object.entries(val)) clean[k] = sanitize(v)
                return clean
            }
            return val
        }
        const sanitized = sanitize(parsed)

        if (mode === "generate") {
            // Track usage after successful AI call
            await trackUsage(auth.supabase, auth.user.id, "generation", 0)

            // Return the full generated document
            return NextResponse.json({
                success: true,
                mode: "generate",
                document: sanitized.document || sanitized,
                message: sanitized.message || "Document generated from file.",
            })
        }

        // Track usage after successful AI call
        await trackUsage(auth.supabase, auth.user.id, "generation", 0)

        // Default: return extracted data
        return NextResponse.json({
            success: true,
            mode: "extract",
            extracted: sanitized,
            summary: buildFileContextSummary(sanitized),
            fieldsFound: Object.entries(sanitized).filter(([_, v]) => v !== null && v !== "").length,
        })
    } catch (error: any) {
        console.error("File analysis error:", error?.message || error)
        return NextResponse.json({ error: "Operation failed. Please try again." }, { status: 500 })
    }
}

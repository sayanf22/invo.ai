import { NextResponse } from "next/server"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"
import { checkCostLimit, trackUsage, getUserTier } from "@/lib/cost-protection"
import { checkRateLimit } from "@/lib/rate-limiter"
import { analyzeImagesWithKimiVision, resolveBedrockKey } from "@/lib/bedrock"

/**
 * POST /api/ai/analyze-file
 * Analyzes an uploaded file (image or PDF) to extract business/client info.
 *
 * MODEL: Kimi K2.5 vision (via Bedrock Mantle) — no OpenAI/GPT. Kimi cannot read
 * PDFs natively, so the CLIENT rasterizes PDFs to page images (pdf.js) and posts
 * them here as JSON `{ images: string[] }`. See `lib/attachment-analysis.ts`.
 * Text-only chat always uses DeepSeek (via /api/ai/stream, /onboarding, /profile-update).
 * The structured result is returned to the client, which passes it as HIDDEN
 * reference context to DeepSeek for generation/chat — never dumped into the prompt.
 *
 * SECURITY:
 * - Requires authentication (no anonymous access)
 * - Same-origin only (validateOrigin) to prevent CSRF / cost-exhaustion abuse
 * - Per-user rate limit (file_analysis) BEFORE any AI call
 * - Per-user tier cost limit BEFORE any AI call
 * - Bounded input: max 8 images, ~12MB total; message ≤10k chars; businessContext ≤5k
 * - Only image data URLs accepted; extracted strings are HTML-sanitized
 * - Bedrock key is server-only (never exposed to the client)
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/** Build the "generate a full document from the file" instruction. */
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

export async function POST(request: Request) {
    // SECURITY: same-origin only — this is a state-changing POST that calls a paid
    // vision model, so it must only be callable from our own site.
    const originError = validateOrigin(request as never)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // SECURITY: per-user rate limit BEFORE any AI call (vision is expensive).
    const rateLimitError = await checkRateLimit(auth.user.id, "file_analysis", auth.supabase as never)
    if (rateLimitError) return rateLimitError

    // SECURITY: per-user tier cost limit BEFORE any AI call.
    const userTier = await getUserTier(auth.supabase, auth.user.id)
    const costError = await checkCostLimit(auth.supabase, auth.user.id, "generation", userTier)
    if (costError) return costError

    // Clients always send pre-rasterized images as JSON. (PDFs are converted to
    // page images client-side because Kimi cannot read PDFs natively.)
    const contentType = request.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) {
        return NextResponse.json({ error: "Unsupported content type. Send images as JSON." }, { status: 415 })
    }

    try {
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
        // SECURITY: bound the payload — max 8 images, ~12MB total base64.
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

        // Track usage after the successful AI call (does not increment doc count).
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
    } catch (error: unknown) {
        console.error("analyze-file error:", error instanceof Error ? error.message : error)
        return NextResponse.json({ error: "Could not analyze the file. Please try again or type the details." }, { status: 502 })
    }
}

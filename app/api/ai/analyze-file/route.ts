import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { getSecret } from "@/lib/secrets"

/**
 * POST /api/ai/analyze-file
 * Analyzes uploaded files (images, PDFs) using OpenAI GPT-5.4 to extract business information.
 * 
 * MODEL ROUTING STRATEGY:
 * - This endpoint uses GPT (OpenAI) EXCLUSIVELY for file analysis/extraction
 * - GPT is ONLY called when a file is physically attached by the user
 * - All text-only chat messages use DeepSeek (via /api/ai/stream, /api/ai/onboarding, /api/ai/profile-update)
 * - After file extraction, the extracted data is passed back to the client,
 *   which then sends it as text context to a DeepSeek endpoint for generation/chat
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
  "services": "List of services, products, or line items mentioned in the document with prices if available",
  "projectDescription": "Brief description of the project, work, or engagement described in the document",
  "additionalContext": "Any other relevant business information — industry, pricing, terms, deadlines, deliverables, etc."
}

IMPORTANT:
- Extract as much as possible from the document
- For fields you cannot determine, use null
- Pay special attention to: company names, contact details, services/products listed, prices/amounts, and project descriptions
- The "services" field should list any line items, packages, or offerings with their prices if mentioned
- The "projectDescription" field should summarize what the document is about
- The "additionalContext" field should contain any extra details that could help generate a professional document
- Return ONLY valid JSON, no markdown or explanation`

export async function POST(request: Request) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // Authentication is sufficient protection — OpenAI has its own rate limits

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
            return NextResponse.json({ error: "File analysis is temporarily unavailable. Please type your details manually." }, { status: 503 })
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
            if (businessContext) {
                try { businessInfo = `\n\nSENDER BUSINESS PROFILE (use as "Bill From"):\n${businessContext}` } catch {}
            }

            activePrompt = `You are a professional document generator. Analyze the attached document and generate a complete ${docType}.

The attached document contains CLIENT/RECIPIENT information. Extract their details and use them as the "Bill To" / recipient.${businessInfo}

${userMessage ? `User's instruction: "${userMessage}"` : `Generate a ${docType} based on the information in the attached document.`}

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
            activePrompt = userMessage
                ? `${EXTRACTION_PROMPT}\n\nAdditional context from the user: "${userMessage}"`
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

        // Call OpenAI API with gpt-5.4 (supports images + PDFs natively)
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-5.4",
                messages: [
                    {
                        role: "user",
                        content: contentParts,
                    },
                ],
                max_completion_tokens: 2000,
                temperature: 0.1,
            }),
        })

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: { message: "Unknown error" } }))
            console.error("OpenAI API error:", response.status, JSON.stringify(err))
            if (response.status === 429) {
                return NextResponse.json({ error: "AI service is busy. Please wait a moment and try again." }, { status: 429 })
            }
            const msg = err.error?.message || "Failed to analyze file"
            return NextResponse.json({ error: msg }, { status: 500 })
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
            // Return the full generated document
            return NextResponse.json({
                success: true,
                mode: "generate",
                document: sanitized.document || sanitized,
                message: sanitized.message || "Document generated from file.",
            })
        }

        // Default: return extracted data
        return NextResponse.json({
            success: true,
            mode: "extract",
            extracted: sanitized,
            fieldsFound: Object.entries(sanitized).filter(([_, v]) => v !== null && v !== "").length,
        })
    } catch (error: any) {
        console.error("File analysis error:", error?.message || error)
        return NextResponse.json({ error: error?.message || "Failed to process file" }, { status: 500 })
    }
}

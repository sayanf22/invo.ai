import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { getSecret } from "@/lib/secrets"
import { checkRateLimit } from "@/lib/rate-limiter"

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

    // Rate limit: 5 file analyses per minute per user
    const rateLimitError = await checkRateLimit(auth.user.id, "ai")
    if (rateLimitError) return rateLimitError

    try {
        const formData = await request.formData()
        const file = formData.get("file") as File | null
        const userMessage = formData.get("message") as string | null

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

        const openaiKey = await getSecret("OPENAI_API_KEY", auth.supabase)
        if (!openaiKey) {
            console.error("OPENAI_API_KEY not found in environment or Supabase Vault")
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
        const promptText = userMessage
            ? `${EXTRACTION_PROMPT}\n\nAdditional context from the user: "${userMessage}"`
            : EXTRACTION_PROMPT

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

        // Call OpenAI API with gpt-5.4 (latest, supports images + PDFs natively)
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
            console.error("OpenAI API error:", JSON.stringify(err))
            const msg = err.error?.message || "Failed to analyze file"
            return NextResponse.json({ error: msg }, { status: 500 })
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ""

        // Parse the JSON response
        let extracted: any = null
        try {
            // Remove markdown code blocks if present
            const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
            extracted = JSON.parse(cleaned)
        } catch {
            console.error("Failed to parse OpenAI response:", content)
            return NextResponse.json({ error: "Could not extract information from file" }, { status: 422 })
        }

        // Sanitize extracted data — strip any HTML/script tags
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
        const sanitized = sanitize(extracted)

        return NextResponse.json({
            success: true,
            extracted: sanitized,
            fieldsFound: Object.entries(sanitized).filter(([_, v]) => v !== null && v !== "").length,
        })
    } catch (error: any) {
        console.error("File analysis error:", error?.message || error)
        return NextResponse.json({ error: error?.message || "Failed to process file" }, { status: 500 })
    }
}

import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

/**
 * POST /api/ai/analyze-file
 * Analyzes uploaded files (images, PDFs) using OpenAI Vision to extract business information.
 * Returns structured JSON with onboarding fields.
 */

const EXTRACTION_PROMPT = `You are a business information extraction AI. Analyze the provided document/image and extract ALL business information you can find.

Return a JSON object with these fields (use null for fields you cannot determine):

{
  "businessType": "freelancer|agency|ecommerce|professional|developer|other",
  "businessName": "Company/Business name",
  "ownerName": "Owner/Director name",
  "email": "Business email",
  "phone": "Phone number with country code",
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
  "paymentTerms": "net_15|net_30|net_45|net_60|due_on_receipt",
  "bankDetails": {
    "bankName": "Bank name",
    "accountNumber": "Account number",
    "ifscCode": "IFSC/SWIFT/routing code",
    "accountHolderName": "Name on account"
  },
  "additionalContext": "Any other relevant business information found in the document that could help generate better documents"
}

IMPORTANT:
- Extract as much as possible from the document
- For fields you cannot determine, use null
- The "additionalContext" field should contain any extra business details like services offered, industry, typical clients, etc.
- Return ONLY valid JSON, no markdown or explanation`

export async function POST(request: Request) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const formData = await request.formData()
        const file = formData.get("file") as File | null

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

        const openaiKey = process.env.OPENAI_API_KEY
        if (!openaiKey) {
            return NextResponse.json({ error: "OpenAI API not configured" }, { status: 500 })
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)))
        const mimeType = file.type

        // For PDFs, we need to tell OpenAI it's a document
        // OpenAI Vision supports images directly; for PDFs we send as image
        const imageUrl = `data:${mimeType};base64,${base64}`

        // Call OpenAI Vision API
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: EXTRACTION_PROMPT },
                            {
                                type: "image_url",
                                image_url: { url: imageUrl, detail: "high" },
                            },
                        ],
                    },
                ],
                max_tokens: 2000,
                temperature: 0.1,
            }),
        })

        if (!response.ok) {
            const err = await response.json()
            console.error("OpenAI API error:", err)
            return NextResponse.json({ error: "Failed to analyze file" }, { status: 500 })
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

        return NextResponse.json({
            success: true,
            extracted,
            fieldsFound: Object.entries(extracted).filter(([_, v]) => v !== null && v !== "").length,
        })
    } catch (error) {
        console.error("File analysis error:", error)
        return NextResponse.json({ error: "Failed to process file" }, { status: 500 })
    }
}

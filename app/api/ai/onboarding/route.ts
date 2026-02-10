/**
 * AI Onboarding API Route — Conversational Agent
 * 
 * Model: DeepSeek V3 (deepseek-chat) for FAST onboarding conversations
 * Note: deepseek-reasoner is reserved for invoice/contract GENERATION (slower but more accurate)
 * 
 * Accepts full conversation history + collected data.
 * Returns a natural assistant reply + newly extracted structured data.
 * Per project.md: "AI only extracts structured data from conversations. Never save the actual chat messages."
 * 
 * Key behaviors:
 * - If AI cannot understand an answer clearly → asks follow-up (needsClarification: true)
 * - Only saves data when 100% confident in the extraction
 * - Validates email, phone, country codes before saving
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"

// ── Types ──────────────────────────────────────────────────────────────

interface ChatMessage {
    role: "user" | "assistant"
    content: string
}

interface OnboardingAPIRequest {
    messages: ChatMessage[]
    collectedData: Record<string, unknown>
}

// ── System Prompt ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are **Invo AI**, a friendly onboarding assistant for Invo.ai — an AI-powered invoice & contract builder.

Your goal: collect business profile information through natural conversation. Ask ONE question at a time. Be warm, concise, and professional.

## Required Fields (collect all):
1. **businessType** — MUST be exactly one of: freelancer, developer, agency, ecommerce, professional, other
2. **country** — 2-letter ISO code. ONLY these are supported: IN, US, GB, DE, CA, AU, SG, AE, PH, FR, NL
3. **businessName** — company or individual name
4. **ownerName** — full legal name of the owner
5. **email** — valid email address (must contain @ and a domain)
6. **phone** — phone number WITH country code (e.g., +91-9876543210, +1-555-123-4567)
7. **address** — object with: street, city, state, postalCode (all required)
8. **taxId** — tax registration number (country-specific). Set to "" if user doesn't have one.
9. **clientCountries** — array of 2-letter ISO codes where clients are located (only from supported list)
10. **defaultCurrency** — 3-letter ISO currency code (INR, USD, GBP, EUR, CAD, AUD, SGD, AED, PHP, etc.)
11. **paymentTerms** — MUST be exactly one of: immediate, net_15, net_30, net_60

## Optional Fields:
- **paymentInstructions** — bank details, UPI, PayPal info, etc.

## CRITICAL FOLLOW-UP RULES:
You must be 100% sure about every piece of data before extracting it. Follow these rules strictly:

1. **If the user's answer is vague, unclear, or could mean multiple things → DO NOT extract. Ask a specific follow-up question instead.**
   - Example: User says "I work in tech" → DON'T extract businessType. Ask: "Great! Are you a freelance developer, part of an agency/studio, or running your own software business?"
   
2. **If the user gives a partial answer → extract what's clear, ask for what's missing.**
   - Example: User says "My company is TechSoft in Mumbai" → Extract businessName="TechSoft", address.city="Mumbai". Ask for full address.

3. **If a country name is ambiguous or not in the supported list → ask for clarification.**
   - Example: User says "I'm based in Europe" → Ask: "Which country specifically? We support UK, Germany, France, and Netherlands in Europe."

4. **For email: MUST contain @ and a domain. If invalid format → ask again.**

5. **For phone: MUST include country code. If missing → ask: "Could you include your country code? For example, +91 for India or +1 for USA."**

6. **For address: ALL four fields (street, city, state, postalCode) must be provided. If any are missing → ask specifically for the missing parts.**

7. **For taxId: Ask clearly "Do you have a tax registration number (like GSTIN for India, EIN for USA, VAT for UK)?" Accept "" if they say no.**

8. **For clientCountries: Only accept countries from the supported list. If user mentions unsupported countries, explain which countries are supported.**

9. **Auto-suggest currency based on country** (India → INR, USA → USD, UK → GBP, Germany/France/Netherlands → EUR, etc.) but confirm with user.

10. **For paymentTerms: If user says something like "30 days" → map to "net_30". If unclear → show options.**

## Response Format:
Respond with valid JSON (no markdown, no code fences):
{
  "message": "Your conversational reply to the user",
  "extractedData": { ... only NEWLY extracted fields with HIGH confidence ... },
  "needsClarification": false,
  "allFieldsComplete": false
}

### Rules for extractedData:
- ONLY include fields you are 100% confident about from the current message
- If you're NOT sure → set "needsClarification": true and ask in "message"
- Don't repeat already-collected data
- For address: {"address": {"street": "...", "city": "...", "state": "...", "postalCode": "..."}}
- For clientCountries: {"clientCountries": ["IN", "US"]}
- For taxId when user has none: {"taxId": ""}
- Extract MULTIPLE fields from one message when possible (e.g., "I'm a freelancer from India called TechSoft" → businessType, country, businessName)

### Rules for allFieldsComplete:
- Set true ONLY when ALL 11 required fields have been collected (check the Already Collected Data section)
- When all complete, summarize everything in your message and congratulate the user

IMPORTANT: Return ONLY the JSON object. No markdown wrapping, no extra text outside the JSON.`

// ── Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Authenticate user
        const auth = await authenticateRequest()
        if (auth.error) return auth.error

        // SECURITY: Rate limit (10 req/min for AI routes)
        const rateLimitError = await checkRateLimit(auth.user.id, "ai")
        if (rateLimitError) return rateLimitError

        const body: OnboardingAPIRequest = await request.json()

        // SECURITY: Input size limit (50KB)
        const sizeError = validateBodySize(body, 50 * 1024)
        if (sizeError) return sizeError

        const { messages, collectedData } = body

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: "Messages array is required" },
                { status: 400 }
            )
        }

        // SECURITY: Limit conversation length to prevent token abuse
        if (messages.length > 50) {
            return NextResponse.json(
                { error: "Conversation too long. Please start a new session." },
                { status: 400 }
            )
        }

        const apiKey = process.env.DEEPSEEK_API_KEY
        if (!apiKey || apiKey === "your_deepseek_api_key_here") {
            return NextResponse.json({
                message: "⚠️ AI is not configured yet. Please add your DEEPSEEK_API_KEY to the .env file. You can get a key at https://platform.deepseek.com/",
                extractedData: {},
                needsClarification: false,
                allFieldsComplete: false,
            })
        }

        const result = await callDeepSeek(messages, collectedData, apiKey)
        return NextResponse.json(result)

    } catch (error) {
        console.error("Onboarding AI error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// ── DeepSeek Call ───────────────────────────────────────────────────────

async function callDeepSeek(
    messages: ChatMessage[],
    collectedData: Record<string, unknown>,
    apiKey: string
) {
    // Build context of already collected data
    const collectedKeys = Object.keys(collectedData).filter(k => {
        const v = collectedData[k]
        if (v === null || v === undefined || v === "") return false
        if (Array.isArray(v)) return v.length > 0
        if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(val => val && String(val).trim().length > 0)
        return String(v).trim().length > 0
    })

    const allRequiredFields = [
        "businessType", "country", "businessName", "ownerName",
        "email", "phone", "address", "taxId",
        "clientCountries", "defaultCurrency", "paymentTerms"
    ]
    const missingFields = allRequiredFields.filter(f => !collectedKeys.includes(f))

    const collectedSummary = collectedKeys.length > 0
        ? `\n\n## Already Collected Data:\n${JSON.stringify(collectedData, null, 2)}\n\n## Still Missing Fields:\n${missingFields.join(", ")}\n\nDon't re-ask for fields that already have values. Focus on the NEXT missing required field: "${missingFields[0] || "NONE — all complete!"}".`
        : "\n\nNo data collected yet. Start by greeting the user warmly and asking about their business type."

    // Build OpenAI-compatible messages array
    const apiMessages = [
        { role: "system" as const, content: SYSTEM_PROMPT + collectedSummary },
        ...messages.map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
        }))
    ]

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: apiMessages,
                max_tokens: 1024,
                temperature: 0.3,
                response_format: { type: "json_object" },
            }),
        })

        if (!response.ok) {
            const errText = await response.text()
            console.error("DeepSeek API error:", response.status, errText)
            throw new Error(`DeepSeek API error: ${response.status}`)
        }

        const data = await response.json()
        const text = data.choices?.[0]?.message?.content || ""

        // Parse JSON response
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            return {
                message: "I didn't quite catch that. Could you try rephrasing?",
                extractedData: {},
                needsClarification: true,
                allFieldsComplete: false,
            }
        }

        const parsed = JSON.parse(jsonMatch[0])

        // Validate extracted data before returning
        const validatedData = validateExtractedData(parsed.extractedData || {})

        return {
            message: parsed.message || "Could you tell me more?",
            extractedData: validatedData,
            needsClarification: parsed.needsClarification || false,
            allFieldsComplete: parsed.allFieldsComplete || false,
        }

    } catch (error) {
        console.error("DeepSeek call failed:", error)
        return {
            message: "I'm having a connection issue. Please try again in a moment.",
            extractedData: {},
            needsClarification: false,
            allFieldsComplete: false,
        }
    }
}

// ── Server-side Validation ─────────────────────────────────────────────

const SUPPORTED_COUNTRIES = ["IN", "US", "GB", "DE", "CA", "AU", "SG", "AE", "PH", "FR", "NL"]
const VALID_BUSINESS_TYPES = ["freelancer", "developer", "agency", "ecommerce", "professional", "other"]
const VALID_PAYMENT_TERMS = ["immediate", "net_15", "net_30", "net_60"]

function validateExtractedData(data: Record<string, unknown>): Record<string, unknown> {
    const validated: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(data)) {
        switch (key) {
            case "businessType":
                if (typeof value === "string" && VALID_BUSINESS_TYPES.includes(value.toLowerCase())) {
                    validated.businessType = value.toLowerCase()
                }
                break

            case "country":
                if (typeof value === "string" && SUPPORTED_COUNTRIES.includes(value.toUpperCase())) {
                    validated.country = value.toUpperCase()
                }
                break

            case "email":
                if (typeof value === "string" && value.includes("@") && value.includes(".")) {
                    validated.email = value.trim().toLowerCase()
                }
                break

            case "phone":
                if (typeof value === "string" && value.trim().length >= 8) {
                    validated.phone = value.trim()
                }
                break

            case "clientCountries":
                if (Array.isArray(value)) {
                    const validCountries = value
                        .map((c: string) => String(c).toUpperCase())
                        .filter(c => SUPPORTED_COUNTRIES.includes(c))
                    if (validCountries.length > 0) {
                        validated.clientCountries = validCountries
                    }
                }
                break

            case "paymentTerms":
                if (typeof value === "string" && VALID_PAYMENT_TERMS.includes(value.toLowerCase())) {
                    validated.paymentTerms = value.toLowerCase()
                }
                break

            case "address":
                if (typeof value === "object" && value !== null) {
                    const addr = value as Record<string, string>
                    // Only include if at least city or street is provided
                    if (addr.city || addr.street) {
                        validated.address = {
                            street: addr.street || "",
                            city: addr.city || "",
                            state: addr.state || "",
                            postalCode: addr.postalCode || addr.postal_code || "",
                        }
                    }
                }
                break

            case "defaultCurrency":
                if (typeof value === "string" && value.trim().length === 3) {
                    validated.defaultCurrency = value.toUpperCase()
                }
                break

            case "taxId":
                // Accept empty string (user has no tax ID) or actual value
                if (typeof value === "string") {
                    validated.taxId = value.trim()
                }
                break

            case "businessName":
            case "ownerName":
                if (typeof value === "string" && value.trim().length > 0) {
                    validated[key] = value.trim()
                }
                break

            case "paymentInstructions":
                if (typeof value === "string" && value.trim().length > 0) {
                    validated.paymentInstructions = value.trim()
                }
                break

            default:
                // Ignore unknown fields
                break
        }
    }

    return validated
}

/**
 * POST /api/ai/profile-update
 * AI-powered profile update endpoint.
 * 
 * MODEL ROUTING: This endpoint ALWAYS uses DeepSeek V3 Chat.
 * GPT is NEVER called here — GPT is only used in /api/ai/analyze-file when a file is attached.
 * Text-only messages always route to DeepSeek. After a file is processed by GPT,
 * the next text message comes back here to DeepSeek.
 * 
 * Smart context detection: Receives the current profile, analyzes what's
 * already filled vs. missing/outdated, and only asks about gaps or changes.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { checkCostLimit, trackUsage } from "@/lib/cost-protection"
import type { UserTier } from "@/lib/cost-protection"
import { sanitizeText } from "@/lib/sanitize"

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"

interface ChatMessage {
    role: "user" | "assistant"
    content: string
}

interface ProfileUpdateRequest {
    messages: ChatMessage[]
    currentProfile: Record<string, unknown>
    fileExtracted?: Record<string, unknown>
    /** Optional: restrict AI to only update fields in this section */
    section?: string
}

// Section-to-fields mapping for focused editing
const SECTION_FIELDS: Record<string, { label: string; fields: string[]; description: string }> = {
    business: {
        label: "Business Information",
        fields: ["businessName", "businessType", "ownerName", "country"],
        description: "business name, business type (freelancer/agency/ecommerce/professional/developer/other), owner name, and country (2-letter code)",
    },
    contact: {
        label: "Contact Information",
        fields: ["email", "phone"],
        description: "email address and phone number (with country code)",
    },
    address: {
        label: "Business Address",
        fields: ["address"],
        description: "street address, city, state/province, and postal code as an address object: { street, city, state, postalCode }",
    },
    tax: {
        label: "Tax & Compliance",
        fields: ["taxId", "clientCountries"],
        description: "tax ID (GST/VAT/Sales Tax number) and client countries (array of 2-letter country codes)",
    },
    payment: {
        label: "Payment Settings",
        fields: ["defaultCurrency", "paymentTerms", "paymentInstructions", "bankDetails"],
        description: "default currency (3-letter code), payment terms (net_7/net_15/net_30/net_45/net_60/due_on_receipt/immediate), payment instructions, and bank details ({ bankName, accountNumber, ifscCode, swiftCode, routingNumber, accountName })",
    },
    notes: {
        label: "Additional Notes",
        fields: ["additionalNotes"],
        description: "additional business notes, descriptions, pricing info, or any other relevant details",
    },
}

function buildSystemPrompt(profile: Record<string, unknown>, section?: string): string {
    // Build a summary of what's already in the profile
    const filled: string[] = []
    const missing: string[] = []

    const check = (key: string, label: string, val: unknown) => {
        if (val && typeof val === "string" && val.trim()) filled.push(`${label}: ${val}`)
        else if (val && typeof val === "object" && !Array.isArray(val) && Object.values(val as Record<string, unknown>).some(v => v && String(v).trim())) filled.push(`${label}: provided`)
        else if (val && Array.isArray(val) && val.length > 0) filled.push(`${label}: ${val.join(", ")}`)
        else missing.push(label)
    }

    check("name", "Business Name", profile.name)
    check("business_type", "Business Type", profile.business_type)
    check("owner_name", "Owner Name", profile.owner_name)
    check("email", "Email", profile.email)
    check("phone", "Phone", profile.phone)
    check("country", "Country", profile.country)

    // Show address fields individually so AI knows exactly what's filled
    const addr = profile.address as Record<string, string> | undefined
    if (addr) {
        if (addr.street && addr.street.trim()) filled.push(`Street: ${addr.street}`)
        else missing.push("Street Address")
        if (addr.city && addr.city.trim()) filled.push(`City: ${addr.city}`)
        else missing.push("City")
        if (addr.state && addr.state.trim()) filled.push(`State: ${addr.state}`)
        else missing.push("State/Province")
        if ((addr.postal_code || addr.postalCode) && (addr.postal_code || addr.postalCode).trim()) filled.push(`Postal Code: ${addr.postal_code || addr.postalCode}`)
        else missing.push("Postal Code")
    } else {
        missing.push("Address (street, city, state, postal code)")
    }

    check("tax_ids", "Tax ID", profile.tax_ids)
    check("client_countries", "Client Countries", profile.client_countries)
    check("default_currency", "Currency", profile.default_currency)
    check("default_payment_terms", "Payment Terms", profile.default_payment_terms)

    check("default_payment_instructions", "Payment Instructions", profile.default_payment_instructions)

    const bank = (profile.payment_methods as any)?.bank
    if (bank && (bank.bankName || bank.accountNumber)) filled.push("Bank Details: provided")
    else missing.push("Bank Details")

    if (profile.additional_notes && String(profile.additional_notes).trim()) filled.push("Additional Notes: provided")
    else missing.push("Additional Notes")

    const filledStr = filled.length > 0 ? filled.join("\n  ") : "None"
    const missingStr = missing.length > 0 ? missing.join(", ") : "None"

    // Section-specific mode: constrain AI to only the relevant fields
    if (section && SECTION_FIELDS[section]) {
        const sec = SECTION_FIELDS[section]
        const allowedFields = sec.fields
        return `You are Clorefy AI — a profile update assistant. The user is editing their ${sec.label}.

## CURRENT VALUES
${filled.filter(f => {
    const fieldLabels: Record<string, string[]> = {
        business: ["Business Name", "Business Type", "Owner Name", "Country"],
        contact: ["Email", "Phone"],
        address: ["Street", "City", "State", "Postal Code"],
        tax: ["Tax ID", "Client Countries"],
        payment: ["Currency", "Payment Terms", "Payment Instructions", "Bank Details"],
        notes: ["Additional Notes"],
    }
    return (fieldLabels[section] || []).some(label => f.startsWith(label))
}).join("\n  ") || "None set"}

## CRITICAL EXTRACTION RULES
1. ALWAYS extract data from the user's message. If the user says ANY value, put it in extractedData IMMEDIATELY. Do NOT just chat — you MUST extract.
2. needsClarification should be false 95% of the time. Only set it to true when the user's answer is genuinely ambiguous (e.g., they said "yes" but you don't know what field they mean).
3. Examples of when to EXTRACT (needsClarification: false):
   - "Tripura" when editing address → extractedData: { "address": { "state": "Tripura" } }
   - "change email to test@example.com" → extractedData: { "email": "test@example.com" }
   - "net 30" → extractedData: { "paymentTerms": "net_30" }
   - "Kolkata 700001" → extractedData: { "address": { "city": "Kolkata", "postalCode": "700001" } }
   - "freelancer" → extractedData: { "businessType": "freelancer" }
4. Examples of when to CLARIFY (needsClarification: true):
   - User says "change it" but didn't specify what or to what value
   - User says a single word that could mean multiple different fields
5. When you extract, confirm briefly: "Updated state to Tripura ✅" — then ask about the next empty field if any.
6. You are ONLY updating ${sec.label}. The ONLY fields you can extract: ${sec.description}

## MERGE RULES
- NEVER set a field to null or empty string if it already has a value in the current profile.
- Only include fields in extractedData that the user explicitly mentioned or that were extracted from a document.
- New data supplements existing data — it does not replace it.
- For nested objects (address, bankDetails), only include the sub-fields being changed.

## RESPONSE FORMAT
Always respond with valid JSON:
{
  "message": "Brief confirmation + next question if needed",
  "extractedData": { ...extracted fields... },
  "needsClarification": false,
  "allFieldsComplete": false
}

IMPORTANT: extractedData must contain the fields EVERY TIME the user provides a value. An empty extractedData when the user gave you data is a BUG.`
    }

    return `You are Clorefy AI — a profile update assistant. The user wants to update their business profile.

## CURRENT PROFILE STATUS
Already filled:
  ${filledStr}

Missing fields: ${missingStr}

## CRITICAL EXTRACTION RULES
1. ALWAYS extract data from the user's message. If the user says ANY value, put it in extractedData IMMEDIATELY.
2. needsClarification should be false 95% of the time. Only set true when the answer is genuinely ambiguous.
3. When you extract, confirm briefly: "Updated email to new@example.com ✅" — then ask about the next thing.
4. If the user uploads a document, acknowledge what was extracted and confirm.
5. If the user says "everything looks good" or "done", set allFieldsComplete to true.
6. Be concise — 1-2 sentences max per response.

## MERGE RULES
- NEVER set a field to null or empty string if it already has a value in the current profile.
- Only include fields in extractedData that the user explicitly mentioned or that were extracted from a document.
- New data supplements existing data — it does not replace it.
- For nested objects (address, bankDetails), only include the sub-fields being changed.

## EXTRACTION FIELDS
- businessType, businessName, ownerName, email, phone, country
- address: { street, city, state, postalCode }
- taxId, clientCountries (array of 2-letter codes)
- defaultCurrency, paymentTerms, paymentInstructions
- bankDetails: { bankName, accountNumber, ifscCode, swiftCode, routingNumber, accountName }
- additionalNotes

## RESPONSE FORMAT
Always respond with valid JSON:
{
  "message": "Your conversational response to the user",
  "extractedData": { ...only fields that were mentioned/changed... },
  "needsClarification": false,
  "allFieldsComplete": false
}

Set allFieldsComplete to true when the user confirms they're done updating.
Set needsClarification to true when you need more info before saving a field.
Only include fields in extractedData that the user explicitly mentioned or that were extracted from a document.`
}

export async function POST(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // Fetch user tier from subscriptions table, default to "free"
    const { data: subscription } = await (auth.supabase as any)
        .from("subscriptions")
        .select("plan")
        .eq("user_id", auth.user.id)
        .single()
    const userTier: UserTier = (subscription?.plan as UserTier) || "free"

    // Block free-tier users from AI profile editing
    if (userTier === "free") {
        return NextResponse.json(
            {
                error: "AI profile editing requires a paid plan",
                tier: "free",
                message: "Upgrade to Starter to use AI-powered profile editing",
            },
            { status: 403 }
        )
    }

    const costError = await checkCostLimit(auth.supabase, auth.user.id, "onboarding", userTier)
    if (costError) return costError

    const body: ProfileUpdateRequest = await request.json()

    const sizeError = validateBodySize(body, 50 * 1024)
    if (sizeError) return sizeError

    if (!body.messages || !Array.isArray(body.messages)) {
        return NextResponse.json({ error: "Messages array required" }, { status: 400 })
    }

    try {
        const systemPrompt = buildSystemPrompt(body.currentProfile || {}, body.section)

        // If file data was extracted, prepend it as context
        const messages: Array<{ role: string; content: string }> = [
            { role: "system", content: systemPrompt },
        ]

        if (body.fileExtracted) {
            const extractedSummary = Object.entries(body.fileExtracted)
                .filter(([_, v]) => v !== null && v !== "")
                .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                .join("\n")
            if (extractedSummary) {
                messages.push({
                    role: "system",
                    content: `[FILE EXTRACTION CONTEXT] The user uploaded a document and the system extracted:\n${extractedSummary}\n\nAcknowledge what was found and ask the user to confirm the changes.`
                })
            }
        }

        // Add conversation history (sanitized)
        for (const msg of body.messages.slice(-15)) {
            messages.push({
                role: msg.role,
                content: sanitizeText(msg.content),
            })
        }

        const { getSecret } = await import("@/lib/secrets")
        const apiKey = await getSecret("DEEPSEEK_API_KEY")
        if (!apiKey) {
            return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
        }

        const response = await fetch(DEEPSEEK_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages,
                temperature: 0.3,
                max_tokens: 1000,
                response_format: { type: "json_object" },
            }),
        })

        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            console.error("DeepSeek API error:", err)
            return NextResponse.json({ error: "AI service error" }, { status: 502 })
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ""

        let parsed: any
        try {
            parsed = JSON.parse(content)
        } catch {
            parsed = { message: content, extractedData: {}, needsClarification: false, allFieldsComplete: false }
        }

        await trackUsage(auth.supabase, auth.user.id, "onboarding", 0)

        return NextResponse.json({
            message: parsed.message || "",
            extractedData: parsed.extractedData || {},
            needsClarification: parsed.needsClarification || false,
            allFieldsComplete: parsed.allFieldsComplete || false,
        })
    } catch (error: any) {
        console.error("Profile update AI error:", error?.message || error)
        return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
    }
}

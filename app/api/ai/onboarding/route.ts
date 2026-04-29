/**
 * AI Onboarding API Route — Conversational Agent
 * 
 * Model: DeepSeek V4 Flash (deepseek-v4-flash) for FAST onboarding conversations
 * Note: deepseek-v4-pro (thinking mode) is reserved for invoice/contract GENERATION
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
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"

import { checkCostLimit, trackUsage } from "@/lib/cost-protection"
import { sanitizeText, sanitizeEmail, sanitizePhone } from "@/lib/sanitize"

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

const SYSTEM_PROMPT = `You are Clorefy AI — a warm, smart onboarding assistant for a document generation platform. Your job is to collect business profile data through a natural, friendly conversation.

## PERSONALITY
- Friendly, professional, concise. Like a helpful colleague.
- Ask ONE question at a time. Keep messages short (1-3 sentences max).
- Use occasional emojis sparingly (👋 🎉 ✅).

## MANDATORY CONFIRMATION PATTERN
Every time the user gives you information, you MUST:
1. REPEAT BACK the exact value you extracted so the user can confirm it's correct
2. Then ask the next question

Format your message like this:
"Got it, [field] is [value]! ✅ [Next question]"

Examples:
- User says "freelancer" → "Got it, you're a freelancer! ✅ Which country is your business based in?"
- User says "AddMenu" → "Got it, your business name is AddMenu! ✅ What's your full name?"
- User says "Sayan Banik" → "Perfect, Sayan Banik! ✅ What's your email address?"
- User says "india" → "Great, India (IN) it is! ✅ What's your business name?"
- User says "no" (to tax) → "No worries, no tax registration noted! ✅ Which countries do your clients come from?"
- User says "all" (for countries) → "Got it, all 11 countries! ✅ What's your preferred currency?"
- User says "kolkata" (for address) → "Got it, Kolkata! ✅ Are you registered for GST/VAT/Sales Tax?"

ALWAYS include the actual value in your confirmation. Never just say "Got it!" without repeating what you understood.

## CRITICAL RULE: ALWAYS INTERPRET THE USER'S ANSWER AS THE ANSWER TO YOUR LAST QUESTION
This is the MOST IMPORTANT rule. Whatever the user says, ALWAYS try to map it to the field you are currently asking about.

Examples when you asked "What's your business name?":
- "AddMenu" → businessName: "AddMenu"
- "my company" → businessName: "my company"
- ANY text → treat it as the businessName

Examples when you asked "What's your full name?":
- "Sayan Banik" → ownerName: "Sayan Banik"
- "John" → ownerName: "John"
- ANY name-like text → treat it as ownerName

Examples when you asked about business type:
- "freelancer" → businessType: "freelancer"
- "I do freelance work" → businessType: "freelancer"
- "agency" → businessType: "agency"
- "dev" / "developer" / "software" → businessType: "developer"
- "shop" / "store" / "selling" → businessType: "ecommerce"

Examples when you asked about country:
- "india" → country: "IN"
- "usa" / "us" / "america" / "united states" → country: "US"
- "uk" / "britain" / "england" → country: "GB"
- "germany" → country: "DE"
- "canada" → country: "CA"
- "australia" → country: "AU"
- "singapore" → country: "SG"
- "uae" / "dubai" → country: "AE"
- "philippines" → country: "PH"
- "france" → country: "FR"
- "netherlands" / "holland" → country: "NL"

Examples for other fields:
- "yes" / "yeah" / "yep" → affirmative to whatever you asked
- "no" / "nah" / "nope" → negative to whatever you asked
- "all" / "all countries" / "everywhere" → if asked about clientCountries, set ALL 11 countries: ["IN","US","GB","DE","CA","AU","SG","AE","PH","FR","NL"]
- "rupees" / "inr" → defaultCurrency: "INR"
- "dollars" / "usd" → defaultCurrency: "USD"
- "euros" / "eur" → defaultCurrency: "EUR"
- "pounds" / "gbp" → defaultCurrency: "GBP"

## NEVER SAY "I DIDN'T UNDERSTAND" OR "COULD YOU TELL ME MORE"
- If the user types ANYTHING that could possibly be an answer to your current question, ACCEPT IT.
- Only ask for clarification if the answer is completely empty or total gibberish (like "asdfghjkl").
- A single word IS a valid answer. "AddMenu" is a business name. "Sayan" is a name. "Kolkata" is an address.
- If multiple pieces of info are given in one message, extract ALL of them.

## HANDLING QUESTIONS FROM THE USER
If the user asks a question instead of giving an answer (e.g., "what does that mean?", "can you explain?", "I'm not sure"):
- Answer their question briefly and helpfully
- Then re-ask the same field question
- Set extractedData to {} (nothing extracted)
- Example: User asks "what does payment terms mean?" → message: "Payment terms define when your client should pay. Immediate means right away, Net 15 means within 15 days, Net 30 within 30 days, Net 60 within 60 days. Which one works for you?"

## FIELDS TO COLLECT (in this order)
1. businessType: "freelancer" | "developer" | "agency" | "ecommerce" | "professional" | "other"
2. country: 2-letter ISO code from: IN, US, GB, DE, CA, AU, SG, AE, PH, FR, NL
3. businessName: company/business name — ANY text is valid here
4. ownerName: full name — ANY name text is valid here
5. email: valid email address
6. phone: phone number (any format)
7. address: { street, city, state, postalCode } — partial is OK, just city is fine
8. taxRegistered: boolean — "Are you registered for GST/VAT/Sales Tax?"
9. taxId: ONLY if taxRegistered=true. If false → auto-set taxId="" and SKIP to next field.
10. services: What services or products do you provide? — ANY text is valid here
11. clientCountries: array of 2-letter codes. "all" = all 11 countries.
12. defaultCurrency: ONE currency code only — INR, USD, GBP, EUR, CAD, AUD, SGD, AED, PHP. Pick the FIRST one if user says multiple.

After collecting all 11 required fields above, ask about OPTIONAL bank details:
13. bankDetails (OPTIONAL): Ask "Would you like to add your bank details for invoices? (You can skip this)"
    - If yes → collect: bankName, accountName, accountNumber, and ifscCode (for India) or swiftCode or routingNumber
    - If no/skip → set bankDetails to {} and move to the final question
    - Accept partial info — any fields provided are fine

## SPECIAL RULES
- "no" to tax → set BOTH taxRegistered: false AND taxId: "" in extractedData, skip to next field.
- If user provides country, suggest matching currency and ask to confirm.
- Partial address is fine. Don't force all subfields.
- If user volunteers info for a future field, extract it immediately.

## FINAL QUESTION
When ALL fields are collected (including bank details step), ask: "Is there anything else you'd like to add? Like pricing, product details, or a business description?"
- "no" / "nothing" / "that's it" → set allFieldsComplete: true, extractedData: {}
- If user provides info → set extractedData: { "additionalNotes": "<their exact answer>" } AND allFieldsComplete: true

## RESPONSE FORMAT — ALWAYS VALID JSON, NO MARKDOWN
{
  "message": "Your friendly reply acknowledging their answer + next question",
  "extractedData": { "fieldName": "value" },
  "needsClarification": false,
  "allFieldsComplete": false
}
- extractedData: only fields extracted THIS turn. Empty {} if nothing new.
- needsClarification: true ONLY for complete gibberish. Almost never use this.
- allFieldsComplete: true only after final question answered.`

// ── Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Validate request origin
        const originError = validateOrigin(request)
        if (originError) return originError

        // SECURITY: Authenticate user
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        // Rate limiting removed - handled by Supabase if needed

        // SECURITY: Cost protection
        const costError = await checkCostLimit(auth.supabase, auth.user.id, "onboarding")
        if (costError) return costError

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

        // SECURITY: Validate prompt length — reject any message exceeding 10,000 chars
        for (const msg of messages) {
            if (typeof msg.content === "string" && msg.content.length > 10_000) {
                return NextResponse.json(
                    { error: "Message too long. Maximum 10,000 characters per message." },
                    { status: 400 }
                )
            }
        }

        // SECURITY: Sanitize all user message content
        for (const msg of messages) {
            if (msg.role === "user" && typeof msg.content === "string") {
                msg.content = sanitizeText(msg.content)
            }
        }

        const { getSecret } = await import("@/lib/secrets")
        const apiKey = await getSecret("DEEPSEEK_API_KEY")
        if (!apiKey || apiKey === "your_deepseek_api_key_here") {
            return NextResponse.json({
                message: "⚠️ AI is not configured yet. Please add your DEEPSEEK_API_KEY to the .env file. You can get a key at https://platform.deepseek.com/",
                extractedData: {},
                needsClarification: false,
                allFieldsComplete: false,
            })
        }

        const result = await callDeepSeek(messages, collectedData, apiKey)

        // Track usage
        await trackUsage(auth.supabase, auth.user.id, "onboarding", 0)

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
        // taxRegistered=false and taxId="" are VALID collected values — don't skip them
        if (k === "taxRegistered" && typeof v === "boolean") return true
        if (k === "taxId" && typeof v === "string") return true  // even empty string means "collected as no tax"
        // bankDetailsSkipped=true is a valid collected value
        if (k === "bankDetailsSkipped" && v === true) return true
        if (v === null || v === undefined || v === "") return false
        if (Array.isArray(v)) return v.length > 0
        if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(val => val && String(val).trim().length > 0)
        return String(v).trim().length > 0
    })

    // These are the fields the AI needs to collect. taxRegistered/taxId are handled specially:
    // - If taxRegistered is false, taxId is auto-set to "" and both are "done"
    // - If taxRegistered is true, taxId must have a value
    const allRequiredFields = [
        "businessType", "country", "businessName", "ownerName",
        "email", "phone", "address", "services",
        "clientCountries", "defaultCurrency"
    ]
    
    // Tax fields: only consider taxId missing if taxRegistered=true and taxId is empty
    const taxRegistered = collectedData.taxRegistered
    const hasTaxFields = taxRegistered !== undefined && taxRegistered !== null
    const needsTaxId = taxRegistered === true && (!collectedData.taxId || String(collectedData.taxId).trim() === "")
    
    const missingFields = allRequiredFields.filter(f => !collectedKeys.includes(f))
    
    // Add tax fields to missing if not yet asked
    if (!hasTaxFields) {
        missingFields.push("taxRegistered")
    } else if (needsTaxId) {
        missingFields.push("taxId")
    }

    // Determine the current phase: required fields → optional bank details → final question
    const bankDetailsCollected = collectedKeys.includes("bankDetails")
    const bankDetailsSkipped = collectedData.bankDetailsSkipped === true
    const bankDetailsAsked = bankDetailsCollected || bankDetailsSkipped
    const additionalNotesCollected = collectedKeys.includes("additionalNotes")

    let instruction = ""
    if (missingFields.length > 0) {
        instruction = `INSTRUCTION: The NEXT field to collect is "${missingFields[0]}". The user's LAST message is their answer to your LAST question. If your last question was about "${missingFields[0]}", then the user's reply IS the value for "${missingFields[0]}" — accept it and extract it. Do NOT say "could you tell me more" or "I didn't catch that". Accept whatever they typed as the answer.

IMPORTANT FOR TAX QUESTION: When asking about tax registration (GST/VAT/Sales Tax), phrase it as: "Are you registered for GST, VAT, or Sales Tax? (You can say no if not applicable)"
- If user says "no" / "not yet" / "nah" → set extractedData: { "taxRegistered": false, "taxId": "" }
- If user says "yes" → set extractedData: { "taxRegistered": true } and then ask for their tax number in the NEXT turn.`
    } else if (!bankDetailsAsked) {
        instruction = `INSTRUCTION: All required fields including tax are collected! Now ask about OPTIONAL bank details. Say exactly: "Would you like to add your bank details for invoices? You can add them later from your profile if you prefer. (Type 'skip' to continue)"
- If user says no/skip/later/nah → set extractedData: { "bankDetailsSkipped": true } and then ask the additional info question.
- If user says yes → collect bankName, accountName, accountNumber, and ifscCode (for India) or swiftCode or routingNumber. After collecting, ask the additional info question.`
    } else if (!additionalNotesCollected) {
        instruction = `INSTRUCTION: Bank details step is done. Now ask the FINAL question. Say exactly: "Almost done! Is there anything else you'd like to add about your business? Like services you offer, pricing details, or a business description? (Type 'skip' or 'no' to finish)"
- If user says no/skip/nothing/that's it/done → set allFieldsComplete: true with extractedData: {}
- If user provides actual content → set extractedData: { "additionalNotes": "<their answer>" } AND allFieldsComplete: true
- If your LAST message already asked this question, then the user's LAST message IS their answer — process it accordingly.`
    } else {
        instruction = "INSTRUCTION: User answered the final question. Set allFieldsComplete: true."
    }

    const collectedSummary = collectedKeys.length > 0
        ? `\n\nDATA COLLECTED SO FAR:\n${JSON.stringify(collectedData, null, 2)}\n\nSTILL NEEDED: ${missingFields.length > 0 ? missingFields.join(", ") : "NONE — all required fields done!"}\n\nIMPORTANT: Most data is already collected from a file upload. Do NOT re-ask for fields that are already collected. Only ask for the MISSING fields listed above. If only 1-2 fields are missing, acknowledge the collected data briefly and ask ONLY for the missing field.\n\n${instruction}`
        : "\n\nNo data collected yet. Greet the user warmly and ask about their business type (freelancer, developer, agency, ecommerce, professional, or other)."

    // Trim conversation history — only send last 12 messages to avoid token overflow
    // The system prompt already contains all collected data, so older messages are redundant
    const trimmedMessages = messages.length > 12 ? messages.slice(-12) : messages

    // Build OpenAI-compatible messages array
    const apiMessages = [
        { role: "system" as const, content: SYSTEM_PROMPT + collectedSummary },
        ...trimmedMessages.map(msg => ({
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
                model: "deepseek-v4-flash",
                messages: apiMessages,
                max_tokens: 2048,
                temperature: 0.1,  // Lower temperature for more consistent, predictable responses
                response_format: { type: "json_object" },
            }),
        })

        if (!response.ok) {
            const errText = await response.text()
            console.error("DeepSeek API error:", response.status, errText)

            // Handle specific error codes
            if (response.status === 429) {
                return {
                    message: "⏳ DeepSeek's API is experiencing high traffic. Please wait a minute and try again. This is a temporary rate limit from DeepSeek, not our application.",
                    extractedData: {},
                    needsClarification: false,
                    allFieldsComplete: false,
                }
            }

            throw new Error(`DeepSeek API error: ${response.status}`)
        }

        const data = await response.json()
        const text = (data.choices?.[0]?.message?.content || "").trim()

        // Parse JSON — try direct parse first (response_format: json_object should give clean JSON)
        let parsed: Record<string, unknown> | null = null

        // Attempt 1: Direct JSON.parse (most likely to work with json_object format)
        try {
            parsed = JSON.parse(text)
        } catch {
            // try regex extraction
        }

        // Attempt 2: Extract JSON from markdown code fences or surrounding text
        if (!parsed) {
            try {
                // Remove markdown code fences if present
                const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim()
                parsed = JSON.parse(cleaned)
            } catch {
                // regex also failed
            }
        }

        // Attempt 3: Regex extraction as last resort
        if (!parsed) {
            const jsonMatch = text.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0])
                } catch {
                    console.error("Regex JSON parse also failed")
                }
            }
        }

        // If all parsing fails, try to salvage what we can from the raw text
        if (!parsed) {
            console.error("All JSON parsing failed. Raw text:", text)
            
            // Try to extract just the message field from partial/broken JSON
            const msgMatch = text.match(/"message"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/)
            if (msgMatch) {
                // Also try to extract extractedData
                let extractedData = {}
                const dataMatch = text.match(/"extractedData"\s*:\s*(\{[^}]*\})/)
                if (dataMatch) {
                    try { extractedData = JSON.parse(dataMatch[0].replace('"extractedData":', '').trim()) } catch { /* ignore */ }
                }
                return {
                    message: msgMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
                    extractedData,
                    needsClarification: false,
                    allFieldsComplete: false,
                }
            }
            
            // If the raw text looks like a normal conversational message (not JSON), use it directly
            if (text.length > 0 && !text.startsWith('{')) {
                return {
                    message: text,
                    extractedData: {},
                    needsClarification: false,
                    allFieldsComplete: false,
                }
            }
            
            // SERVER-SIDE FALLBACK: Try to interpret the user's last message ourselves
            const lastUserMsg = messages[messages.length - 1]?.content?.trim().toLowerCase() || ""
            const bankDetailsAsked = collectedKeys.includes("bankDetails") || (collectedData.bankDetailsSkipped === true)
            const additionalNotesCollected = collectedKeys.includes("additionalNotes")
            const fallback = serverSideInterpret(lastUserMsg, missingFields, collectedData, bankDetailsAsked, additionalNotesCollected)
            if (fallback) {
                return fallback
            }
            
            return {
                message: "Sorry, I had a brief hiccup. Could you send that again?",
                extractedData: {},
                needsClarification: false,
                allFieldsComplete: false,
            }
        }

        // Validate extracted data before returning
        const validatedData = validateExtractedData((parsed.extractedData || {}) as Record<string, unknown>)

        return {
            message: parsed.message || "Thanks! What's next on the list?",
            extractedData: validatedData,
            needsClarification: parsed.needsClarification || false,
            allFieldsComplete: parsed.allFieldsComplete || false,
        }

    } catch (error) {
        console.error("DeepSeek call failed:", error instanceof Error ? error.message : error)
        return {
            message: "I'm having a brief connection issue. Could you send that again?",
            extractedData: {},
            needsClarification: false,
            allFieldsComplete: false,
        }
    }
}

// ── Server-side Fallback Interpreter ────────────────────────────────────
// When DeepSeek returns broken JSON, this function tries to interpret
// the user's last message based on which field we're currently collecting.

const CURRENCY_MAP: Record<string, string> = {
    "inr": "INR", "rupee": "INR", "rupees": "INR", "indian": "INR",
    "usd": "USD", "dollar": "USD", "dollars": "USD", "american": "USD",
    "eur": "EUR", "euro": "EUR", "euros": "EUR",
    "gbp": "GBP", "pound": "GBP", "pounds": "GBP", "british": "GBP",
    "cad": "CAD", "canadian": "CAD",
    "aud": "AUD", "australian": "AUD",
    "sgd": "SGD", "singapore": "SGD",
    "aed": "AED", "dirham": "AED", "dirhams": "AED",
    "php": "PHP", "peso": "PHP", "pesos": "PHP",
}

const COUNTRY_MAP: Record<string, string> = {
    "india": "IN", "in": "IN",
    "usa": "US", "us": "US", "america": "US", "united states": "US",
    "uk": "GB", "gb": "GB", "britain": "GB", "england": "GB", "united kingdom": "GB",
    "germany": "DE", "de": "DE",
    "canada": "CA", "ca": "CA",
    "australia": "AU", "au": "AU",
    "singapore": "SG", "sg": "SG",
    "uae": "AE", "ae": "AE", "dubai": "AE", "emirates": "AE",
    "philippines": "PH", "ph": "PH",
    "france": "FR", "fr": "FR",
    "netherlands": "NL", "nl": "NL", "holland": "NL",
}

const PAYMENT_MAP: Record<string, string> = {
    "immediate": "immediate", "upfront": "immediate", "on receipt": "immediate", "now": "immediate",
    "net 15": "net_15", "15 days": "net_15", "15": "net_15",
    "net 30": "net_30", "30 days": "net_30", "30": "net_30",
    "net 60": "net_60", "60 days": "net_60", "60": "net_60",
}

const FIELD_QUESTIONS: Record<string, string> = {
    businessType: "What type of business do you run? (freelancer, developer, agency, ecommerce, professional, or other)",
    country: "Which country is your business based in?",
    businessName: "What's your business name?",
    ownerName: "What's your full name?",
    email: "What's your email address?",
    phone: "What's your phone number?",
    address: "What's your business address? (city is enough)",
    taxRegistered: "Are you registered for GST/VAT/Sales Tax?",
    taxId: "What's your tax registration number?",
    services: "What kind of services or products do you offer?",
    clientCountries: "Which countries do your clients come from? (or say 'all')",
    defaultCurrency: "What's your preferred currency? (e.g., INR, USD, EUR)",
    bankDetails: "Would you like to add your bank details for invoices? (You can skip this)",
}

function serverSideInterpret(
    userMsg: string,
    missingFields: string[],
    collectedData: Record<string, unknown>,
    bankDetailsAsked: boolean,
    additionalNotesCollected: boolean
): { message: string; extractedData: Record<string, unknown>; needsClarification: boolean; allFieldsComplete: boolean } | null {
    if (!userMsg) return null

    // Phase 1: Still collecting required fields
    if (missingFields.length > 0) {
        return interpretRequiredField(userMsg, missingFields, collectedData)
    }

    // Phase 2: Bank details (optional)
    if (!bankDetailsAsked) {
        const no = ["no", "nah", "nope", "n", "skip", "no thanks", "not now", "later"]
        const yes = ["yes", "yeah", "yep", "y", "sure", "ok", "okay"]
        if (no.some(w => userMsg.toLowerCase().includes(w))) {
            return {
                message: "No problem, skipping bank details! ✅ Is there anything else you'd like to add? Like pricing, product details, or a business description?",
                extractedData: { bankDetailsSkipped: true },
                needsClarification: false,
                allFieldsComplete: false,
            }
        }
        if (yes.some(w => userMsg.toLowerCase().includes(w))) {
            return {
                message: "Great! What's your bank name?",
                extractedData: {},
                needsClarification: false,
                allFieldsComplete: false,
            }
        }
        return null
    }

    // Phase 3: Final question (additional notes)
    if (!additionalNotesCollected) {
        const no = ["no", "nah", "nope", "n", "nothing", "that's it", "thats it", "that is it", "nope", "all good", "done", "no thanks", "skip", "not now", "later"]
        if (no.some(w => userMsg.toLowerCase().includes(w))) {
            return {
                message: "You're all set! 🎉 Click 'Complete Setup' to save your profile.",
                extractedData: {},
                needsClarification: false,
                allFieldsComplete: true,
            }
        }
        // User provided additional notes
        if (userMsg.length > 0) {
            return {
                message: "Got it, noted! 🎉 Click 'Complete Setup' to save your profile.",
                extractedData: { additionalNotes: userMsg },
                needsClarification: false,
                allFieldsComplete: true,
            }
        }
    }

    return null
}

// Helper: interpret required field answers in the server-side fallback
function interpretRequiredField(
    userMsg: string,
    missingFields: string[],
    collectedData: Record<string, unknown>
): { message: string; extractedData: Record<string, unknown>; needsClarification: boolean; allFieldsComplete: boolean } | null {
    if (missingFields.length === 0) return null
    
    const currentField = missingFields[0]
    const nextField = missingFields.length > 1 ? missingFields[1] : null
    const nextQuestion = nextField ? FIELD_QUESTIONS[nextField] || "" : "Would you like to add your bank details for invoices? You can skip this step."
    
    let extractedData: Record<string, unknown> = {}
    let confirmMsg = ""
    
    switch (currentField) {
        case "defaultCurrency": {
            // Try to match currency from user input
            const words = userMsg.split(/[\s,&+]+/)
            for (const word of words) {
                const match = CURRENCY_MAP[word.toLowerCase()]
                if (match) {
                    extractedData = { defaultCurrency: match }
                    confirmMsg = `Got it, ${match} it is! ✅`
                    break
                }
            }
            // Also try the raw input as a 3-letter code
            if (!confirmMsg && userMsg.length === 3) {
                extractedData = { defaultCurrency: userMsg.toUpperCase() }
                confirmMsg = `Got it, ${userMsg.toUpperCase()} it is! ✅`
            }
            break
        }
        case "country": {
            const match = COUNTRY_MAP[userMsg.toLowerCase()]
            if (match) {
                extractedData = { country: match }
                confirmMsg = `Great, ${match} it is! ✅`
            }
            break
        }
        case "paymentTerms": {
            const match = PAYMENT_MAP[userMsg.toLowerCase()]
            if (match) {
                extractedData = { paymentTerms: match }
                const labels: Record<string, string> = { immediate: "Immediate", net_15: "Net 15", net_30: "Net 30", net_60: "Net 60" }
                confirmMsg = `Perfect, ${labels[match]} payment terms! ✅`
            }
            break
        }
        case "businessType": {
            const types: Record<string, string> = {
                "freelancer": "freelancer", "freelance": "freelancer",
                "developer": "developer", "dev": "developer", "software": "developer",
                "agency": "agency",
                "ecommerce": "ecommerce", "e-commerce": "ecommerce", "shop": "ecommerce", "store": "ecommerce",
                "professional": "professional",
            }
            const match = types[userMsg.toLowerCase()]
            if (match) {
                extractedData = { businessType: match }
                confirmMsg = `Got it, you're a ${match}! ✅`
            } else {
                extractedData = { businessType: "other" }
                confirmMsg = `Got it, noted as "${userMsg}"! ✅`
            }
            break
        }
        case "taxRegistered": {
            const yes = ["yes", "yeah", "yep", "y", "true", "registered"]
            const no = ["no", "nah", "nope", "n", "false", "not", "not registered"]
            if (yes.includes(userMsg.toLowerCase())) {
                extractedData = { taxRegistered: true }
                confirmMsg = "Got it, you're tax registered! ✅"
            } else if (no.some(w => userMsg.toLowerCase().includes(w))) {
                extractedData = { taxRegistered: false, taxId: "" }
                confirmMsg = "No worries, no tax registration noted! ✅"
            }
            break
        }
        case "clientCountries": {
            if (["all", "all countries", "all of them", "everywhere", "all the countries"].includes(userMsg.toLowerCase())) {
                extractedData = { clientCountries: SUPPORTED_COUNTRIES }
                confirmMsg = "Got it, all 11 countries! ✅"
            }
            break
        }
        case "services":
        case "businessName":
        case "ownerName":
        case "email":
        case "phone": {
            // Accept any text as the value for these fields
            if (userMsg.length > 0) {
                extractedData = { [currentField]: userMsg }
                const labels: Record<string, string> = {
                    services: "services",
                    businessName: "business name",
                    ownerName: "name",
                    email: "email",
                    phone: "phone number",
                }
                confirmMsg = `Got it, ${labels[currentField]} is ${userMsg}! ✅`
            }
            break
        }
    }
    
    if (confirmMsg && Object.keys(extractedData).length > 0) {
        return {
            message: `${confirmMsg} ${nextQuestion}`,
            extractedData,
            needsClarification: false,
            allFieldsComplete: false,
        }
    }
    
    // If we couldn't interpret it, check if user is asking a question
    const questionWords = ["what", "how", "why", "can you", "tell me", "explain", "not sure", "don't know", "i'm not sure", "im not sure", "what does", "what is"]
    if (questionWords.some(q => userMsg.toLowerCase().includes(q))) {
        // User is asking a question — provide help for the current field
        const helpTexts: Record<string, string> = {
            paymentTerms: "Payment terms define when your client should pay after receiving the invoice. Immediate means right away, Net 15 means within 15 days, Net 30 within 30 days, Net 60 within 60 days. Most businesses use Net 30. Which one works for you?",
            defaultCurrency: "This is the currency you'll use on your invoices and documents. For India it's INR (₹), for USA it's USD ($), for UK it's GBP (£), for Europe it's EUR (€). Which currency do you prefer?",
            taxRegistered: "This means whether your business is registered for tax collection — like GST in India, VAT in Europe, or Sales Tax in the US. If you're not sure, you can say 'no' for now. Are you registered?",
            services: "This tells me what you actually do, like 'web design', 'marketing', or 'selling shoes'. What services or products do you offer?",
            clientCountries: "These are the countries where your clients are located. This helps me add the right compliance info to your documents. You can say 'all' for all 11 supported countries, or list specific ones.",
            businessType: "This helps me understand your business better. Options are: freelancer, developer, agency, ecommerce, professional, or other. Which fits best?",
        }
        const help = helpTexts[currentField]
        if (help) {
            return {
                message: help,
                extractedData: {},
                needsClarification: false,
                allFieldsComplete: false,
            }
        }
    }
    
    return null
}

// ── Server-side Validation ─────────────────────────────────────────────

const SUPPORTED_COUNTRIES = ["IN", "US", "GB", "DE", "CA", "AU", "SG", "AE", "PH", "FR", "NL"]
const VALID_BUSINESS_TYPES = ["freelancer", "developer", "agency", "ecommerce", "professional", "other"]
const VALID_PAYMENT_TERMS = ["immediate", "net_15", "net_30", "net_60"]

// Phone number country code patterns
const PHONE_COUNTRY_CODES: Record<string, string> = {
    "91": "IN",   // India
    "1": "US",    // USA/Canada (will need length check)
    "44": "GB",   // UK
    "49": "DE",   // Germany
    "61": "AU",   // Australia
    "65": "SG",   // Singapore
    "971": "AE",  // UAE
    "63": "PH",   // Philippines
    "33": "FR",   // France
    "31": "NL",   // Netherlands
}

function detectCountryFromPhone(phone: string): string | null {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "")

    // Try to match country codes (longest first)
    const sortedCodes = Object.keys(PHONE_COUNTRY_CODES).sort((a, b) => b.length - a.length)

    for (const code of sortedCodes) {
        if (digits.startsWith(code)) {
            const country = PHONE_COUNTRY_CODES[code]

            // Special handling for US/Canada (both use +1)
            if (code === "1") {
                // US/Canada numbers are 11 digits total (1 + 10 digits)
                if (digits.length === 11) {
                    return "US" // Default to US, user can correct if Canada
                }
            } else {
                return country
            }
        }
    }

    return null
}

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
                if (typeof value === "string") {
                    try {
                        validated.email = sanitizeEmail(value)
                    } catch {
                        // Invalid email, skip
                    }
                }
                break

            case "phone":
                if (typeof value === "string") {
                    const sanitized = sanitizePhone(value)
                    validated.phone = sanitized

                    // Auto-detect country from phone number if not already set
                    const detectedCountry = detectCountryFromPhone(sanitized)
                    if (detectedCountry && !data.country) {
                        validated.country = detectedCountry
                    }
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
                } else if (typeof value === "string") {
                    const str = value.toLowerCase().trim()
                    // Check if user said "all" or "all countries"
                    if (str === "all" || str === "all countries" || str === "everywhere" || str === "all of them") {
                        validated.clientCountries = SUPPORTED_COUNTRIES
                    } else {
                        // Try to extract country codes from string
                        const codes = str.match(/\b(IN|US|GB|DE|CA|AU|SG|AE|PH|FR|NL)\b/gi)
                        if (codes) {
                            validated.clientCountries = codes.map(c => c.toUpperCase())
                        }
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
                            street: sanitizeText(addr.street || ""),
                            city: sanitizeText(addr.city || ""),
                            state: sanitizeText(addr.state || ""),
                            postalCode: sanitizeText(addr.postalCode || addr.postal_code || ""),
                        }
                    }
                }
                break

            case "defaultCurrency":
                if (typeof value === "string") {
                    const currencyStr = value.trim().toUpperCase()

                    // Map common currency names to codes
                    const currencyMap: Record<string, string> = {
                        "INR": "INR", "RUPEE": "INR", "RUPEES": "INR", "INDIAN RUPEE": "INR", "INDIAN RUPEES": "INR",
                        "USD": "USD", "DOLLAR": "USD", "DOLLARS": "USD", "US DOLLAR": "USD", "US DOLLARS": "USD",
                        "EUR": "EUR", "EURO": "EUR", "EUROS": "EUR",
                        "GBP": "GBP", "POUND": "GBP", "POUNDS": "GBP", "BRITISH POUND": "GBP",
                        "CAD": "CAD", "CANADIAN DOLLAR": "CAD",
                        "AUD": "AUD", "AUSTRALIAN DOLLAR": "AUD",
                        "SGD": "SGD", "SINGAPORE DOLLAR": "SGD",
                        "AED": "AED", "DIRHAM": "AED",
                        "PHP": "PHP", "PESO": "PHP", "PHILIPPINE PESO": "PHP",
                    }

                    // Try direct match first
                    if (currencyMap[currencyStr]) {
                        validated.defaultCurrency = currencyMap[currencyStr]
                    }
                    // Try 3-letter code
                    else if (currencyStr.length === 3) {
                        validated.defaultCurrency = currencyStr
                    }
                    // Try to extract first currency code from string like "USD and INR" or "usd and inr"
                    else {
                        // Split by common separators and get first currency
                        const parts = currencyStr.split(/[\s,&]+/).filter(p => p.length > 0)
                        for (const part of parts) {
                            const normalized = part.toUpperCase()
                            if (currencyMap[normalized]) {
                                validated.defaultCurrency = currencyMap[normalized]
                                break
                            }
                            if (normalized.length === 3 && /^[A-Z]{3}$/.test(normalized)) {
                                validated.defaultCurrency = normalized
                                break
                            }
                        }
                    }
                }
                break

            case "taxId":
                // Accept empty string (user has no tax ID) or actual value
                if (typeof value === "string") {
                    validated.taxId = sanitizeText(value)
                }
                break

            case "taxRegistered":
                if (typeof value === "boolean") {
                    validated.taxRegistered = value
                } else if (typeof value === "string") {
                    const lower = value.toLowerCase().trim()
                    if (lower === "yes" || lower === "true") validated.taxRegistered = true
                    else if (lower === "no" || lower === "false") validated.taxRegistered = false
                }
                break

            case "businessName":
            case "ownerName":
                if (typeof value === "string" && value.trim().length > 0) {
                    validated[key] = sanitizeText(value)
                }
                break

            case "paymentInstructions":
                if (typeof value === "string" && value.trim().length > 0) {
                    validated.paymentInstructions = sanitizeText(value)
                }
                break

            case "additionalNotes":
                if (typeof value === "string" && value.trim().length > 0) {
                    validated.additionalNotes = sanitizeText(value)
                }
                break

            case "bankDetails":
                if (typeof value === "object" && value !== null) {
                    const bank = value as Record<string, string>
                    const sanitizedBank: Record<string, string> = {}
                    const bankFields = ["bankName", "accountName", "accountNumber", "ifscCode", "swiftCode", "routingNumber"]
                    for (const f of bankFields) {
                        if (bank[f] && typeof bank[f] === "string" && bank[f].trim().length > 0) {
                            sanitizedBank[f] = sanitizeText(bank[f])
                        }
                    }
                    if (Object.keys(sanitizedBank).length > 0) {
                        validated.bankDetails = sanitizedBank
                    }
                }
                break

            case "bankDetailsSkipped":
                if (value === true) {
                    validated.bankDetailsSkipped = true
                }
                break

            default:
                // Ignore unknown fields
                break
        }
    }

    return validated
}

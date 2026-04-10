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
    parentContext?: {
        documentType: string
        data: Record<string, any>
    }
}

export interface AIGenerationResponse {
    success: boolean
    data?: Partial<InvoiceData>
    message?: string
    error?: string
}

// ── Document Generation System Prompt ──────────────────────────────────

const GENERATION_SYSTEM_PROMPT = `You are Clorefy AI, a professional document generator. You create invoices, contracts, quotations, and proposals from user prompts.

## CRITICAL: MATH & CALCULATIONS
- DO NOT compute subtotals, totals, tax amounts, or discount amounts. The system calculates these automatically from the raw values you provide.
- Your ONLY job is to set the correct INPUT values: each item's "quantity" and "rate", plus "taxRate" (percentage), "discountValue" (number), "discountType" ("percent" or "flat"), and "shippingFee" (number).
- For items: set "rate" to the UNIT PRICE of one item. Set "quantity" to how many. Example: 12 months of a Rs. 399/month plan → quantity: 12, rate: 399. Do NOT set rate to the pre-multiplied total (4788).
- For discounts: if user says "8.33% discount", set discountType: "percent", discountValue: 8.33. If user says "Rs. 500 off", set discountType: "flat", discountValue: 500. NEVER manually subtract the discount from item rates.
- For PER-ITEM discounts: each item can have an optional "discount" field (percentage 0-100). Use this when the user wants a discount on a SPECIFIC item only, not the whole document. Example: "10% discount on the QR menu only" → set discount: 10 on that specific item, leave other items without discount. The global discountValue/discountType applies on top of per-item discounts to the entire document total.
- When the user says "discount on X only" or "discount for [specific item]", use per-item discount (item.discount). When they say "overall discount" or just "discount", use global discount (discountValue/discountType).
- CRITICAL: If you set a per-item discount on ANY item (item.discount > 0), you MUST set discountValue to 0. NEVER set both per-item discounts AND global discountValue at the same time. This causes double-counting. The system will zero out global discount if per-item discounts exist, but you should never set both in the first place.
- For tax: just set taxRate to the percentage (e.g., 18 for 18% GST). The system multiplies automatically.
- NEVER include fields like "subtotal", "total", "taxAmount", or "discountAmount" in your JSON — they don't exist in the schema and will be ignored.

## CRITICAL: DOCUMENT CONTENT RULES
- ALL document fields (notes, terms, description, item descriptions) must contain ONLY professional document content that a client would read.
- NEVER put clarifications, explanations, calculation breakdowns, pricing reasoning, or meta-commentary in document fields. Those belong ONLY in the "message" field.
- BAD notes: "**Clarification on Pricing:** The monthly rate is 399. The total for 12 months is 4788..." — This is an explanation, NOT document content.
- GOOD notes: "This quotation is valid for 30 days from the date of issue.\n\nPayment Method: UPI / Bank Transfer"
- BAD notes: "**Regarding the 482.14 figure:** The previous calculation was an error..." — NEVER reference previous errors or corrections in the document.
- NEVER use markdown formatting (**, *, ##, etc.) in any document field. The PDF renderer does not support markdown — it will show the raw asterisks literally.
- Keep notes concise and professional: validity period, payment method, any relevant terms. Nothing else.
- Keep terms focused on legal/business terms: payment schedule, cancellation policy, liability. No explanations.
- The "message" field is where you talk to the user — explain calculations, acknowledge corrections, ask follow-ups there.

## CORE RULES
1. ALWAYS respond with valid JSON: { "document": {...}, "message": "..." }
2. Generate the document IMMEDIATELY from whatever info the user provides. Don't refuse or ask too many questions.
3. Use the business profile data for all "from" fields — NEVER ask the user for their own business info.
4. Only ask about CLIENT/recipient info and document-specific details the user hasn't provided.
5. Your "message" should be 1-2 sentences: acknowledge what you created + ask ONE follow-up about missing info (only essential info like client name, email, or address — NEVER ask for phone numbers, they are optional and should not be requested).
6. Every item in the "items" array MUST have: { "id": "unique-string", "description": "...", "quantity": number, "rate": number }. Optionally include "discount": number (percentage 0-100) for per-item discounts.

## CRITICAL: DOCUMENT TYPE ENFORCEMENT
- If DOCUMENT TYPE says "quotation", set documentType to "Quotation" — NEVER "Invoice".
- If DOCUMENT TYPE says "contract", set documentType to "Contract" — NEVER "Invoice".
- If DOCUMENT TYPE says "proposal", set documentType to "Proposal" — NEVER "Invoice".
- If DOCUMENT TYPE says "invoice", set documentType to "Invoice".
- The documentType field MUST match the requested document type EXACTLY.
- Use the correct reference number prefix: INV- for invoices, QUO- for quotations, CTR- for contracts, PROP- for proposals.


## UNDERSTANDING THE USER'S BUSINESS
You will receive a BUSINESS PROFILE with the business name, type, country, and optionally BUSINESS SERVICES & PRICING INFO. Use ALL of this to understand what the user sells.

### Business Type Context
The BUSINESS TYPE tells you what kind of work this business does:
- "freelancer" = billing for hours, projects, retainers (design, writing, consulting, development, etc.)
- "developer" = software development, web/app projects, maintenance, SaaS subscriptions, hosting
- "agency" = client projects, campaigns, retainers, multi-service packages, creative work
- "ecommerce" = physical/digital products, subscriptions, wholesale orders, shipping
- "professional" = consulting, legal, medical, accounting, architecture, or other professional services
- "other" = use the business name and any additional notes to infer what they sell

### How to Match User Prompts to Business Context
When the user says "invoice for X" or "quotation for X", reason about X in the context of THEIR business:

1. First check BUSINESS SERVICES & PRICING INFO. If the user mentions a plan name, product, or service that matches known pricing, use the correct price.
2. If no pricing info is available, use the business type + name to create reasonable item descriptions.
3. Separate CLIENT names from PRODUCT/SERVICE names in the prompt.
4. If the user mentions something ambiguous, interpret it in the context of what this business actually sells.

### Examples for Different Business Types
- Freelance designer named "PixelCraft": "invoice for logo design for Acme" -> item="PixelCraft - Logo Design", toName="Acme"
- Software agency named "DevHouse": "quotation for mobile app for TechCorp" -> item="DevHouse - Mobile App Development", toName="TechCorp"
- Ecommerce store named "GreenGoods": "invoice for 50 units of organic soap" -> item="Organic Soap", quantity=50
- Consultant named "BizAdvisors": "invoice for 10 hours consulting for Jane" -> item="BizAdvisors - Consulting Services", quantity=10, toName="Jane"
- SaaS company named "CloudSync": "invoice for annual pro plan for StartupXYZ" -> item="CloudSync Pro Plan (Annual)", toName="StartupXYZ"
- Service business with known pricing (e.g., plans: Basic 249, Standard 399, Advanced 599): "invoice for advanced plan for John" -> item="[BusinessName] - Advanced Plan", rate=599, toName="John"

### When BUSINESS SERVICES & PRICING INFO is Available
This is the most important context. Match the user's words against known services/plans:
- If user mentions a plan name that matches -> use that exact price as the item rate
- If user mentions a service that matches -> use that service price
- Words that do NOT match any known plan/service are likely CLIENT or PROJECT names
- Create DESCRIPTIVE item names: "[BusinessName] [ServiceName] - [PlanName]"

### When NO Pricing Info is Available
- Use the business type to create reasonable item descriptions
- If the user provides a price ("10k", "$500", "Rs. 5000"), use it directly
- If no price is mentioned and no plan matches, ask in your message: "What rate should I use for this?"
- NEVER guess prices. Either use known pricing or ask.

## SMART EXTRACTION FROM USER PROMPT
Parse the user's message carefully. Think about WHAT the user is creating a document FOR in the context of THEIR business:

### Step-by-step reasoning (do this internally, do not output it):
1. Read the user's prompt as a whole sentence
2. Check BUSINESS TYPE. What does this business sell?
3. Check BUSINESS SERVICES & PRICING INFO. Does any word in the prompt match a plan name, service, or product?
4. If yes, use the matching price from the business info
5. Identify what is the CLIENT vs what is the PRODUCT/SERVICE
6. If no price is mentioned and no plan matches, ask in your message

### Extraction Rules
- "for [plan_name]" where plan_name matches business pricing -> use that plan price as the item rate
- "for [name]" where name is a company/person -> client name (toName)
- "for [name] for [plan]" -> first is client, second is plan (or vice versa, use context)
- "for [plan] for [name]" -> first is plan, second is client
- Numbers: "10k"=10000, "5k"=5000, "1.5k"=1500 -> item rate/amount
- Capitalize names properly: "techcorp" -> "TechCorp", "john doe" -> "John Doe"
- If client name is provided, NEVER use "[Client Name]" placeholder. Use the actual name.
- NEVER use "[To be provided]" or "[To be shared]" as placeholder text. If info is unknown, set to empty string "". Bracketed placeholders look unfinished and unprofessional.
  - BAD: toAddress: "[To be provided]"
  - GOOD: toAddress: ""
- Create DESCRIPTIVE item names that include the business name and service context.
  - BAD: "Web Development"
  - GOOD: "DevHouse - Full Stack Web Development" or "CloudSync Pro Plan (Annual Subscription)"
  - Prefix item names with the business name when it makes sense.
- Write DETAILED descriptions that explain what the document covers, not generic one-liners.
  - BAD: "Quotation for services as per our discussion."
  - GOOD: "Quotation for DevHouse Full Stack Web Development. Includes frontend and backend development, database setup, deployment, and 3 months of support."
  - Reference the specific service/plan name, what is included, and the business name.

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
- If the business profile includes payment details, include ONLY the payment METHOD names in the "notes" field — for example "Payment Method: UPI / Bank Transfer". NEVER include actual payment IDs, UPI IDs, account numbers, URLs, or any specific identifiers. Just the method names.
- Example notes format: "This quotation is valid for 30 days from the date of issue.\n\nPayment Method: UPI / Bank Transfer"
- BAD: "Payment Method: UPI / Bank Transfer\nUPI ID: admin@business" — NEVER include IDs
- GOOD: "Payment Method: UPI / Bank Transfer" — just the methods
- Only populate the "paymentMethod" and "paymentInstructions" fields if the user EXPLICITLY mentions them in their prompt. Otherwise set both to "" (empty string).
- The "toPhone" field is OPTIONAL. Never ask the user for the client's phone number. If the user provides it voluntarily, use it. Otherwise leave toPhone as "".

## COUNTRY-SPECIFIC COMPLIANCE
Detect the country from the business profile or user prompt. Apply the correct tax and legal requirements:

### India
- Tax: GST (Goods & Services Tax). Standard rate 18%. If tax-registered, include GSTIN in fromTaxId.
- taxLabel: "GST" or "IGST" (inter-state) / "CGST+SGST" (intra-state)
- Mandatory: HSN/SAC codes in item descriptions for tax-registered businesses
- Currency: INR
- Invoice numbering: sequential, financial year based (e.g., INV-2025-26/001)
- Include "Supply meant for" and "Place of Supply" in notes if tax-registered

### United States
- Tax: Sales Tax varies by state (0-10.25%). Only apply if user specifies state or tax rate.
- taxLabel: "Sales Tax"
- No federal invoice mandate, but include: invoice number, date, payment terms, itemized list
- Currency: USD
- Include EIN/Tax ID if provided

### United Kingdom
- Tax: VAT at 20% standard rate (5% reduced, 0% zero-rated)
- taxLabel: "VAT"
- Mandatory for VAT-registered: VAT number, VAT amount per line or total, "VAT Reg No:" prefix
- Currency: GBP
- Include company registration number if applicable

### Germany
- Tax: USt (Umsatzsteuer/VAT) at 19% standard (7% reduced)
- taxLabel: "USt" or "MwSt"
- Mandatory: Steuernummer or USt-IdNr, sequential invoice numbering, Leistungsdatum (service date)
- Reverse charge: note "Steuerschuldnerschaft des Leistungsempfängers" for B2B EU cross-border
- Currency: EUR

### Canada
- Tax: GST 5% federal + PST/HST varies by province (HST: ON 13%, NS/NB/NL/PEI 15%; PST: BC 7%, SK 6%, MB 7%, QC 9.975% as QST)
- taxLabel: "GST" or "HST" or "GST+PST"
- Include GST/HST registration number (BN)
- Currency: CAD

### Australia
- Tax: GST at 10%
- taxLabel: "GST"
- Mandatory for GST-registered: ABN (Australian Business Number), "Tax Invoice" label for GST invoices
- Currency: AUD
- For invoices over AUD 1000: must include ABN, quantity, unit price

### Singapore
- Tax: GST at 9% (as of 2024)
- taxLabel: "GST"
- Mandatory for GST-registered: GST registration number, "Tax Invoice" label
- Currency: SGD
- Include UEN (Unique Entity Number)

### UAE
- Tax: VAT at 5%
- taxLabel: "VAT"
- Mandatory: TRN (Tax Registration Number), tax invoice in both English and Arabic (notes can mention bilingual requirement)
- Currency: AED
- Include "Tax Invoice" header for VAT-registered businesses

### Philippines
- Tax: VAT at 12%
- taxLabel: "VAT"
- Mandatory for VAT-registered: TIN (Tax Identification Number), BIR-compliant format
- Currency: PHP
- Include OR/SI number format

### France
- Tax: TVA at 20% standard (10% intermediate, 5.5% reduced, 2.1% super-reduced)
- taxLabel: "TVA"
- Mandatory: SIREN/SIRET number, TVA intracommunautaire number, mention "TVA non applicable, art. 293 B du CGI" if exempt
- Currency: EUR
- Include APE/NAF code if applicable

### Netherlands
- Tax: BTW at 21% standard (9% reduced, 0% zero-rated)
- taxLabel: "BTW"
- Mandatory: KvK number (Chamber of Commerce), BTW-identificatienummer
- Currency: EUR
- Include IBAN for payment

## TAX HANDLING
- If business is NOT tax-registered: taxRate MUST be 0. No GST/VAT/tax unless user explicitly asks.
- If business IS tax-registered: apply the appropriate tax rate for the detected country (see above).
- Always set taxLabel to the country-appropriate label (GST, VAT, USt, TVA, BTW, etc.)
- If country cannot be determined, default to no tax (taxRate: 0) and ask in your message.

## DOCUMENT-SPECIFIC OUTPUT SCHEMAS

### Invoice (documentType: "Invoice")
Required fields:
- documentType: "Invoice"
- invoiceNumber: "INV-XXXX"
- invoiceDate: today (YYYY-MM-DD)
- dueDate: based on payment terms
- fromName, fromEmail, fromAddress, fromPhone, fromTaxId: from business profile
- toName, toEmail, toAddress, toPhone, toTaxId: client info
- items: [{ id, description, quantity, rate }]
- taxRate, taxLabel, currency, paymentTerms
- notes, terms
- design: template object

### Quotation (documentType: "Quotation")
Required fields:
- documentType: "Quotation"
- referenceNumber: "QUO-XXXX" (use referenceNumber, NOT invoiceNumber for the display number)
- invoiceDate: today (YYYY-MM-DD) — this is the quote date
- dueDate: validity date (typically 30 days from quote date)
- fromName, fromEmail, fromAddress, fromPhone, fromTaxId: from business profile
- toName, toEmail, toAddress: client info
- description: brief scope of work / what this quote covers
- items: [{ id, description, quantity, rate }] — itemized pricing
- taxRate, taxLabel, currency, paymentTerms
- notes: include validity period, any assumptions
- terms: acceptance terms, payment schedule
- design: template object
DO NOT include invoiceNumber for quotations. Use referenceNumber with "QUO-" prefix.

### Contract (documentType: "Contract")
Required fields:
- documentType: "Contract"
- referenceNumber: "CTR-XXXX"
- invoiceDate: effective date (YYYY-MM-DD)
- fromName, fromEmail, fromAddress: provider/party A
- toName, toEmail, toAddress: client/party B
- description: FULL contract body — include all clauses, scope of work, deliverables, payment terms, confidentiality, termination, dispute resolution, liability, intellectual property, amendments. Write this as a complete, professional legal document with numbered sections.
- signatureName, signatureTitle: from business profile
- notes: any additional notes
- terms: governing law, jurisdiction
- design: template object
DO NOT include items array for contracts unless the contract has specific deliverable pricing.

### Proposal (documentType: "Proposal")
Required fields:
- documentType: "Proposal"
- referenceNumber: "PROP-XXXX"
- invoiceDate: proposal date (YYYY-MM-DD)
- dueDate: valid until date
- fromName, fromEmail, fromAddress: from business profile
- toName, toEmail, toAddress: client info
- description: executive summary — what you're proposing, the problem you're solving, your approach, methodology, timeline. Write this as a compelling, detailed proposal narrative.
- items: [{ id, description, quantity, rate }] — deliverables with pricing
- taxRate, taxLabel, currency
- notes: approach, methodology, why choose us, team qualifications
- terms: acceptance terms, payment schedule, project timeline
- design: template object

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
- Business Type: ${request.businessContext.businessType || "Not specified"}
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

    // Parent document context (for linked document generation)
    if (request.parentContext) {
        const pd = request.parentContext.data
        const parentType = request.parentContext.documentType
        prompt += `\nCONTEXT FROM PREVIOUS DOCUMENT:\nThe user previously created a [${parentType}] with the following details:\n`
        if (pd.toName) prompt += `- Client: ${pd.toName}\n`
        if (pd.toEmail) prompt += `- Client Email: ${pd.toEmail}\n`
        if (pd.toAddress) prompt += `- Client Address: ${pd.toAddress}\n`
        if (Array.isArray(pd.items) && pd.items.length > 0) {
            prompt += `- Items:\n`
            for (const item of pd.items) {
                prompt += `  • ${item.description} (qty: ${item.quantity}, rate: ${item.rate})\n`
            }
        }
        if (pd.currency) prompt += `- Currency: ${pd.currency}\n`
        if (pd.total != null) prompt += `- Total: ${pd.total}\n`
        if (pd.paymentTerms) prompt += `- Payment Terms: ${pd.paymentTerms}\n`
        if (pd.notes) prompt += `- Notes: ${pd.notes}\n`
        prompt += `\nNow generate a [${request.documentType}] based on this information. Use the same client details, items, and amounts unless the user specifies changes.\n`
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
    request: AIGenerationRequest,
    apiKeyOverride?: string
): Promise<AIGenerationResponse> {
    const apiKey = apiKeyOverride || process.env.DEEPSEEK_API_KEY

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
    request: AIGenerationRequest,
    apiKeyOverride?: string
): AsyncGenerator<{ type: "chunk" | "complete" | "error"; data: string }> {
    const apiKey = apiKeyOverride || process.env.DEEPSEEK_API_KEY

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
        let sseBuffer = "" // Buffer for incomplete SSE lines split across TCP chunks

        if (!reader) {
            throw new Error("No response body")
        }

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            sseBuffer += chunk

            // Split on newlines, keep the last (potentially incomplete) part in the buffer
            const parts = sseBuffer.split("\n")
            sseBuffer = parts.pop() || ""

            for (const rawLine of parts) {
                const line = rawLine.trim()
                if (!line.startsWith("data: ")) continue

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

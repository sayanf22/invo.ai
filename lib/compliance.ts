/**
 * Compliance Rules Library for Invo.ai
 * Handles RAG-based compliance rule fetching using Supabase pgvector
 */

import { createClient } from "@supabase/supabase-js"
import type { Database, ComplianceRulesData } from "./database.types"
import { getCountryByCode } from "./countries"

// Initialize Supabase client for server-side usage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

export interface ComplianceCheckResult {
    isCompliant: boolean
    rules: ComplianceRulesData
    warnings: string[]
    requiredFields: string[]
    confidence: number
    lastUpdated: string | null
}

export interface DocumentValidationResult {
    isValid: boolean
    score: number
    checks: {
        name: string
        passed: boolean
        message: string
        severity: "error" | "warning" | "info"
    }[]
}

/**
 * Fetch compliance rules for a specific country and document type
 */
export async function getComplianceRules(
    country: string,
    documentType: "invoice" | "contract" | "nda" | "agreement"
): Promise<ComplianceCheckResult> {
    try {
        const { data, error } = await supabase
            .from("compliance_rules")
            .select("*")
            .eq("country", country)
            .eq("document_type", documentType)
            .single()

        if (error || !data) {
            // Return default rules if not found
            return getDefaultRules(country, documentType)
        }

        return {
            isCompliant: true,
            rules: data.rules as ComplianceRulesData,
            warnings: data.needs_human_review
                ? ["These rules are pending human review"]
                : [],
            requiredFields: (data.rules as ComplianceRulesData)?.required_fields?.map(
                (f) => f.name
            ) || [],
            confidence: data.confidence_score || 0,
            lastUpdated: data.last_updated,
        }
    } catch (error) {
        console.error("Error fetching compliance rules:", error)
        return getDefaultRules(country, documentType)
    }
}

/**
 * Get default compliance rules for a country (fallback when DB is empty)
 */
function getDefaultRules(
    countryCode: string,
    documentType: string
): ComplianceCheckResult {
    const country = getCountryByCode(countryCode)

    // Base required fields for all invoices
    const baseInvoiceFields = [
        { name: "invoice_number", format: "unique identifier" },
        { name: "date", format: "YYYY-MM-DD" },
        { name: "due_date", format: "YYYY-MM-DD" },
        { name: "from_name", format: "business name" },
        { name: "from_address", format: "full address" },
        { name: "to_name", format: "client name" },
        { name: "to_address", format: "client address" },
        { name: "line_items", format: "array of items with description, quantity, price" },
        { name: "subtotal", format: "number" },
        { name: "total", format: "number" },
        { name: "currency", format: "ISO 4217 code" },
    ]

    // Country-specific additions
    const countrySpecificRules: Record<string, Partial<ComplianceRulesData>> = {
        IN: {
            required_fields: [
                ...baseInvoiceFields,
                { name: "gstin", format: "15-character GST number" },
                { name: "place_of_supply", format: "state code" },
                { name: "hsn_sac_code", format: "HSN/SAC code for each item" },
            ],
            tax_rules: {
                domestic: { rate: 0.18, applicable_on: "services" },
                export: { rate: 0, requires: "LUT for zero-rated exports" },
            },
            legal_notices: [
                "GSTIN must be displayed prominently",
                "Place of supply determines CGST+SGST vs IGST",
            ],
        },
        US: {
            required_fields: [
                ...baseInvoiceFields,
                { name: "ein", format: "XX-XXXXXXX (optional)" },
            ],
            tax_rules: {
                domestic: { rate: 0, applicable_on: "varies by state" },
            },
            legal_notices: ["Sales tax varies by state and may need to be collected"],
        },
        GB: {
            required_fields: [
                ...baseInvoiceFields,
                { name: "vat_number", format: "GB + 9 digits" },
                { name: "vat_rate", format: "percentage" },
                { name: "vat_amount", format: "number" },
            ],
            tax_rules: {
                domestic: { rate: 0.2, applicable_on: "most goods and services" },
                export: { rate: 0, requires: "proof of export" },
            },
            legal_notices: [
                "VAT number must be shown if VAT registered",
                "Reverse charge applies for B2B EU services",
            ],
        },
        DE: {
            required_fields: [
                ...baseInvoiceFields,
                { name: "steuernummer", format: "German tax number" },
                { name: "ust_id", format: "VAT ID (optional)" },
            ],
            tax_rules: {
                domestic: { rate: 0.19, applicable_on: "most goods and services" },
                export: { rate: 0, requires: "EU VAT ID for reverse charge" },
            },
            legal_notices: [
                "Kleinunternehmer clause if under €22,000 revenue",
                "§14 UStG invoice requirements must be met",
            ],
        },
    }

    const countryRules = countrySpecificRules[countryCode] || {
        required_fields: baseInvoiceFields,
        tax_rules: { domestic: { rate: 0 } },
    }

    return {
        isCompliant: false, // Default rules, not from verified source
        rules: countryRules as ComplianceRulesData,
        warnings: [
            `Using default rules for ${country?.name || countryCode}. Compliance rules database may need updating.`,
        ],
        requiredFields: countryRules.required_fields?.map((f) => f.name) || [],
        confidence: 0.5, // Medium confidence for defaults
        lastUpdated: null,
    }
}

/**
 * Validate a document against compliance rules
 */
export function validateDocument(
    documentData: Record<string, unknown>,
    rules: ComplianceRulesData
): DocumentValidationResult {
    const checks: DocumentValidationResult["checks"] = []
    let totalScore = 0
    let passedChecks = 0

    // Check required fields
    const requiredFields = rules.required_fields || []
    for (const field of requiredFields) {
        const hasField =
            documentData[field.name] !== undefined &&
            documentData[field.name] !== null &&
            documentData[field.name] !== ""

        checks.push({
            name: `Required: ${field.name}`,
            passed: hasField,
            message: hasField
                ? `${field.name} is present`
                : `Missing required field: ${field.name}`,
            severity: hasField ? "info" : "error",
        })

        if (hasField) passedChecks++
    }

    // Mathematical validation for invoices
    if (documentData.line_items && Array.isArray(documentData.line_items)) {
        const items = documentData.line_items as Array<{
            quantity?: number
            unit_price?: number
            amount?: number
        }>

        let calculatedSubtotal = 0
        let mathErrors = false

        for (const item of items) {
            if (item.quantity && item.unit_price) {
                const expectedAmount = item.quantity * item.unit_price
                if (item.amount && Math.abs(item.amount - expectedAmount) > 0.01) {
                    mathErrors = true
                }
                calculatedSubtotal += item.amount || expectedAmount
            }
        }

        const declaredSubtotal = documentData.subtotal as number
        const subtotalMatches =
            !declaredSubtotal ||
            Math.abs(declaredSubtotal - calculatedSubtotal) < 0.01

        checks.push({
            name: "Mathematical Validation",
            passed: !mathErrors && subtotalMatches,
            message:
                mathErrors || !subtotalMatches
                    ? "Line item calculations don't match totals"
                    : "All calculations verified",
            severity: mathErrors || !subtotalMatches ? "error" : "info",
        })

        if (!mathErrors && subtotalMatches) passedChecks++
    }

    // Tax validation
    if (rules.tax_rules?.domestic) {
        const hasTaxInfo =
            documentData.tax_rate !== undefined || documentData.tax_amount !== undefined

        checks.push({
            name: "Tax Information",
            passed: hasTaxInfo,
            message: hasTaxInfo
                ? "Tax information present"
                : `Consider adding tax (standard rate: ${(rules.tax_rules.domestic.rate * 100).toFixed(0)}%)`,
            severity: hasTaxInfo ? "info" : "warning",
        })

        if (hasTaxInfo) passedChecks++
    }

    totalScore =
        requiredFields.length > 0
            ? (passedChecks / (requiredFields.length + 2)) * 100
            : 100

    return {
        isValid: checks.every(
            (c) => c.severity !== "error" || (c.severity === "error" && c.passed)
        ),
        score: Math.round(totalScore),
        checks,
    }
}

/**
 * Get compliance context for AI document generation
 */
export async function getComplianceContext(
    businessCountry: string,
    clientCountries: string[],
    documentType: "invoice" | "contract" | "nda" | "agreement"
): Promise<string> {
    const contexts: string[] = []

    // Get rules for business country
    const businessRules = await getComplianceRules(businessCountry, documentType)
    const businessCountryInfo = getCountryByCode(businessCountry)

    contexts.push(`
## Business Location: ${businessCountryInfo?.name || businessCountry}

### Required Fields:
${businessRules.requiredFields.map((f) => `- ${f}`).join("\n")}

### Tax Rules:
${JSON.stringify(businessRules.rules.tax_rules || {}, null, 2)}

### Legal Notices:
${businessRules.rules.legal_notices?.map((n) => `- ${n}`).join("\n") || "None specified"}
`)

    // Get rules for each unique client country
    const uniqueClientCountries = [...new Set(clientCountries)]
    for (const clientCountry of uniqueClientCountries) {
        if (clientCountry !== businessCountry) {
            const clientRules = await getComplianceRules(clientCountry, documentType)
            const clientCountryInfo = getCountryByCode(clientCountry)

            contexts.push(`
## Export to: ${clientCountryInfo?.name || clientCountry}

### Additional Requirements:
${clientRules.rules.legal_notices?.map((n) => `- ${n}`).join("\n") || "Standard export rules apply"}
`)
        }
    }

    return contexts.join("\n\n---\n\n")
}

/**
 * Seed initial compliance rules (for development/testing)
 */
export async function seedComplianceRules() {
    const countries = ["IN", "US", "GB", "DE", "CA", "AU", "SG", "AE", "PH", "FR", "NL"]
    const documentTypes = ["invoice", "contract", "nda", "agreement"] as const

    for (const country of countries) {
        for (const docType of documentTypes) {
            const defaultRules = getDefaultRules(country, docType)

            await supabase.from("compliance_rules").upsert(
                {
                    country,
                    document_type: docType,
                    rules: defaultRules.rules,
                    confidence_score: 0.5,
                    validated_by: "system-default",
                    needs_human_review: true,
                },
                { onConflict: "country,document_type" }
            )
        }
    }
}

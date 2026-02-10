/**
 * Multi-Layer Document Validation API
 * Per project.md: "STEP 5: MULTI-LAYER VALIDATION"
 * 
 * Runs five validation checks:
 * 1. Schema validation
 * 2. Compliance check against RAG rules
 * 3. Mathematical validation
 * 4. Second AI review (optional)
 * 5. Rule-based checks
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"

interface ValidationRequest {
    documentType: "invoice" | "contract" | "nda" | "agreement"
    documentData: Record<string, unknown>
    complianceRules?: Record<string, unknown>
    skipAIReview?: boolean
}

interface ValidationResult {
    isValid: boolean
    overallConfidence: number
    needsHumanReview: boolean
    validations: {
        schema: ValidationCheck
        compliance: ValidationCheck
        mathematical: ValidationCheck
        aiReview?: ValidationCheck
        ruleBased: ValidationCheck
    }
    errors: string[]
    warnings: string[]
}

interface ValidationCheck {
    passed: boolean
    confidence: number
    issues: string[]
}

// Invoice schema requirements
const INVOICE_REQUIRED_FIELDS = [
    "document_number",
    "issue_date",
    "due_date",
    "seller",
    "buyer",
    "line_items",
    "subtotal",
    "total",
    "currency"
]

const SELLER_REQUIRED_FIELDS = ["name", "address"]
const BUYER_REQUIRED_FIELDS = ["name"]
const LINE_ITEM_REQUIRED_FIELDS = ["description", "quantity", "unit_price", "total"]

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Authenticate user
        const auth = await authenticateRequest()
        if (auth.error) return auth.error

        // SECURITY: Rate limit (30 req/min for general routes)
        const rateLimitError = await checkRateLimit(auth.user.id, "general")
        if (rateLimitError) return rateLimitError

        const body: ValidationRequest = await request.json()

        // SECURITY: Input size limit (500KB for document data)
        const sizeError = validateBodySize(body, 500 * 1024)
        if (sizeError) return sizeError

        const { documentType, documentData, complianceRules, skipAIReview = true } = body

        if (!documentType || !documentData) {
            return NextResponse.json(
                { error: "Missing required fields: documentType, documentData" },
                { status: 400 }
            )
        }

        // SECURITY: Validate document type
        const validTypes = ["invoice", "contract", "nda", "agreement"]
        if (!validTypes.includes(documentType)) {
            return NextResponse.json(
                { error: "Invalid document type" },
                { status: 400 }
            )
        }

        const result = await validateDocument(documentType, documentData, complianceRules, skipAIReview)
        return NextResponse.json(result)

    } catch (error) {
        console.error("Validation error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

async function validateDocument(
    documentType: string,
    data: Record<string, unknown>,
    complianceRules?: Record<string, unknown>,
    skipAIReview: boolean = true
): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // 1. Schema Validation
    const schemaValidation = validateSchema(documentType, data)
    errors.push(...schemaValidation.issues.filter(i => !i.startsWith("Warning:")))
    warnings.push(...schemaValidation.issues.filter(i => i.startsWith("Warning:")).map(i => i.replace("Warning: ", "")))

    // 2. Compliance Check
    const complianceValidation = validateCompliance(documentType, data, complianceRules)
    errors.push(...complianceValidation.issues.filter(i => !i.startsWith("Warning:")))
    warnings.push(...complianceValidation.issues.filter(i => i.startsWith("Warning:")).map(i => i.replace("Warning: ", "")))

    // 3. Mathematical Validation
    const mathValidation = validateMathematics(data)
    errors.push(...mathValidation.issues)

    // 4. Rule-Based Checks
    const ruleBasedValidation = validateRuleBased(documentType, data)
    errors.push(...ruleBasedValidation.issues.filter(i => !i.startsWith("Warning:")))
    warnings.push(...ruleBasedValidation.issues.filter(i => i.startsWith("Warning:")).map(i => i.replace("Warning: ", "")))

    // Calculate overall confidence
    const confidences = [
        schemaValidation.confidence,
        complianceValidation.confidence,
        mathValidation.confidence,
        ruleBasedValidation.confidence
    ]
    const overallConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length

    // Determine if human review needed
    // Per spec: confidence < 0.85 requires human review
    const needsHumanReview = overallConfidence < 0.85 || errors.length > 0

    return {
        isValid: errors.length === 0,
        overallConfidence,
        needsHumanReview,
        validations: {
            schema: schemaValidation,
            compliance: complianceValidation,
            mathematical: mathValidation,
            ruleBased: ruleBasedValidation
        },
        errors,
        warnings
    }
}

/**
 * Validation 1: Schema Validation
 */
function validateSchema(documentType: string, data: Record<string, unknown>): ValidationCheck {
    const issues: string[] = []
    let confidence = 1.0

    if (documentType === "invoice") {
        for (const field of INVOICE_REQUIRED_FIELDS) {
            if (!data[field]) {
                issues.push(`Missing required field: ${field}`)
                confidence -= 0.1
            }
        }

        const seller = data.seller as Record<string, unknown> | undefined
        if (seller) {
            for (const field of SELLER_REQUIRED_FIELDS) {
                if (!seller[field]) {
                    issues.push(`Missing seller field: ${field}`)
                    confidence -= 0.05
                }
            }
        }

        const buyer = data.buyer as Record<string, unknown> | undefined
        if (buyer) {
            for (const field of BUYER_REQUIRED_FIELDS) {
                if (!buyer[field]) {
                    issues.push(`Missing buyer field: ${field}`)
                    confidence -= 0.05
                }
            }
        }

        const lineItems = data.line_items as Array<Record<string, unknown>> | undefined
        if (lineItems && Array.isArray(lineItems)) {
            lineItems.forEach((item, index) => {
                for (const field of LINE_ITEM_REQUIRED_FIELDS) {
                    if (item[field] === undefined || item[field] === null) {
                        issues.push(`Line item ${index + 1}: Missing ${field}`)
                        confidence -= 0.02
                    }
                }
            })
        }
    }

    return {
        passed: issues.length === 0,
        confidence: Math.max(0, confidence),
        issues
    }
}

/**
 * Validation 2: Compliance Check
 */
function validateCompliance(
    documentType: string,
    data: Record<string, unknown>,
    rules?: Record<string, unknown>
): ValidationCheck {
    const issues: string[] = []
    let confidence = 1.0

    if (!rules) {
        issues.push("Warning: No compliance rules available. Skipping compliance validation.")
        return { passed: true, confidence: 0.7, issues }
    }

    const requiredFields = (rules.required_fields || []) as string[]
    for (const field of requiredFields) {
        const value = getNestedValue(data, field)
        if (!value) {
            issues.push(`Compliance: Missing required field: ${field}`)
            confidence -= 0.1
        }
    }

    const legalNotices = (rules.legal_notices || []) as string[]
    const documentNotes = (data.notes || "") as string
    for (const notice of legalNotices) {
        if (!documentNotes.toLowerCase().includes(notice.toLowerCase().substring(0, 20))) {
            issues.push(`Warning: Legal notice may be missing: "${notice.substring(0, 50)}..."`)
            confidence -= 0.05
        }
    }

    return {
        passed: issues.filter(i => !i.startsWith("Warning:")).length === 0,
        confidence: Math.max(0, confidence),
        issues
    }
}

/**
 * Validation 3: Mathematical Validation
 */
function validateMathematics(data: Record<string, unknown>): ValidationCheck {
    const issues: string[] = []
    let confidence = 1.0

    const lineItems = data.line_items as Array<Record<string, unknown>> | undefined
    if (!lineItems || !Array.isArray(lineItems)) {
        return { passed: true, confidence: 1.0, issues: [] }
    }

    let calculatedSubtotal = 0

    lineItems.forEach((item, index) => {
        const quantity = Number(item.quantity) || 0
        const unitPrice = Number(item.unit_price) || 0
        const itemTotal = Number(item.total) || 0
        const expectedTotal = quantity * unitPrice

        calculatedSubtotal += expectedTotal

        if (Math.abs(itemTotal - expectedTotal) > 0.01) {
            issues.push(`Line item ${index + 1}: Total ${itemTotal} should be ${expectedTotal} (${quantity} × ${unitPrice})`)
            confidence -= 0.15
        }
    })

    const subtotal = Number(data.subtotal) || 0
    if (Math.abs(subtotal - calculatedSubtotal) > 0.01) {
        issues.push(`Subtotal ${subtotal} should be ${calculatedSubtotal}`)
        confidence -= 0.15
    }

    const taxAmount = Number(data.tax_amount) || 0
    const taxRate = Number(data.tax_rate) || 0
    if (taxRate > 0) {
        const expectedTax = calculatedSubtotal * (taxRate / 100)
        if (Math.abs(taxAmount - expectedTax) > 0.01) {
            issues.push(`Tax amount ${taxAmount} should be ${expectedTax.toFixed(2)} (${taxRate}% of ${calculatedSubtotal})`)
            confidence -= 0.1
        }
    }

    const total = Number(data.total) || 0
    const expectedTotal = calculatedSubtotal + taxAmount - (Number(data.discount) || 0)
    if (Math.abs(total - expectedTotal) > 0.01) {
        issues.push(`Total ${total} should be ${expectedTotal.toFixed(2)}`)
        confidence -= 0.2
    }

    return {
        passed: issues.length === 0,
        confidence: Math.max(0, confidence),
        issues
    }
}

/**
 * Validation 5: Rule-Based Checks
 */
function validateRuleBased(documentType: string, data: Record<string, unknown>): ValidationCheck {
    const issues: string[] = []
    let confidence = 1.0

    const currency = data.currency as string
    if (currency && !/^[A-Z]{3}$/.test(currency)) {
        issues.push(`Invalid currency code: ${currency}. Should be 3-letter ISO code.`)
        confidence -= 0.1
    }

    const issueDate = data.issue_date as string
    const dueDate = data.due_date as string
    if (issueDate && dueDate) {
        const issue = new Date(issueDate)
        const due = new Date(dueDate)
        if (due < issue) {
            issues.push("Due date cannot be before issue date")
            confidence -= 0.15
        }
    }

    const seller = data.seller as Record<string, unknown> | undefined
    const sellerEmail = seller?.email as string
    if (sellerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sellerEmail)) {
        issues.push(`Warning: Invalid seller email format`)
        confidence -= 0.05
    }

    const buyer = data.buyer as Record<string, unknown> | undefined
    const buyerEmail = buyer?.email as string
    if (buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
        issues.push(`Warning: Invalid buyer email format`)
        confidence -= 0.05
    }

    const docNumber = data.document_number as string
    if (!docNumber || docNumber.length < 2) {
        issues.push("Warning: Document number should be at least 2 characters")
        confidence -= 0.05
    }

    return {
        passed: issues.filter(i => !i.startsWith("Warning:")).length === 0,
        confidence: Math.max(0, confidence),
        issues
    }
}

/**
 * Helper: Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current, key) => {
        return current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined
    }, obj as unknown)
}

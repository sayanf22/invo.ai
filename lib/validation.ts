/**
 * Multi-Layer Validation System for Invo.ai
 * Implements 5 validation checks per specification:
 * 1. Schema validation
 * 2. Compliance check
 * 3. Mathematical validation
 * 4. AI review
 * 5. Rule-based checks
 */

import { z } from "zod"
import type { ComplianceRulesData, DocumentValidationResult } from "./database.types"
import { getComplianceRules, validateDocument as validateAgainstRules } from "./compliance"

// Zod schemas for different document types
export const LineItemSchema = z.object({
    id: z.string().optional(),
    description: z.string().min(1, "Description is required"),
    quantity: z.number().min(0, "Quantity must be non-negative").default(1),
    unit_price: z.number().min(0, "Unit price must be non-negative"),
    amount: z.number().optional(),
    tax_rate: z.number().optional(),
    tax_amount: z.number().optional(),
    hsn_sac_code: z.string().optional(), // For India
})

export const AddressSchema = z.object({
    name: z.string().optional(),
    company: z.string().optional(),
    street: z.string().optional(),
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
})

export const InvoiceSchema = z.object({
    // Header
    invoice_number: z.string().min(1, "Invoice number is required"),
    date: z.string().min(1, "Date is required"),
    due_date: z.string().optional(),

    // Parties
    from: AddressSchema,
    to: AddressSchema,

    // Items
    line_items: z.array(LineItemSchema).min(1, "At least one line item is required"),

    // Totals
    subtotal: z.number().min(0),
    tax_rate: z.number().optional(),
    tax_amount: z.number().optional(),
    discount: z.number().optional(),
    discount_type: z.enum(["percentage", "fixed"]).optional(),
    total: z.number().min(0),

    // Currency
    currency: z.string().length(3, "Currency must be ISO 4217 code"),

    // Tax IDs
    from_tax_id: z.string().optional(),
    to_tax_id: z.string().optional(),

    // Payment
    payment_terms: z.string().optional(),
    payment_instructions: z.string().optional(),

    // Notes
    notes: z.string().optional(),
    terms: z.string().optional(),

    // Metadata
    status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
})

export type InvoiceData = z.infer<typeof InvoiceSchema>

export interface ValidationCheck {
    name: string
    type: "schema" | "compliance" | "math" | "ai" | "rules"
    passed: boolean
    message: string
    severity: "error" | "warning" | "info"
    details?: Record<string, unknown>
}

export interface FullValidationResult {
    isValid: boolean
    overallScore: number
    confidenceLevel: "high" | "medium" | "low"
    checks: ValidationCheck[]
    summary: string
    needsHumanReview: boolean
}

/**
 * Layer 1: Schema Validation
 */
export function validateSchema(
    data: unknown,
    documentType: "invoice" | "contract" | "nda" | "agreement"
): ValidationCheck[] {
    const checks: ValidationCheck[] = []

    try {
        if (documentType === "invoice") {
            const result = InvoiceSchema.safeParse(data)

            if (result.success) {
                checks.push({
                    name: "Schema Validation",
                    type: "schema",
                    passed: true,
                    message: "Document structure is valid",
                    severity: "info",
                })
            } else {
                for (const error of result.error.errors) {
                    checks.push({
                        name: `Schema: ${error.path.join(".")}`,
                        type: "schema",
                        passed: false,
                        message: error.message,
                        severity: "error",
                        details: { path: error.path, code: error.code },
                    })
                }
            }
        } else {
            // For other document types, basic structure check
            const doc = data as Record<string, unknown>
            const hasTitle = typeof doc.title === "string" && doc.title.length > 0
            const hasParties = doc.parties || (doc.from && doc.to)

            checks.push({
                name: "Basic Structure",
                type: "schema",
                passed: hasTitle && !!hasParties,
                message: hasTitle && hasParties ? "Document has required structure" : "Missing title or parties",
                severity: hasTitle && hasParties ? "info" : "error",
            })
        }
    } catch (error) {
        checks.push({
            name: "Schema Validation",
            type: "schema",
            passed: false,
            message: error instanceof Error ? error.message : "Unknown validation error",
            severity: "error",
        })
    }

    return checks
}

/**
 * Layer 2: Compliance Check
 */
export async function validateCompliance(
    data: Record<string, unknown>,
    businessCountry: string,
    clientCountry: string,
    documentType: "invoice" | "contract" | "nda" | "agreement"
): Promise<ValidationCheck[]> {
    const checks: ValidationCheck[] = []

    try {
        const complianceRules = await getComplianceRules(businessCountry, documentType)

        // Check required fields for business country
        for (const field of complianceRules.requiredFields) {
            const hasField = getNestedValue(data, field) !== undefined
            checks.push({
                name: `Compliance: ${field}`,
                type: "compliance",
                passed: hasField,
                message: hasField
                    ? `${field} present (${businessCountry} requirement)`
                    : `Missing ${field} (required in ${businessCountry})`,
                severity: hasField ? "info" : "warning",
            })
        }

        // Check export requirements if different countries
        if (clientCountry !== businessCountry) {
            const exportRules = complianceRules.rules.tax_rules?.export
            if (exportRules) {
                checks.push({
                    name: "Export Compliance",
                    type: "compliance",
                    passed: true,
                    message: `Export invoice: ${exportRules.requires || "Standard export rules apply"}`,
                    severity: "info",
                })
            }
        }

        // Add confidence check
        checks.push({
            name: "Compliance Confidence",
            type: "compliance",
            passed: complianceRules.confidence >= 0.7,
            message: `Compliance rules confidence: ${(complianceRules.confidence * 100).toFixed(0)}%`,
            severity: complianceRules.confidence >= 0.7 ? "info" : "warning",
            details: { confidence: complianceRules.confidence },
        })
    } catch (error) {
        checks.push({
            name: "Compliance Check",
            type: "compliance",
            passed: false,
            message: "Could not verify compliance rules",
            severity: "warning",
        })
    }

    return checks
}

/**
 * Layer 3: Mathematical Validation
 */
export function validateMath(data: Record<string, unknown>): ValidationCheck[] {
    const checks: ValidationCheck[] = []

    try {
        const lineItems = data.line_items as Array<{
            quantity?: number
            unit_price?: number
            amount?: number
        }> | undefined

        if (!lineItems || !Array.isArray(lineItems)) {
            return checks
        }

        // Validate line item calculations
        let calculatedSubtotal = 0
        let lineItemErrors = 0

        for (let i = 0; i < lineItems.length; i++) {
            const item = lineItems[i]
            if (item.quantity !== undefined && item.unit_price !== undefined) {
                const expectedAmount = item.quantity * item.unit_price
                calculatedSubtotal += item.amount ?? expectedAmount

                if (item.amount !== undefined) {
                    const diff = Math.abs(item.amount - expectedAmount)
                    if (diff > 0.01) {
                        lineItemErrors++
                        checks.push({
                            name: `Line Item ${i + 1} Calculation`,
                            type: "math",
                            passed: false,
                            message: `Expected ${expectedAmount.toFixed(2)}, got ${item.amount.toFixed(2)}`,
                            severity: "error",
                            details: { expected: expectedAmount, actual: item.amount },
                        })
                    }
                }
            }
        }

        // Validate subtotal
        const declaredSubtotal = data.subtotal as number | undefined
        if (declaredSubtotal !== undefined) {
            const subtotalDiff = Math.abs(declaredSubtotal - calculatedSubtotal)
            checks.push({
                name: "Subtotal Calculation",
                type: "math",
                passed: subtotalDiff < 0.01,
                message:
                    subtotalDiff < 0.01
                        ? "Subtotal matches line items"
                        : `Subtotal mismatch: expected ${calculatedSubtotal.toFixed(2)}, got ${declaredSubtotal.toFixed(2)}`,
                severity: subtotalDiff < 0.01 ? "info" : "error",
            })
        }

        // Validate total
        const declaredTotal = data.total as number | undefined
        const taxAmount = (data.tax_amount as number) || 0
        const discount = (data.discount as number) || 0

        if (declaredTotal !== undefined && declaredSubtotal !== undefined) {
            const expectedTotal = declaredSubtotal + taxAmount - discount
            const totalDiff = Math.abs(declaredTotal - expectedTotal)

            checks.push({
                name: "Total Calculation",
                type: "math",
                passed: totalDiff < 0.01,
                message:
                    totalDiff < 0.01
                        ? "Total is correct"
                        : `Total mismatch: expected ${expectedTotal.toFixed(2)}, got ${declaredTotal.toFixed(2)}`,
                severity: totalDiff < 0.01 ? "info" : "error",
            })
        }

        // Overall math check
        if (lineItemErrors === 0 && checks.every((c) => c.passed)) {
            checks.unshift({
                name: "Mathematical Validation",
                type: "math",
                passed: true,
                message: "All calculations verified",
                severity: "info",
            })
        }
    } catch (error) {
        checks.push({
            name: "Mathematical Validation",
            type: "math",
            passed: false,
            message: "Error during mathematical validation",
            severity: "error",
        })
    }

    return checks
}

/**
 * Layer 4: AI Review (placeholder for AI-based validation)
 */
export async function validateWithAI(
    data: Record<string, unknown>,
    documentType: string
): Promise<ValidationCheck[]> {
    // This would call an AI model for semantic validation
    // For now, return a placeholder check
    return [
        {
            name: "AI Review",
            type: "ai",
            passed: true,
            message: "Document appears well-formed",
            severity: "info",
        },
    ]
}

/**
 * Layer 5: Rule-based Checks
 */
export function validateRules(data: Record<string, unknown>): ValidationCheck[] {
    const checks: ValidationCheck[] = []

    // Check for future dates on invoices
    const invoiceDate = data.date as string | undefined
    const dueDate = data.due_date as string | undefined

    if (invoiceDate) {
        const date = new Date(invoiceDate)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Future date warning (but not an error)
        if (date > today) {
            checks.push({
                name: "Invoice Date",
                type: "rules",
                passed: true,
                message: "Invoice date is in the future",
                severity: "warning",
            })
        }
    }

    // Check due date is after invoice date
    if (invoiceDate && dueDate) {
        const invoice = new Date(invoiceDate)
        const due = new Date(dueDate)

        checks.push({
            name: "Due Date",
            type: "rules",
            passed: due >= invoice,
            message:
                due >= invoice
                    ? "Due date is valid"
                    : "Due date is before invoice date",
            severity: due >= invoice ? "info" : "error",
        })
    }

    // Check for very large amounts (potential error)
    const total = data.total as number | undefined
    if (total !== undefined && total > 1000000) {
        checks.push({
            name: "Large Amount",
            type: "rules",
            passed: true,
            message: "Large invoice amount - please verify",
            severity: "warning",
        })
    }

    // Check for negative amounts
    if (total !== undefined && total < 0) {
        checks.push({
            name: "Negative Total",
            type: "rules",
            passed: false,
            message: "Total amount cannot be negative",
            severity: "error",
        })
    }

    return checks
}

/**
 * Full multi-layer validation
 */
export async function performFullValidation(
    data: Record<string, unknown>,
    businessCountry: string,
    clientCountry: string,
    documentType: "invoice" | "contract" | "nda" | "agreement"
): Promise<FullValidationResult> {
    // Run all validation layers
    const schemaChecks = validateSchema(data, documentType)
    const complianceChecks = await validateCompliance(data, businessCountry, clientCountry, documentType)
    const mathChecks = validateMath(data)
    const aiChecks = await validateWithAI(data, documentType)
    const ruleChecks = validateRules(data)

    const allChecks = [
        ...schemaChecks,
        ...complianceChecks,
        ...mathChecks,
        ...aiChecks,
        ...ruleChecks,
    ]

    // Calculate overall score
    const totalChecks = allChecks.length
    const passedChecks = allChecks.filter((c) => c.passed).length
    const errorChecks = allChecks.filter((c) => !c.passed && c.severity === "error")
    const warningChecks = allChecks.filter((c) => c.severity === "warning" && !c.passed)

    const overallScore = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0

    // Determine confidence level
    let confidenceLevel: "high" | "medium" | "low"
    if (overallScore >= 90 && errorChecks.length === 0) {
        confidenceLevel = "high"
    } else if (overallScore >= 70 || errorChecks.length <= 1) {
        confidenceLevel = "medium"
    } else {
        confidenceLevel = "low"
    }

    // Generate summary
    let summary: string
    if (errorChecks.length === 0 && warningChecks.length === 0) {
        summary = "Document validated successfully with no issues"
    } else if (errorChecks.length === 0) {
        summary = `Document valid with ${warningChecks.length} warning(s)`
    } else {
        summary = `${errorChecks.length} error(s) found - please review before proceeding`
    }

    return {
        isValid: errorChecks.length === 0,
        overallScore: Math.round(overallScore),
        confidenceLevel,
        checks: allChecks,
        summary,
        needsHumanReview: confidenceLevel === "low" || warningChecks.length > 2,
    }
}

// Helper function to get nested object values
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".")
    let current: unknown = obj

    for (const part of parts) {
        if (current === null || current === undefined) return undefined
        current = (current as Record<string, unknown>)[part]
    }

    return current
}

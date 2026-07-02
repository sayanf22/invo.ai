/**
 * Create Linked Session API
 * Creates a new document session linked to a parent session,
 * carrying over client context for document chain workflows.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
import { incrementDocumentCount, checkDocumentLimit, checkDocumentTypeAllowed, getUserTier } from "@/lib/cost-protection"
import { resolveEffectiveTier } from "@/lib/cost-protection"
import { normalizeDocumentType, getDocumentTypeConfig, ALL_DOCUMENT_TYPES } from "@/lib/document-type-registry"

// All 10 canonical types (plus legacy alias "quotation" which normalizes to "quote")
const VALID_TYPES = [...ALL_DOCUMENT_TYPES, "quotation"] as string[]

// Maps data from parent document context to seed the new document
function mapParentContext(parentContext: Record<string, any>, targetType: string): Record<string, any> {
    const mapped: Record<string, any> = {}

    // Always carry over client info
    if (parentContext.toName) mapped.toName = parentContext.toName
    if (parentContext.toEmail) mapped.toEmail = parentContext.toEmail
    if (parentContext.toAddress) mapped.toAddress = parentContext.toAddress
    if (parentContext.toPhone) mapped.toPhone = parentContext.toPhone
    if (parentContext.currency) mapped.currency = parentContext.currency

    // Carry over from/business info
    if (parentContext.fromName) mapped.fromName = parentContext.fromName
    if (parentContext.fromEmail) mapped.fromEmail = parentContext.fromEmail
    if (parentContext.fromAddress) mapped.fromAddress = parentContext.fromAddress
    if (parentContext.fromPhone) mapped.fromPhone = parentContext.fromPhone

    // Carry over items for invoice/quote targets
    if ((targetType === "invoice" || targetType === "quote" || targetType === "quotation") && Array.isArray(parentContext.items)) {
        mapped.items = parentContext.items.map((item: any, i: number) => ({
            id: `linked-${Date.now()}-${i}`,
            description: item.description || "",
            quantity: Number(item.quantity) || 1,
            rate: Number(item.rate) || 0,
        }))
        // Carry over financial fields
        if (parentContext.taxRate != null) mapped.taxRate = parentContext.taxRate
        if (parentContext.taxLabel) mapped.taxLabel = parentContext.taxLabel
        if (parentContext.subtotal != null) mapped.subtotal = parentContext.subtotal
        if (parentContext.total != null) mapped.total = parentContext.total
    }

    // Carry over payment terms
    if (parentContext.paymentTerms) mapped.paymentTerms = parentContext.paymentTerms

    // Set the target document type (capitalized)
    mapped.documentType = targetType.charAt(0).toUpperCase() + targetType.slice(1)

    // Carry over design if present
    if (parentContext.design) mapped.design = parentContext.design

    // Set today's date for the new document
    const today = new Date().toISOString().slice(0, 10)
    mapped.invoiceDate = today
    mapped.issueDate = today

    // Calculate due date from payment terms
    const dueDate = new Date()
    const terms = parentContext.paymentTerms || "Net 30"
    const daysMatch = terms.match(/(\d+)/)
    const days = daysMatch ? parseInt(daysMatch[1], 10) : 30
    if (terms.toLowerCase().includes("receipt")) {
        // Due on receipt = same day
    } else {
        dueDate.setDate(dueDate.getDate() + days)
    }
    mapped.dueDate = dueDate.toISOString().slice(0, 10)

    return mapped
}

// Extract client name from document context
function extractClientName(context: Record<string, any>): string | null {
    return context.toName
        || context.clientName
        || context.billTo?.name
        || context.recipientName
        || context.preparedFor
        || context.parties?.[1]?.name
        || null
}

// Format a business address (string or structured object) into a single line.
function formatBusinessAddress(address: any): string {
    if (!address) return ""
    if (typeof address === "string") return address
    return [
        address.street,
        address.city,
        address.state,
        address.postalCode || address.postal_code,
        address.country,
    ].filter(Boolean).join(", ")
}

/**
 * Merge the user's live business profile ("business memory") into the seed
 * context for a linked document.
 *
 * This runs only at linked-document creation time (not on every prompt). The
 * `businesses` row is the single source of truth for the sender's identity, so
 * business-owned fields (name, email, address, phone, tax registration) are
 * treated as AUTHORITATIVE and override any stale value carried over from the
 * parent document. This guarantees that whenever the user adds, updates, or
 * deletes business info in their profile, the change propagates into every new
 * linked document.
 *
 * Currency and payment terms keep a "fill only if empty" behaviour because a
 * specific document may deliberately use a value different from the profile
 * default. When the profile cannot be loaded (`business` is null), the sender
 * fields carried over from the parent are left untouched as a fallback.
 */
function mergeBusinessMemory(seedContext: Record<string, any>, business: any): void {
    // When the profile can't be loaded, `business` is null/undefined — in that
    // case we keep whatever sender fields were carried over from the parent
    // document (graceful fallback) instead of wiping them.
    if (!business) return

    // ── Business-owned identity fields ─────────────────────────────────────
    // The live `businesses` row is the single source of truth ("business
    // memory"). These fields are authoritative: we OVERRIDE any (possibly
    // stale) value carried over from the parent document so that add / update /
    // delete of profile info always propagates into newly created linked docs.
    // An empty profile value intentionally clears the field (delete propagation).
    const setAuthoritative = (key: string, value: any) => {
        seedContext[key] = value === undefined || value === null ? "" : value
    }

    setAuthoritative("fromName", business.name)
    setAuthoritative("fromEmail", business.email)
    setAuthoritative("fromAddress", formatBusinessAddress(business.address))
    setAuthoritative("fromPhone", business.phone)

    // ── Fields with a business default but legitimate per-document variance ──
    // Currency and payment terms have a profile default, but a specific document
    // may deliberately use a different value. Only fill when the seed context
    // doesn't already carry one.
    const fill = (key: string, value: any) => {
        const existing = seedContext[key]
        const isEmpty = existing === undefined || existing === null || existing === ""
        if (isEmpty && value !== undefined && value !== null && value !== "") {
            seedContext[key] = value
        }
    }
    fill("currency", business.default_currency)
    fill("paymentTerms", business.default_payment_terms)

    // ── Tax registration — profile is authoritative ────────────────────────
    const taxIds = business.tax_ids
    const hasTaxRegistration = taxIds && typeof taxIds === "object" &&
        Object.values(taxIds).some((v: any) => v && String(v).trim().length > 0)
    if (hasTaxRegistration) {
        seedContext.taxIds = taxIds
    } else {
        // Profile no longer has any tax registration — drop stale carried IDs.
        delete seedContext.taxIds
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        const body = await request.json()
        const sizeError = validateBodySize(body, 10 * 1024)
        if (sizeError) return sizeError

        const { parentSessionId, targetDocumentType } = body

        if (!parentSessionId || !targetDocumentType) {
            return NextResponse.json(
                { success: false, error: "parentSessionId and targetDocumentType are required" },
                { status: 400 }
            )
        }

        if (!VALID_TYPES.includes(targetDocumentType)) {
            return NextResponse.json(
                { success: false, error: `Invalid target document type. Must be one of: ${ALL_DOCUMENT_TYPES.join(", ")}` },
                { status: 400 }
            )
        }

        // Normalize the target type (handles "quotation" → "quote")
        const normalizedTargetType = normalizeDocumentType(targetDocumentType) ?? targetDocumentType

        // Fetch user tier from subscriptions table, default to "free"
        const userTier = await getUserTier(auth.supabase, auth.user.id)

        // Check document type is allowed for this tier
        const typeError = checkDocumentTypeAllowed(normalizedTargetType, userTier)
        if (typeError) return typeError

        // Check document limit for this tier
        const limitError = await checkDocumentLimit(auth.supabase, auth.user.id, userTier)
        if (limitError) return limitError

        // Load parent session
        const { data: parent, error: parentError } = await auth.supabase
            .from("document_sessions")
            .select("*")
            .eq("id", parentSessionId)
            .eq("user_id", auth.user.id)
            .single()

        if (parentError || !parent) {
            return NextResponse.json(
                { success: false, error: "Parent session not found" },
                { status: 404 }
            )
        }

        const parentContext = (parent.context && typeof parent.context === "object" && !Array.isArray(parent.context))
            ? parent.context as Record<string, any>
            : {}

        const parentType = normalizeDocumentType(parent.document_type)

        // Flexible linking: any document type can be linked as the parent of
        // any other document type. `validParentTypes` is now empty for every
        // type in the registry, so this check is a no-op today — kept so a
        // future type-specific restriction can be reintroduced without
        // touching this route again.
        const childConfig = getDocumentTypeConfig(normalizedTargetType)
        if (childConfig && childConfig.validParentTypes.length > 0) {
            if (!parentType || !childConfig.validParentTypes.includes(parentType)) {
                const allowed = childConfig.validParentTypes.join(", ")
                return NextResponse.json(
                    {
                        success: false,
                        error: `Invalid parent type. ${childConfig.label} can only link to: ${allowed}. Parent is "${parent.document_type}".`,
                    },
                    { status: 400 }
                )
            }
        }

        // Determine chain_id: use parent's chain_id, or parent's own id if it's the root
        const chainId = parent.chain_id || parent.id

        // If parent doesn't have a chain_id yet, set it now (it becomes the chain root)
        if (!parent.chain_id) {
            await auth.supabase
                .from("document_sessions")
                .update({ chain_id: chainId })
                .eq("id", parent.id)
        }

        // Extract client name
        const clientName = extractClientName(parentContext) || parent.client_name

        // Map parent context to seed data for the new document
        const seedContext = mapParentContext(parentContext, normalizedTargetType)

        // ── Business memory merge ──────────────────────────────────────────────
        // Pull the live business profile and fold its persistent details into the
        // seed context. Done only here (linked-doc creation), never on every
        // prompt. Reads the current profile row, so add/edit/delete of business
        // info is always reflected in the new document.
        try {
            const { data: business } = await auth.supabase
                .from("businesses")
                .select("*")
                .eq("user_id", auth.user.id)
                .single()
            mergeBusinessMemory(seedContext, business)
        } catch (bizErr) {
            console.error("Failed to merge business memory into linked session:", bizErr)
            // Non-fatal — fall back to parent-carried context only
        }

        // Store the parent's document type so the AI knows the chain origin
        // This is used in the stream route to correctly label the "Context from previous [type]" block
        seedContext._parentDocumentType = (parent.document_type || parentContext.documentType || "document").toLowerCase()

        // ── Parent document reference for SOW, Change Order, Payment Follow-up ──
        const typesWithParentRef = ["sow", "change_order", "payment_followup"]
        if (typesWithParentRef.includes(normalizedTargetType)) {
            seedContext.parent_document_id = parent.id
        }

        // For SOW: store the parent contract ID
        if (normalizedTargetType === "sow") {
            seedContext.parentContractId = parent.id
        }

        // For Change Order: store parent document type (sow | contract) and the
        // parent's human-readable reference number (e.g. "SOW-2026-07-002").
        // The reference number — never the raw parentDocumentId UUID — is what
        // gets printed in the change order's "Reference" clause, since a client
        // should never see an internal database ID on a signed legal document.
        if (normalizedTargetType === "change_order") {
            if (parentType === "sow" || parentType === "contract") {
                seedContext.parentDocumentType = parentType
            }
            if (parentContext.referenceNumber) {
                seedContext.parentReferenceNumber = parentContext.referenceNumber
            } else if (parentContext.invoiceNumber) {
                seedContext.parentReferenceNumber = parentContext.invoiceNumber
            }
        }

        // Auto-populate Payment Follow-up fields from linked invoice
        if (normalizedTargetType === "payment_followup" && parentType === "invoice") {
            seedContext.linkedInvoiceId = parent.id
            if (parentContext.invoiceNumber) seedContext.invoiceNumber = parentContext.invoiceNumber
            if (parentContext.total != null) seedContext.invoiceAmount = parentContext.total
            if (parentContext.currency) seedContext.invoiceCurrency = parentContext.currency
            if (parentContext.dueDate) seedContext.dueDate = parentContext.dueDate
            if (parentContext.paymentLinkUrl) seedContext.paymentLinkUrl = parentContext.paymentLinkUrl

            // Compute days overdue from dueDate
            if (parentContext.dueDate) {
                const due = new Date(parentContext.dueDate)
                const today = new Date()
                const msPerDay = 1000 * 60 * 60 * 24
                const daysOverdue = Math.floor((today.getTime() - due.getTime()) / msPerDay)
                seedContext.daysOverdue = Math.max(0, daysOverdue)
            }
        }

        // Create the new linked session
        const { data: newSession, error: createError } = await auth.supabase
            .from("document_sessions")
            .insert({
                user_id: auth.user.id,
                document_type: normalizedTargetType,
                status: "active",
                context: seedContext,
                chain_id: chainId,
                client_name: clientName,
            })
            .select()
            .single()

        if (createError || !newSession) {
            console.error("Failed to create linked session:", createError)
            return NextResponse.json(
                { success: false, error: "Failed to create linked session" },
                { status: 500 }
            )
        }

        // Increment document count for usage tracking
        await incrementDocumentCount(auth.supabase, auth.user.id)

        // Also update parent's client_name if not set
        if (clientName && !parent.client_name) {
            await auth.supabase
                .from("document_sessions")
                .update({ client_name: clientName })
                .eq("id", parent.id)
        }

        // Create the link record
        const { error: linkError } = await auth.supabase
            .from("document_links")
            .insert({
                parent_session_id: parent.id,
                child_session_id: newSession.id,
                relationship: "derived_from",
            })

        if (linkError) {
            console.error("Failed to create document link:", linkError)
            // Non-fatal — session was created, link is supplementary
        }

        return NextResponse.json({
            success: true,
            session: {
                id: newSession.id,
                documentType: newSession.document_type,
                chainId: chainId,
                clientName: clientName,
                seedContext: seedContext,
            },
        })
    } catch (error) {
        console.error("Error in create-linked:", error)
        return NextResponse.json(
            { success: false, error: sanitizeError(error) },
            { status: 500 }
        )
    }
}

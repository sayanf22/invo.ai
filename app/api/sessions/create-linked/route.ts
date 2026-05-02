/**
 * Create Linked Session API
 * Creates a new document session linked to a parent session,
 * carrying over client context for document chain workflows.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
import { incrementDocumentCount, checkDocumentLimit, checkDocumentTypeAllowed } from "@/lib/cost-protection"
import { resolveEffectiveTier, type UserTier } from "@/lib/cost-protection"

const VALID_TYPES = ["invoice", "contract", "quotation", "proposal"]

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

    // Carry over items for invoice/quotation targets
    if ((targetType === "invoice" || targetType === "quotation") && Array.isArray(parentContext.items)) {
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
                { success: false, error: "Invalid target document type" },
                { status: 400 }
            )
        }

        // Fetch user tier from subscriptions table, default to "free"
        const { data: subscription } = await (auth.supabase as any)
            .from("subscriptions")
            .select("plan, status, current_period_end")
            .eq("user_id", auth.user.id)
            .single()
        const userTier = resolveEffectiveTier(subscription as any)

        // Check document type is allowed for this tier
        const typeError = checkDocumentTypeAllowed(targetDocumentType, userTier)
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
        const seedContext = mapParentContext(parentContext, targetDocumentType)

        // Store the parent's document type so the AI knows the chain origin
        // This is used in the stream route to correctly label the "Context from previous [type]" block
        seedContext._parentDocumentType = (parent.document_type || parentContext.documentType || "document").toLowerCase()

        // Create the new linked session
        const { data: newSession, error: createError } = await auth.supabase
            .from("document_sessions")
            .insert({
                user_id: auth.user.id,
                document_type: targetDocumentType,
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

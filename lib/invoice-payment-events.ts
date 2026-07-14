import type { SupabaseClient } from "@supabase/supabase-js"
import type { InvoicePaymentGateway } from "@/lib/payment-link-provider"

export type InvoicePaymentEventStatus = "paid" | "partially_paid" | "expired" | "cancelled"

export interface InvoicePaymentEventInput {
    userId: string
    gateway: InvoicePaymentGateway
    providerLinkId: string
    status: InvoicePaymentEventStatus
    amountPaid?: number | null
    currency?: string | null
    providerPaymentId?: string | null
    isTestMode: boolean
    paidAt?: string | null
}

export interface InvoicePaymentEventResult {
    applied: boolean
    reason?: string
    session_id?: string
    reference_id?: string
    amount?: number
    amount_paid?: number
    currency?: string
    status?: InvoicePaymentEventStatus
}

export async function applyInvoicePaymentEvent(
    db: SupabaseClient,
    input: InvoicePaymentEventInput,
): Promise<InvoicePaymentEventResult> {
    const { data, error } = await (db.rpc as any)("apply_invoice_payment_event", {
        p_user_id: input.userId,
        p_gateway: input.gateway,
        p_provider_link_id: input.providerLinkId,
        p_status: input.status,
        p_amount_paid: input.amountPaid ?? null,
        p_currency: input.currency?.toUpperCase() ?? null,
        p_provider_payment_id: input.providerPaymentId ?? null,
        p_is_test_mode: input.isTestMode,
        p_paid_at: input.paidAt ?? null,
    })
    if (error) throw error
    if (!data || typeof data.applied !== "boolean") {
        throw new Error("Invalid invoice payment transition result")
    }
    return data as InvoicePaymentEventResult
}

export async function notifyInvoicePayment(
    db: SupabaseClient,
    userId: string,
    result: InvoicePaymentEventResult,
    providerEventId: string,
): Promise<void> {
    if (!result.applied || !result.status || !["paid", "partially_paid"].includes(result.status)) return
    const amount = result.amount_paid ?? 0
    const currency = result.currency || "INR"
    const partial = result.status === "partially_paid"
    const { error } = await (db as any).from("notifications").insert({
        user_id: userId,
        type: partial ? "general" : "payment_received",
        title: partial ? "Partial Payment Received" : "Invoice Paid! 🎉",
        message: partial
            ? `${currency} ${(amount / 100).toFixed(2)} received for ${result.reference_id || "your invoice"}.`
            : `Payment of ${currency} ${(amount / 100).toFixed(2)} received for ${result.reference_id || "your invoice"}.`,
        metadata: {
            session_id: result.session_id ?? null,
            provider_event_id: providerEventId,
            amount,
            currency,
            reference_id: result.reference_id ?? null,
        },
    })
    if (error) throw error
}

import { createClient } from "@supabase/supabase-js"
import type { InvoiceData } from "@/lib/invoice-types"
import { PayDocumentView } from "./pay-document-view"

// ── Service-role Supabase client (no auth required) ───────────────────
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export interface PaymentInfo {
  short_url: string
  status: "created" | "partially_paid" | "paid" | "expired" | "cancelled"
  amount: number
  currency: string
  amount_paid: number | null
  paid_at: string | null
  is_manual: boolean
}

interface PageProps {
  params: Promise<{ sessionId: string }>
}

export default async function PayPage({ params }: PageProps) {
  const { sessionId } = await params

  // Basic UUID validation to avoid unnecessary DB queries
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!sessionId || !uuidRegex.test(sessionId)) {
    return <PayDocumentView docData={null} payment={null} />
  }

  const supabase = createServiceClient()

  // Fetch session — include status so we can detect manual/offline payments
  const { data: session } = await supabase
    .from("document_sessions")
    .select("context, document_type, status, sent_at")
    .eq("id", sessionId)
    .single()

  if (!session?.context) {
    return <PayDocumentView docData={null} payment={null} />
  }

  // ── Cancellation guard ──
  // Two paths cancel a document:
  //   1. Owner unlocks via chat → status returns to "active" (with sent_at intact)
  //   2. Owner cancels via document preview → status becomes "cancelled"
  // Both should invalidate the pay link. End-states (signed/paid) are NEVER revoked.
  if (session.status === "cancelled") {
    return <PayDocumentView docData={null} payment={null} cancelled />
  }
  if (session.status === "active" && session.sent_at) {
    return <PayDocumentView docData={null} payment={null} cancelled />
  }

  // Fetch the most recent payment record (any status — we need to show the right state)
  const { data: pay } = await (supabase as any)
    .from("invoice_payments")
    .select("short_url, status, amount, currency, amount_paid, paid_at, is_manual, manually_marked_at, expires_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  // Lazy expiry: if the link's expires_at has passed but the webhook hasn't
  // fired yet (network hiccup / gateway delay), treat it as expired for the
  // purposes of auto-regeneration. This keeps the recipient experience fresh
  // without waiting for a webhook.
  const linkHasExpired = pay?.expires_at && new Date(pay.expires_at) < new Date()
  const effectiveLinkStatus: PaymentInfo["status"] | undefined =
    pay && linkHasExpired && pay.status === "created" ? "expired" : pay?.status

  // Build the payment info to pass to the client.
  // If the session itself is marked "paid" (e.g. manual payment, webhook already processed),
  // override the payment status to "paid" so the UI always shows the correct state.
  let payment: PaymentInfo | null = null
  if (pay) {
    const effectiveStatus: PaymentInfo["status"] =
      session.status === "paid" ? "paid" : (effectiveLinkStatus ?? pay.status)

    // ── AUTO-REFRESH EXPIRED LINKS ──────────────────────────────────────
    // A recipient clicking an old email should never see "link expired" for
    // an unpaid invoice. We regenerate the gateway link server-side on first
    // view. Cancelled links are respected (sender intent). Paid is terminal.
    if (
      effectiveStatus === "expired" &&
      session.status !== "paid" &&
      session.status !== "cancelled"
    ) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"
        const res = await fetch(`${appUrl}/api/payments/regenerate-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          // Server-side fetch — no caching
          cache: "no-store",
        })
        if (res.ok) {
          // Re-fetch the most recent payment record (should now be a fresh "created")
          const { data: refreshed } = await (supabase as any)
            .from("invoice_payments")
            .select("short_url, status, amount, currency, amount_paid, paid_at, is_manual, manually_marked_at")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()

          if (refreshed && refreshed.status === "created") {
            payment = {
              short_url: refreshed.short_url,
              status: "created",
              amount: refreshed.amount,
              currency: refreshed.currency,
              amount_paid: refreshed.amount_paid ?? null,
              paid_at: refreshed.paid_at ?? refreshed.manually_marked_at ?? null,
              is_manual: !!refreshed.is_manual,
            }
          }
        }
      } catch (err) {
        console.error("[pay-page] auto-refresh expired link failed:", err)
        // Fall through — recipient will see the expired state with a contact-sender message
      }
    }

    // If auto-refresh didn't run or didn't succeed, use the original payment state
    if (!payment) {
      payment = {
        short_url: pay.short_url,
        status: effectiveStatus,
        amount: pay.amount,
        currency: pay.currency,
        amount_paid: pay.amount_paid ?? null,
        paid_at: pay.paid_at ?? pay.manually_marked_at ?? null,
        is_manual: !!pay.is_manual,
      }
    }
  } else if (session.status === "paid") {
    // Session is paid but no payment record (edge case — manual mark without a link)
    payment = {
      short_url: "",
      status: "paid",
      amount: 0,
      currency: (session.context as any)?.currency || "USD",
      amount_paid: null,
      paid_at: null,
      is_manual: true,
    }
  }

  // Fetch existing quotation/proposal response (so the client sees their previous answer on re-open)
  let existingResponse: "accepted" | "declined" | "changes_requested" | null = null
  if (session.document_type === "quotation" || session.document_type === "quote" || session.document_type === "proposal") {
    const { data: qr } = await (supabase as any)
      .from("quotation_responses")
      .select("response_type")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (qr?.response_type) {
      existingResponse = qr.response_type as "accepted" | "declined" | "changes_requested"
    }
  }

  const docData = session.context as unknown as InvoiceData

  return (
    <PayDocumentView
      docData={docData}
      payment={payment}
      sessionId={sessionId}
      documentType={session.document_type || "invoice"}
      existingResponse={existingResponse}
    />
  )
}
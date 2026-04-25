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

interface PaymentInfo {
  short_url: string
  status: string
  amount: number
  currency: string
  amount_paid: number | null
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

  // Fetch session data
  const { data: session } = await supabase
    .from("document_sessions")
    .select("context, document_type, status")
    .eq("id", sessionId)
    .single()

  if (!session?.context) {
    return <PayDocumentView docData={null} payment={null} />
  }

  // Fetch payment info — only active/paid (not cancelled/expired)
  const { data: pay } = await (supabase as any)
    .from("invoice_payments")
    .select("short_url, status, amount, currency, amount_paid")
    .eq("session_id", sessionId)
    .in("status", ["created", "partially_paid", "paid"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const docData = session.context as unknown as InvoiceData
  const payment: PaymentInfo | null = pay ?? null

  return <PayDocumentView docData={docData} payment={payment} />
}

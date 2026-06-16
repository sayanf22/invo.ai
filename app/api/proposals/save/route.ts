import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkDocumentLimit, checkDocumentTypeAllowed, getUserTier, incrementDocumentCount } from "@/lib/cost-protection"
import { logDocumentCreate } from "@/lib/audit-log"
import type { ProposalFormData, GeneratedProposalSections } from "@/lib/proposal-types"
import type { InvoiceData } from "@/lib/invoice-types"

export const dynamic = "force-dynamic"

/**
 * POST /api/proposals/save
 *
 * Saves a generated proposal as a document_session with full context.
 * Unlike /api/sessions/create (which creates empty sessions), this route
 * accepts the fully assembled InvoiceData and stores it in the context column.
 *
 * Security: Same layered protection as /api/ai/stream and /api/sessions/create —
 *   origin validation → authentication → CSRF → tier check → doc type check →
 *   body size → data validation
 *
 * Returns: { sessionId: string, success: true }
 */
export async function POST(request: NextRequest) {
  // SECURITY: Validate request origin
  const originError = validateOrigin(request)
  if (originError) return originError

  // SECURITY: Authenticate user
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  // SECURITY: Validate CSRF token (bound to authenticated user's session)
  const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase)
  if (csrfError) return csrfError

  let body: {
    proposalNumber: string
    clientName: string
    invoiceData: InvoiceData
    formData: ProposalFormData
    sections: GeneratedProposalSections
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // SECURITY: Body size limit (500KB — full proposal with generated sections can be large)
  const sizeError = validateBodySize(body, 500 * 1024)
  if (sizeError) return sizeError

  const { proposalNumber, clientName, invoiceData, formData, sections } = body

  if (!invoiceData || !clientName) {
    return NextResponse.json({ error: "invoiceData and clientName are required" }, { status: 400 })
  }

  // Validate client name length — prevents excessively long values
  if (clientName.length > 200) {
    return NextResponse.json({ error: "Client name too long" }, { status: 400 })
  }

  // Validate proposal number format (PROP-YYYY-MM-NNN)
  if (proposalNumber && !/^PROP-\d{4}-\d{2}-\d{3,}$/.test(proposalNumber)) {
    return NextResponse.json({ error: "Invalid proposal number format" }, { status: 400 })
  }

  // SECURITY: Tier checks — proposals require Starter or above
  const userTier = await getUserTier(auth.supabase, auth.user.id)

  const typeError = checkDocumentTypeAllowed("proposal", userTier)
  if (typeError) return typeError

  const limitError = await checkDocumentLimit(auth.supabase, auth.user.id, userTier)
  if (limitError) return limitError

  // Build the context object — cast to any to satisfy the Json constraint
  const context = {
    ...invoiceData,
    // Store builder form data for future reference / section regeneration
    // These are private fields (prefixed with _) that the PDF renderer ignores
    _proposalFormData: formData as unknown,
    _proposalSections: sections as unknown,
  } as any

  // Insert the session with pre-built context
  // The user_id is taken from the authenticated session — never from the request body
  const { data: session, error } = await auth.supabase
    .from("document_sessions")
    .insert({
      user_id: auth.user.id,
      document_type: "proposal",
      status: "active",
      client_name: clientName.trim().slice(0, 200),
      context,
    })
    .select("id")
    .single()

  if (error || !session) {
    console.error("[proposals/save] Failed to save:", error?.message)
    return NextResponse.json({ error: "Failed to save proposal" }, { status: 500 })
  }

  // Increment document count (this is a full generation, not just starting a session)
  // Non-fatal: count increment failure should not block the user
  try {
    await incrementDocumentCount(auth.supabase, auth.user.id)
  } catch (countErr) {
    console.error("[proposals/save] Failed to increment document count:", countErr)
  }

  // Audit log — fire and forget, non-fatal
  logDocumentCreate(auth.supabase, auth.user.id, session.id, "proposal", request).catch(
    (e) => console.error("[proposals/save] Audit log failed:", e)
  )

  return NextResponse.json({ sessionId: session.id, success: true })
}

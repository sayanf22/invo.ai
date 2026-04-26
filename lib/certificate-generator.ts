/**
 * Certificate Generator
 *
 * Generates a PDF certificate page for a completed signing session
 * and stores it in Cloudflare R2 at:
 *   certificates/[documentId]_certificate.pdf
 */

import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { uploadToR2 } from "@/lib/r2"
import { CertificatePDF, type SignerInfo } from "@/components/certificate-page"
import type { Database } from "@/lib/database.types"

/**
 * Build the R2 object key for a certificate PDF.
 * Property 9: always `certificates/[documentId]_certificate.pdf`
 */
export function buildCertificateKey(documentId: string): string {
  return `certificates/${documentId}_certificate.pdf`
}

/**
 * Create a Supabase service-role client internally.
 */
function createServiceRoleClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Generate a PDF certificate for a completed signing session and upload to R2.
 *
 * @param sessionId   - The document_sessions.id
 * @param documentId  - The documents.id (used for the R2 key)
 * @param supabase    - Optional service-role Supabase client; created internally if not provided
 */
export async function generateAndStoreCertificate(
  sessionId: string,
  documentId: string,
  supabase?: SupabaseClient
): Promise<void> {
  const db = (supabase ?? createServiceRoleClient()) as SupabaseClient<Database>

  // ── Fetch all signatures for this session ──────────────────────────────────
  const { data: signatures, error: sigError } = await db
    .from("signatures")
    .select("id, signer_name, signer_email, party, signed_at, ip_address, signature_image_url, document_hash, verification_url")
    .eq("session_id", sessionId)
    .not("signed_at", "is", null)

  if (sigError) {
    throw new Error(`[certificate-generator] Failed to fetch signatures: ${sigError.message}`)
  }
  if (!signatures || signatures.length === 0) {
    throw new Error(`[certificate-generator] No completed signatures found for session=${sessionId}`)
  }

  // ── Fetch session context for document metadata ────────────────────────────
  const { data: session, error: sessionError } = await db
    .from("document_sessions")
    .select("id, document_type, context, created_at")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    throw new Error(`[certificate-generator] Failed to fetch session: ${sessionError?.message}`)
  }

  // Extract document title and reference from context (best-effort)
  const ctx = (session.context ?? {}) as Record<string, unknown>
  const documentTitle =
    (ctx.title as string) ||
    (ctx.documentTitle as string) ||
    (ctx.reference_number as string) ||
    ""
  const referenceNumber =
    (ctx.reference_number as string) ||
    (ctx.referenceNumber as string) ||
    (ctx.invoiceNumber as string) ||
    ""

  // ── Build signer list ──────────────────────────────────────────────────────
  const signers: SignerInfo[] = signatures.map((sig) => ({
    name: sig.signer_name ?? "",
    email: sig.signer_email ?? "",
    party: (sig as any).party ?? "Client",
    signedAt: sig.signed_at ?? new Date().toISOString(),
    ipAddress: (sig as any).ip_address ?? "",
    signatureImageUrl: (sig as any).signature_image_url ?? undefined,
  }))

  // ── Use first signature for document hash and verification URL ─────────────
  const firstSig = signatures[0] as any
  const documentHash: string = firstSig.document_hash ?? ""
  const verificationUrl: string = firstSig.verification_url ?? `https://clorefy.com/verify/${firstSig.id}`

  // ── Render PDF to buffer ───────────────────────────────────────────────────
  const element = createElement(CertificatePDF, {
    signers,
    documentTitle,
    documentType: session.document_type ?? "",
    referenceNumber,
    requestedAt: session.created_at ?? new Date().toISOString(),
    documentHash,
    verificationUrl,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any)

  // ── Upload to R2 ───────────────────────────────────────────────────────────
  const key = buildCertificateKey(documentId)
  await uploadToR2(key, pdfBuffer, "application/pdf")

  console.log(`[certificate-generator] Certificate stored at R2 key: ${key}`)
}

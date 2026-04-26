/**
 * Types and helpers for the public signature verification page.
 * Extracted from the page file so they can be exported without
 * conflicting with Next.js page export conventions.
 */

export interface SignatureRow {
  id: string
  signer_name: string | null
  signer_email: string
  signed_at: string | null
  document_hash: string | null
  ip_address: string | null
  signature_image_url: string | null
  party: string
  session_id: string | null
  document_sessions?: {
    document_type: string
  } | null
}

export interface PublicVerificationData {
  signerName: string | null
  signerEmail: string
  signedAt: string | null
  documentType: string | null
  documentHashPrefix: string | null
  status: string
  verified: boolean
}

/**
 * Build the safe public verification data from a full signature row.
 * NEVER exposes: full 64-char hash, IP address, signature image URL or R2 key.
 */
export function buildPublicVerificationData(
  signature: SignatureRow
): PublicVerificationData {
  const isCompleted = !!signature.signed_at

  return {
    signerName: signature.signer_name,
    signerEmail: signature.signer_email,
    signedAt: signature.signed_at,
    documentType: signature.document_sessions?.document_type ?? null,
    // Only expose first 16 chars of the hash
    documentHashPrefix: signature.document_hash
      ? signature.document_hash.slice(0, 16)
      : null,
    status: isCompleted ? "completed" : "pending",
    verified: isCompleted,
  }
}

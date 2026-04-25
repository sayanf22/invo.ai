export type SignatureNotificationType =
  | "signature_viewed"
  | "signature_signed"
  | "signature_completed"
  | "signature_expired"

export interface SignatureNotification {
  type: SignatureNotificationType
  user_id: string
  title: string
  message: string
  metadata: Record<string, unknown>
}

export function buildSignatureNotification(
  type: SignatureNotificationType,
  userId: string,
  signerName: string,
  documentType: string,
  referenceNumber: string,
  sessionId: string,
  signatureId: string
): SignatureNotification {
  let title: string
  let message: string

  switch (type) {
    case "signature_viewed":
      title = "Document Viewed"
      message = `${signerName} viewed your ${documentType} for signing.`
      break
    case "signature_signed":
      title = "Document Signed"
      message = `${signerName} signed your ${documentType} ${referenceNumber}.`
      break
    case "signature_completed":
      title = "All Signatures Complete"
      message = `Your ${documentType} ${referenceNumber} has been fully signed by all parties.`
      break
    case "signature_expired":
      title = "Signing Link Expired"
      message = `The signing link for ${signerName} on ${documentType} ${referenceNumber} has expired.`
      break
  }

  return {
    type,
    user_id: userId,
    title,
    message,
    metadata: {
      session_id: sessionId,
      signature_id: signatureId,
      signer_name: signerName,
      document_type: documentType,
      reference_number: referenceNumber,
    },
  }
}

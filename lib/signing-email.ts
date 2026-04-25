export function buildSigningInvitationSubject(
  businessName: string,
  documentType: string,
  referenceNumber: string
): string {
  return `${businessName} requests your signature on ${documentType} ${referenceNumber}`.trim()
}

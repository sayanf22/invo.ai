const PUBLIC_DOCUMENT_ID_REGEX = /^[0-9a-f]{64}$/
const SIGNING_TOKEN_REGEX = /^(?:sign|self)_[0-9a-f]{32}$/

export function isPublicDocumentId(value: unknown): value is string {
  return typeof value === "string" && PUBLIC_DOCUMENT_ID_REGEX.test(value)
}

export function isSigningToken(value: unknown): value is string {
  return typeof value === "string" && SIGNING_TOKEN_REGEX.test(value)
}

export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com").replace(/\/$/, "")
}

export function getPublicDocumentUrl(publicId: string, path: "pay" | "view" | "d" = "pay"): string {
  if (!isPublicDocumentId(publicId)) throw new Error("Invalid public document capability")
  return `${getAppUrl()}/${path}/${publicId}`
}

export async function hashSigningToken(token: string): Promise<string> {
  if (!isSigningToken(token)) throw new Error("Invalid signing token")
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
}

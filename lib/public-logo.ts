/**
 * Public logo URL resolution.
 *
 * Business logos are stored as R2 object keys (e.g. "logos/<userId>/<uuid>.png"),
 * which are NOT publicly reachable — every other logo reader in the app goes
 * through the authenticated `/api/storage/image` proxy. That works fine inside
 * the product, but breaks anywhere the logo needs to render without auth:
 * outbound emails (Gmail/Outlook never fetch data: URIs — confirmed unsupported
 * across major clients) and public pages like /onboard/[token] and /sign/[token].
 *
 * This resolves a stored `logo_url` value into something an <img> tag can load
 * from anywhere:
 *  - Already an absolute http(s) URL (legacy data) → returned as-is.
 *  - An R2 key → routed through the public, unauthenticated `/api/public/logo`
 *    endpoint, which streams the actual bytes.
 *  - Empty/null → null (callers should render no <img> at all, never a broken one).
 */
export function getPublicLogoUrl(userId: string, logoKey: string | null | undefined): string | null {
  if (!logoKey) return null
  if (logoKey.startsWith("http://") || logoKey.startsWith("https://")) return logoKey
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"
  return `${appUrl}/api/public/logo/${userId}`
}

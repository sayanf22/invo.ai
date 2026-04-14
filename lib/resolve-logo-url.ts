/**
 * Resolve an R2 object key (or URL) to a displayable presigned URL.
 *
 * - Returns null if the value is empty.
 * - Returns the value as-is if it's already a URL (http/data:).
 * - Otherwise fetches a presigned GET URL from /api/storage/url using authFetch.
 */
import { authFetch } from "@/lib/auth-fetch"

export async function resolveLogoUrl(fromLogo: string): Promise<string | null> {
  if (!fromLogo) return null

  // Already a usable URL
  if (fromLogo.startsWith("http") || fromLogo.startsWith("data:")) {
    return fromLogo
  }

  // R2 object key — fetch presigned URL with auth
  try {
    const res = await authFetch(`/api/storage/url?key=${encodeURIComponent(fromLogo)}`)
    if (!res.ok) return null
    const json = await res.json()
    return json.url || null
  } catch {
    return null
  }
}

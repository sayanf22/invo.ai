/**
 * Resolve an R2 object key to a base64 data URL via the server-side image proxy.
 * This avoids CORS issues with @react-pdf/renderer's <Image> component.
 *
 * - Returns null if the value is empty.
 * - Returns the value as-is if it's already a data URL or http URL.
 * - Otherwise fetches via /api/storage/image which returns a base64 data URL.
 */
import { authFetch } from "@/lib/auth-fetch"

export async function resolveLogoUrl(fromLogo: string): Promise<string | null> {
  if (!fromLogo) return null

  // Already a usable data URL or http URL
  if (fromLogo.startsWith("data:") || fromLogo.startsWith("http")) {
    return fromLogo
  }

  // R2 object key — fetch as base64 data URL via server proxy
  try {
    const res = await authFetch(`/api/storage/image?key=${encodeURIComponent(fromLogo)}`)
    if (!res.ok) return null
    const json = await res.json()
    return json.dataUrl || null
  } catch {
    return null
  }
}

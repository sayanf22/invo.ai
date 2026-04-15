/**
 * Resolve an R2 object key to a base64 data URL for use in PDF generation.
 *
 * Priority order:
 * 1. Already a data URL or http URL → return as-is
 * 2. In the client-side logo cache (warmed on upload) → return instantly
 * 3. Fetch via /api/storage/image → returns base64 data URL
 *
 * This avoids CORS issues with @react-pdf/renderer's <Image> component.
 */

export async function resolveLogoUrl(fromLogo: string): Promise<string | null> {
  if (!fromLogo) return null

  // Already a usable data URL, http URL, or blob URL
  if (
    fromLogo.startsWith("data:") ||
    fromLogo.startsWith("http") ||
    fromLogo.startsWith("blob:")
  ) {
    return fromLogo
  }

  // Check the client-side logo cache first (populated on upload or DB load)
  // This avoids a network round-trip entirely
  try {
    const { logoCache } = await import("@/hooks/use-logo-url")
    const cached = logoCache.get(fromLogo)
    if (cached) return cached
  } catch {
    // Cache not available (e.g. server-side render) — fall through
  }

  // Fall back to the image proxy API
  try {
    const { authFetch } = await import("@/lib/auth-fetch")
    const res = await authFetch(`/api/storage/image?key=${encodeURIComponent(fromLogo)}`)
    if (!res.ok) return null
    const json = await res.json()
    if (json.dataUrl) {
      // Warm the cache for future calls
      try {
        const { warmLogoCache } = await import("@/hooks/use-logo-url")
        warmLogoCache(fromLogo, json.dataUrl)
      } catch { /* non-blocking */ }
      return json.dataUrl
    }
    return null
  } catch {
    return null
  }
}

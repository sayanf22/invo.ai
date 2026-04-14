/**
 * URL normalization utilities shared between middleware and tests.
 */

/**
 * Normalizes a URL pathname to its canonical form:
 * 1. Lowercase
 * 2. Remove trailing slash (except root "/")
 * 3. Collapse duplicate slashes
 *
 * Returns the corrected pathname, or null if already canonical.
 */
export function normalizePathname(pathname: string): string | null {
  let normalized = pathname.toLowerCase()
  // Collapse duplicate slashes (e.g. //tools → /tools)
  normalized = normalized.replace(/\/{2,}/g, "/")
  // Remove trailing slash (except root)
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1)
  }
  return normalized !== pathname ? normalized : null
}

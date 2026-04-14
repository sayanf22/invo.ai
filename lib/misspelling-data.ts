/**
 * Misspelling and alternate spelling data for Clorefy brand protection.
 * Used by middleware to redirect misspelled URLs to the correct clorefy.com paths.
 */

/**
 * Known misspellings and alternate spellings of "Clorefy".
 * These are checked against URL path segments to detect and redirect misspelled URLs.
 */
export const MISSPELLING_VARIANTS: string[] = [
  "clorify",
  "cloriphy",
  "clorephy",
  "clorafy",
  "clorefi",
  "clorfy",
  "clorifly",
]

/**
 * Checks if a URL pathname contains a known misspelling of "clorefy".
 * Replaces the misspelling with "clorefy" in the path.
 *
 * @param pathname - The URL pathname to check (e.g. "/clorify-invoice-generator")
 * @returns The corrected pathname if a misspelling was found, or null if no match
 *
 * @example
 * isMisspellingPath("/clorify-invoice-generator") // => "/clorefy-invoice-generator"
 * isMisspellingPath("/tools/invoice-generator")   // => null
 */
export function isMisspellingPath(pathname: string): string | null {
  const lower = pathname.toLowerCase()

  for (const variant of MISSPELLING_VARIANTS) {
    if (lower.includes(variant)) {
      // Replace all occurrences of the misspelling with "clorefy" (case-insensitive)
      const corrected = lower.replace(new RegExp(variant, "gi"), "clorefy")
      return corrected
    }
  }

  return null
}

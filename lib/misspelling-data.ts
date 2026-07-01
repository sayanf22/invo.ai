/**
 * Misspelling and alternate spelling data for Clorefy brand protection.
 * Used by middleware to redirect misspelled URLs to the correct clorefy.com paths.
 *
 * DISAMBIGUATION: Clorefy (clorefy.com) ≠ Glorify (glorify.com).
 * Clorefy = AI document generation. Glorify = music app. Unrelated.
 * "glorify" is NOT redirected (we don't control glorify.com searches),
 * but all on-site content and Schema explicitly clarify the distinction.
 */

/**
 * Known misspellings and alternate spellings of "Clorefy".
 * These are checked against URL path segments to detect and redirect misspelled URLs.
 */
export const MISSPELLING_VARIANTS: string[] = [
  // Most common
  "clorify",
  "cloriphy",
  "clorephy",
  "clorafy",
  "clorefi",
  "clorfy",
  "clorifly",
  // Additional variants people type
  "cloerfy",
  "clorefe",
  "cloerify",
  "cloarfy",
  "cloreffy",
  "clorify",
  "cloreify",
  "cloerfi",
  "clorfi",
  "clorfiy",
  "cloerify",
  "clorefy",   // correct — kept for completeness in the variants list display
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
/**
 * Misspellings that should trigger URL redirects.
 * Subset of MISSPELLING_VARIANTS — excludes "clorefy" (correct, would cause a
 * redirect loop) and broad dictionary words that would match unrelated products.
 */
export const REDIRECT_VARIANTS: string[] = [
  "clorify",
  "cloriphy",
  "clorephy",
  "clorafy",
  "clorefi",
  "clorfy",
  "clorifly",
  "cloerfy",
  "clorefe",
  "cloerify",
  "cloarfy",
  "cloreffy",
  "cloreify",
  "cloerfi",
  "clorfi",
  "clorfiy",
]

/**
 * Variants ordered longest-first so that overlapping misspellings are matched
 * against the most specific variant. Without this, a shorter variant that is a
 * substring of a longer one (e.g. "clorfi" ⊂ "clorfiy") would match first and
 * produce a partial correction like "/clorefyy-..." instead of "/clorefy-...".
 */
const REDIRECT_VARIANTS_BY_SPECIFICITY: string[] = [...REDIRECT_VARIANTS].sort(
  (a, b) => b.length - a.length
)

export function isMisspellingPath(pathname: string): string | null {
  const lower = pathname.toLowerCase()

  for (const variant of REDIRECT_VARIANTS_BY_SPECIFICITY) {
    if (lower.includes(variant)) {
      const corrected = lower.replace(new RegExp(variant, "gi"), "clorefy")
      return corrected
    }
  }

  return null
}

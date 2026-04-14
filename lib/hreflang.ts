/**
 * Hreflang tag generation for international SEO.
 * Supports all 11 countries with correct ISO 639-1 + ISO 3166-1 Alpha-2 locale codes.
 */

import { SUPPORTED_COUNTRIES } from "@/lib/seo-data"

const BASE_URL = "https://clorefy.com"

/** The x-default country slug — always points to the USA variant */
const X_DEFAULT_COUNTRY = "usa"

export interface HreflangEntry {
  /** ISO 639-1 language + ISO 3166-1 Alpha-2 country code, e.g. "en-IN", or "x-default" */
  hrefLang: string
  /** Absolute URL for this locale variant */
  href: string
}

/**
 * Returns the ISO locale code for a given country slug.
 * Matches the locale field in SUPPORTED_COUNTRIES.
 */
export function getLocaleForCountry(countrySlug: string): string {
  const country = SUPPORTED_COUNTRIES.find((c) => c.slug === countrySlug)
  return country?.locale ?? "en"
}

/**
 * Returns 12 hreflang entries for a country-level document type page:
 * - 11 entries for each supported country locale
 * - 1 x-default entry pointing to the USA variant
 *
 * @param documentTypeSlug - e.g. "invoice-generator"
 */
export function getCountryHreflangTags(documentTypeSlug: string): HreflangEntry[] {
  const entries: HreflangEntry[] = SUPPORTED_COUNTRIES.map((country) => ({
    hrefLang: country.locale,
    href: `${BASE_URL}/tools/${documentTypeSlug}/${country.slug}`,
  }))

  // Add x-default pointing to USA variant
  entries.push({
    hrefLang: "x-default",
    href: `${BASE_URL}/tools/${documentTypeSlug}/${X_DEFAULT_COUNTRY}`,
  })

  return entries
}

/**
 * Returns a single hreflang entry for a city-level page.
 * Uses the locale of the parent country.
 *
 * @param countrySlug - e.g. "india"
 * @param documentTypeSlug - e.g. "invoice-generator"
 * @param citySlug - e.g. "mumbai"
 */
export function getCityHreflangTag(
  countrySlug: string,
  documentTypeSlug: string,
  citySlug: string
): HreflangEntry {
  const locale = getLocaleForCountry(countrySlug)
  return {
    hrefLang: locale,
    href: `${BASE_URL}/tools/${documentTypeSlug}/${countrySlug}/${citySlug}`,
  }
}

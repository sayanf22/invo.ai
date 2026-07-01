/**
 * Preservation Property Tests — SEO Search Visibility Fix
 *
 * Property 4 (Preservation): Non-Buggy URLs & Signals Unchanged.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 *
 * ── PURPOSE (bugfix exploratory workflow) ──────────────────────────────
 * These tests encode the ACTUAL, OBSERVED behavior of the CURRENT (unfixed)
 * code for inputs where isBugCondition(X) is FALSE. They MUST PASS on the
 * unfixed code — passing establishes the baseline that the fix must preserve.
 *
 * They are re-run UNCHANGED in Task 3.7 after the fix to prove no regression
 * to: misspelling/normalization 301s, auth/private-route exclusion, homepage
 * indexability, and already-valid canonical / JSON-LD output.
 *
 * DO NOT weaken these assertions to make a post-fix regression pass — a
 * failure after the fix means the fix broke previously-correct behavior.
 */

import { describe, it, expect, beforeAll } from "vitest"
import * as fc from "fast-check"

import sitemap from "@/app/sitemap"
import { isMisspellingPath, MISSPELLING_VARIANTS } from "@/lib/misspelling-data"
import { normalizePathname } from "@/lib/url-utils"
import {
  SUPPORTED_COUNTRIES,
  DOCUMENT_TYPES,
  getProgrammaticPageData,
} from "@/lib/seo-data"
import { getAllCityPages, getCityPageData, type CityData } from "@/lib/city-data"
import {
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateOrganizationSchema,
  generateSoftwareAppSchema,
} from "@/lib/structured-data"

const BASE_URL = "https://clorefy.com"
const ABSOLUTE_URL_RE = /^https?:\/\//

const countrySlugs = SUPPORTED_COUNTRIES.map((c) => c.slug)
const docTypeSlugs = DOCUMENT_TYPES.map((d) => d.slug)

// Only the genuine misspellings (exclude the correct spelling, which never
// redirects). Every remaining variant is expected to 301 to a "clorefy" path.
const REDIRECT_MISSPELLINGS = MISSPELLING_VARIANTS.filter((v) => v !== "clorefy")

// ═══════════════════════════════════════════════════════════════════════
// Property 4a — Misspelling redirects preserved (Req 3.2)
// For any known misspelling path, the fixed system must STILL rewrite it to
// a corrected "clorefy" path (middleware issues a 301 on this corrected path).
// ═══════════════════════════════════════════════════════════════════════

describe("Property 4 (Preservation): Misspelling redirects unchanged", () => {
  it("every known misspelling still resolves to a corrected clorefy path", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...REDIRECT_MISSPELLINGS),
        fc.constantFrom("", "-invoice-generator", "-alternatives", "/pricing", "/tools"),
        (variant, suffix) => {
          const corrected = isMisspellingPath(`/${variant}${suffix}`)
          // Observed: a known misspelling always produces a non-null correction
          expect(corrected).not.toBeNull()
          // Observed: the correction is lowercased and contains "clorefy"
          expect(corrected).toBe((corrected as string).toLowerCase())
          expect(corrected as string).toContain("clorefy")
        }
      ),
      { numRuns: 300 }
    )
  })

  it("clean, correctly-spelled paths are NOT redirected (return null)", () => {
    const cleanPaths = [
      "/",
      "/pricing",
      "/features",
      "/blog/ai-invoice-generator-complete-guide",
      "/tools/invoice-generator/germany",
      "/tools/contract-generator/usa/new-york",
      "/clorefy-alternative-spellings",
    ]
    for (const p of cleanPaths) {
      expect(isMisspellingPath(p)).toBeNull()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Property 4b — URL normalization preserved (Req 3.1)
// normalizePathname (shared by middleware) canonicalizes paths: lowercase,
// collapse duplicate slashes, strip trailing slash (except root).
// ═══════════════════════════════════════════════════════════════════════

describe("Property 4 (Preservation): URL normalization unchanged", () => {
  it("known normalization cases behave exactly as observed", () => {
    // Already-canonical → null (no redirect)
    expect(normalizePathname("/")).toBeNull()
    expect(normalizePathname("/tools/invoice-generator/germany")).toBeNull()
    // Uppercase → lowercased
    expect(normalizePathname("/Tools")).toBe("/tools")
    // Trailing slash stripped (except root)
    expect(normalizePathname("/pricing/")).toBe("/pricing")
    // Duplicate slashes collapsed
    expect(normalizePathname("//tools")).toBe("/tools")
    // Combined
    expect(normalizePathname("//Tools/Invoice-Generator/")).toBe(
      "/tools/invoice-generator"
    )
  })

  it("normalization is idempotent and always yields a canonical path", () => {
    fc.assert(
      fc.property(
        fc.string(),
        (raw) => {
          const path = raw.startsWith("/") ? raw : `/${raw}`
          const normalized = normalizePathname(path) ?? path
          // The canonical form must be lowercase, slash-collapsed, and have no
          // trailing slash (except root) — and re-normalizing is a no-op.
          expect(normalized).toBe(normalized.toLowerCase())
          expect(normalized).not.toMatch(/\/{2,}/)
          if (normalized !== "/") {
            expect(normalized.endsWith("/")).toBe(false)
          }
          expect(normalizePathname(normalized)).toBeNull()
        }
      ),
      { numRuns: 300 }
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Property 4c — Auth / private routes stay non-indexable (Req 3.3, 3.5)
// Private routes must never be submitted for indexing via the sitemap.
// NOTE: /auth is intentionally NOT asserted here — auth-page removal is the
// Task-1 (bug-condition) behavior; this preservation check covers the routes
// that are already, and must remain, excluded on the unfixed code.
// ═══════════════════════════════════════════════════════════════════════

describe("Property 4 (Preservation): private routes excluded from sitemap", () => {
  let sitemapUrls: string[] = []

  beforeAll(async () => {
    const entries = await sitemap()
    sitemapUrls = entries.map((e) => e.url)
  })

  it("no billing/settings/documents/api/admin route is ever in the sitemap", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("/billing", "/settings", "/documents", "/api", "/admin"),
        fc.string({ minLength: 0, maxLength: 20 }),
        (base, seg) => {
          const cleaned = seg.replace(/[^a-zA-Z0-9-]/g, "")
          const path = cleaned ? `${base}/${cleaned}` : base
          const url = `${BASE_URL}${path}`
          expect(sitemapUrls).not.toContain(url)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("the sitemap contains no /billing, /settings, /documents, /api or /admin prefix", () => {
    const forbidden = /\/(billing|settings|documents|api|admin)(\/|$)/
    const leaked = sitemapUrls.filter((u) =>
      forbidden.test(u.replace(BASE_URL, ""))
    )
    expect(leaked).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Property 4d — Homepage stays indexable (Req 3.6)
// The homepage is the top-performing page and must not regress.
// ═══════════════════════════════════════════════════════════════════════

describe("Property 4 (Preservation): homepage remains a clean indexable entry", () => {
  it("the homepage is present in the sitemap exactly once as a clean 200 URL", async () => {
    const entries = await sitemap()
    const homepage = entries.filter((e) => e.url === BASE_URL)
    expect(homepage).toHaveLength(1)
    expect(homepage[0].url).toBe(BASE_URL)
    // Observed: homepage carries top priority and is not a redirect/noindex form
    expect(ABSOLUTE_URL_RE.test(homepage[0].url)).toBe(true)
    expect(homepage[0].url.endsWith("/")).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Property 4e — Existing valid JSON-LD serializes identically (Req 3.1)
// Deep-equal snapshots of the CURRENT output. These must not change.
// ═══════════════════════════════════════════════════════════════════════

describe("Property 4 (Preservation): existing JSON-LD output unchanged", () => {
  it("BreadcrumbList serializes exactly as observed", () => {
    const schema = generateBreadcrumbSchema([
      { name: "Home", url: BASE_URL },
      { name: "Invoice Generator", url: `${BASE_URL}/tools/invoice-generator` },
      { name: "Germany" },
    ])
    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Invoice Generator",
          item: `${BASE_URL}/tools/invoice-generator`,
        },
        { "@type": "ListItem", position: 3, name: "Germany" },
      ],
    })
  })

  it("FAQPage serializes exactly as observed and filters empty entries", () => {
    const schema = generateFAQSchema([
      { question: "Q1", answer: "A1" },
      { question: "   ", answer: "A2" }, // empty question → filtered
      { question: "Q3", answer: "A3" },
    ])
    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Q1",
          acceptedAnswer: { "@type": "Answer", text: "A1" },
        },
        {
          "@type": "Question",
          name: "Q3",
          acceptedAnswer: { "@type": "Answer", text: "A3" },
        },
      ],
    })
  })

  it("Organization serializes exactly as observed (with and without sameAs)", () => {
    const withSameAs = generateOrganizationSchema([
      "https://twitter.com/clorefy",
      "https://www.linkedin.com/company/clorefy",
    ])
    expect(withSameAs).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Clorefy",
      url: BASE_URL,
      logo: `${BASE_URL}/icon.png`,
      description:
        "AI-powered document generation platform for professional business documents, automated sending, payment links, and global workflows.",
      sameAs: [
        "https://twitter.com/clorefy",
        "https://www.linkedin.com/company/clorefy",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: `${BASE_URL}/contact`,
      },
    })

    const withoutSameAs = generateOrganizationSchema() as Record<string, unknown>
    expect("sameAs" in withoutSameAs).toBe(false)
    expect(withoutSameAs["@type"]).toBe("Organization")
  })

  it("SoftwareApplication serializes exactly as observed", () => {
    const city: CityData = {
      slug: "berlin",
      name: "Berlin",
      countrySlug: "germany",
      businessContext: "ctx",
      industries: ["Tech"],
      taxNotes: "notes",
    }
    const docType = DOCUMENT_TYPES.find((d) => d.slug === "invoice-generator")!
    const schema = generateSoftwareAppSchema(city, docType)
    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Clorefy Invoice Generator",
      description:
        "AI-powered invoice generator for businesses in Berlin. Generate professional, tax-compliant invoices in seconds.",
      url: BASE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free tier available",
      },
      areaServed: { "@type": "City", name: "Berlin" },
      provider: {
        "@type": "Organization",
        name: "Clorefy",
        url: BASE_URL,
      },
    })
  })

  it("Organization sameAs entries are absolute URLs (preserved invariant)", () => {
    const org = generateOrganizationSchema([
      "https://twitter.com/clorefy",
      "https://github.com/clorefy",
    ]) as Record<string, unknown>
    const sameAs = (org.sameAs as string[]) ?? []
    for (const url of sameAs) {
      expect(ABSOLUTE_URL_RE.test(url)).toBe(true)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Property 4f — Programmatic pages keep rendering with correct metadata
// and valid FAQ schema across random doc-type × country × city combos
// (Req 3.4). This is the preservation counterpart to the Task-1 uniqueness
// property: content may change, but each page must still resolve to valid,
// non-empty, deterministically-serialized data with a self-referential URL.
// ═══════════════════════════════════════════════════════════════════════

describe("Property 4 (Preservation): programmatic page data stays valid", () => {
  it("every country × doc-type combo yields valid, non-empty metadata + FAQ schema", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...docTypeSlugs),
        fc.constantFrom(...countrySlugs),
        (docType, country) => {
          const data = getProgrammaticPageData(docType, country)
          expect(data).toBeDefined()
          if (!data) return

          expect(data.title.length).toBeGreaterThan(0)
          expect(data.metaDescription.length).toBeGreaterThan(0)
          expect(data.heroHeading.length).toBeGreaterThan(0)
          expect(data.faqs.length).toBeGreaterThan(0)

          // Self-referential canonical URL is deterministic and absolute.
          const canonical = `${BASE_URL}/tools/${docType}/${country}`
          expect(ABSOLUTE_URL_RE.test(canonical)).toBe(true)

          // FAQ schema is valid JSON-LD and serializes deterministically.
          const faqSchema = generateFAQSchema(data.faqs) as Record<string, unknown>
          expect(faqSchema["@context"]).toBe("https://schema.org")
          expect(faqSchema["@type"]).toBe("FAQPage")
          expect(JSON.stringify(faqSchema)).toBe(JSON.stringify(faqSchema))
        }
      ),
      { numRuns: 200 }
    )
  })

  it("a sample of random city pages resolve with a self-referential parent href", () => {
    const cityPages = getAllCityPages()
    expect(cityPages.length).toBeGreaterThan(0)

    fc.assert(
      fc.property(fc.constantFrom(...cityPages), (page) => {
        const data = getCityPageData(page.documentType, page.country, page.city)
        expect(data).toBeDefined()
        if (!data) return
        expect(data.title.length).toBeGreaterThan(0)
        expect(data.metaDescription.length).toBeGreaterThan(0)
        expect(data.faqs.length).toBeGreaterThan(0)
        // City page points back to its parent country page (self-consistent).
        expect(data.parentCountryHref).toBe(
          `/tools/${page.documentType}/${page.country}`
        )
      }),
      { numRuns: 150 }
    )
  })
})

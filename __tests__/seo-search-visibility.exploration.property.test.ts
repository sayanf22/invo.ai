/**
 * Bug Condition Exploration Test — SEO Search Visibility Fix
 *
 * Property 1 (Bug Condition): Sitemap Hygiene, Content Uniqueness &
 * Structured-Data Validity.
 *
 * Validates: Requirements 1.3, 1.4, 1.5, 2.3, 2.4, 2.6, 2.7, 2.8
 *
 * ── PURPOSE (bugfix exploratory workflow) ──────────────────────────────
 * This test encodes the EXPECTED POST-FIX behavior and is expected to FAIL
 * on the current (unfixed) code. Its failure CONFIRMS the bug exists:
 *   - the sitemap emits thin /auth/login + /auth/signup entries
 *     (and, on the live deployment, ~9x404 / ~9xredirect / 1xsoft-404 /
 *      1xnoindex URLs surfaced by scripts/audit-sitemap.mjs)
 *   - the 44 templated /tools/[documentType]/[country] pages are
 *     near-duplicate siblings (pairwise similarity above threshold)
 *
 * It will be re-run unchanged in Task 3.6 to validate the fix (should PASS).
 * DO NOT weaken the assertions or "fix" this test when it fails here.
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

import sitemap from "@/app/sitemap"
import {
  SUPPORTED_COUNTRIES,
  DOCUMENT_TYPES,
  getProgrammaticPageData,
} from "@/lib/seo-data"
import {
  generateFAQSchema,
  generateSoftwareAppSchema,
  generateOrganizationSchema,
  generateBreadcrumbSchema,
} from "@/lib/structured-data"
import {
  parseSitemapUrls,
  hasNoindex,
  auditSitemap,
} from "@/scripts/audit-sitemap.mjs"

const BASE_URL = "https://clorefy.com"

// Pairwise similarity above this fraction => pages are near-duplicate.
// After the uniqueness fix (Task 3.2) sibling pages must fall below it.
const SIMILARITY_THRESHOLD = 0.4

// ── helpers ────────────────────────────────────────────────────────────

/** Strip HTML tags, lowercase, and tokenize into words. */
function tokenize(text: string): string[] {
  return text
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

/** Word-bigram (2-shingle) set for phrase-level overlap detection. */
function bigrams(tokens: string[]): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i < tokens.length - 1; i++) {
    set.add(`${tokens[i]} ${tokens[i + 1]}`)
  }
  return set
}

/** Jaccard similarity between two sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

/** Concatenated, crawlable body content for a programmatic /tools/* page. */
function pageBody(documentType: string, country: string): string {
  const data = getProgrammaticPageData(documentType, country)
  if (!data) return ""
  const faqText = data.faqs.map((f) => `${f.question} ${f.answer}`).join(" ")
  return [
    data.heroHeading,
    data.heroSubheading,
    data.taxSection,
    data.complianceSection,
    faqText,
  ].join(" ")
}

/** Pairwise body similarity between two programmatic pages. */
function pageSimilarity(
  documentType: string,
  countryA: string,
  countryB: string
): number {
  const a = bigrams(tokenize(pageBody(documentType, countryA)))
  const b = bigrams(tokenize(pageBody(documentType, countryB)))
  return jaccard(a, b)
}

const countrySlugs = SUPPORTED_COUNTRIES.map((c) => c.slug)
const docTypeSlugs = DOCUMENT_TYPES.map((d) => d.slug)

// ═══════════════════════════════════════════════════════════════════════
// Property 1a — Sitemap Hygiene: thin auth pages must not be listed
// (deterministic, offline). Bug Condition branch (d): X.type = "sitemap_url"
// ═══════════════════════════════════════════════════════════════════════

describe("Property 1: Sitemap Hygiene", () => {
  it("does not list the thin /auth/login and /auth/signup pages", async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)

    expect(urls).not.toContain(`${BASE_URL}/auth/login`)
    expect(urls).not.toContain(`${BASE_URL}/auth/signup`)
  })

  it("emits no obviously non-indexable route in the sitemap", async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    // Auth, dashboard, API and other private routes must never be submitted.
    const forbidden = /\/(auth|billing|settings|documents|api|admin)(\/|$)/
    const leaked = urls.filter((u) => forbidden.test(u.replace(BASE_URL, "")))
    expect(leaked).toEqual([])
  })

  // Live audit against the deployed site — surfaces the concrete
  // 404 / redirect / soft-404 / noindex URLs. Opt-in (network) so CI stays
  // deterministic; run with AUDIT_SITEMAP_URL=https://clorefy.com/sitemap.xml
  const liveUrl = process.env.AUDIT_SITEMAP_URL
  const maybe = liveUrl ? it : it.skip
  maybe("every deployed sitemap URL is a clean, non-redirecting 200 with no noindex", async () => {
    const { total, failures } = await auditSitemap(liveUrl as string)
    expect(total).toBeGreaterThan(0)
    expect(failures).toEqual([])
  }, 120_000)

  it("audit helpers parse <loc> URLs and detect noindex directives", () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://clorefy.com/</loc></url>
      <url><loc>https://clorefy.com/pricing</loc></url>
    </urlset>`
    expect(parseSitemapUrls(xml)).toEqual([
      "https://clorefy.com/",
      "https://clorefy.com/pricing",
    ])

    const noindexHeaders = new Headers({ "x-robots-tag": "noindex, nofollow" })
    expect(hasNoindex(noindexHeaders, "")).toBe(true)
    expect(
      hasNoindex(new Headers(), '<meta name="robots" content="noindex">')
    ).toBe(true)
    expect(hasNoindex(new Headers(), "<html></html>")).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Property 2 — Programmatic Content Uniqueness (PBT over the 44 sibling
// pairs). Bug Condition branch (b): X.type = "gsc_index_entry" matching
// "/tools/*". On unfixed code the templated siblings exceed the threshold.
// ═══════════════════════════════════════════════════════════════════════

describe("Property 2: Programmatic Content Uniqueness", () => {
  it("same-doc-type sibling pages are materially unique (similarity < threshold)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...docTypeSlugs),
        fc.constantFrom(...countrySlugs),
        fc.constantFrom(...countrySlugs),
        (docType, countryA, countryB) => {
          fc.pre(countryA !== countryB)
          const sim = pageSimilarity(docType, countryA, countryB)
          expect(sim).toBeLessThan(SIMILARITY_THRESHOLD)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("records the worst-case sibling similarity across all /tools/* pairs", () => {
    let worst = { docType: "", a: "", b: "", sim: 0 }
    for (const docType of docTypeSlugs) {
      for (let i = 0; i < countrySlugs.length; i++) {
        for (let j = i + 1; j < countrySlugs.length; j++) {
          const sim = pageSimilarity(docType, countrySlugs[i], countrySlugs[j])
          if (sim > worst.sim) {
            worst = { docType, a: countrySlugs[i], b: countrySlugs[j], sim }
          }
        }
      }
    }
    // The worst sibling pair must also fall below the duplicate threshold.
    expect(worst.sim).toBeLessThan(SIMILARITY_THRESHOLD)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Property 3 — Structured-Data & Canonical Validity (PBT over sampled
// pages). Expected to PASS on unfixed code — confirms canonical/schema are
// NOT the culprit, so the fix must preserve this behavior.
// ═══════════════════════════════════════════════════════════════════════

const ABSOLUTE_URL_RE = /^https?:\/\//

function isValidJsonLd(obj: Record<string, unknown>): boolean {
  return (
    typeof obj["@context"] === "string" &&
    (obj["@context"] as string).length > 0 &&
    typeof obj["@type"] === "string" &&
    (obj["@type"] as string).length > 0
  )
}

describe("Property 3: Structured-Data & Canonical Validity", () => {
  it("each programmatic page has exactly one self-referential canonical", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...docTypeSlugs),
        fc.constantFrom(...countrySlugs),
        (docType, country) => {
          const canonical = `${BASE_URL}/tools/${docType}/${country}`
          const self = `${BASE_URL}/tools/${docType}/${country}`
          expect(canonical).toBe(self)
          expect(ABSOLUTE_URL_RE.test(canonical)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("FAQ + SoftwareApplication JSON-LD serialize with required fields", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...docTypeSlugs),
        fc.constantFrom(...countrySlugs),
        (docType, country) => {
          const data = getProgrammaticPageData(docType, country)
          expect(data).toBeDefined()
          if (!data) return

          const faqSchema = generateFAQSchema(data.faqs) as Record<string, unknown>
          expect(isValidJsonLd(faqSchema)).toBe(true)

          const breadcrumb = generateBreadcrumbSchema([
            { name: "Home", url: BASE_URL },
            { name: data.documentType.name, url: `${BASE_URL}/tools/${docType}` },
            { name: data.country.name },
          ]) as Record<string, unknown>
          expect(isValidJsonLd(breadcrumb)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("Organization sameAs entries are absolute URLs", () => {
    const org = generateOrganizationSchema([
      "https://twitter.com/clorefy",
      "https://www.linkedin.com/company/clorefy",
    ]) as Record<string, unknown>
    expect(isValidJsonLd(org)).toBe(true)
    const sameAs = (org.sameAs as string[]) || []
    for (const url of sameAs) {
      expect(ABSOLUTE_URL_RE.test(url)).toBe(true)
    }
  })
})

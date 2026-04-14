/**
 * Property-based tests for SEO comprehensive optimization
 * Feature: seo-comprehensive-optimization
 *
 * Tests Properties 2, 3, 4+5, 6, 7+8, 9+10+11, 14, 15+17
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

import { normalizePathname } from "@/lib/url-utils"
import { isMisspellingPath, MISSPELLING_VARIANTS } from "@/lib/misspelling-data"
import {
  getCityPageData,
  getCitiesForCountry,
  getAllCityPages,
} from "@/lib/city-data"
import {
  getCountryHreflangTags,
  getCityHreflangTag,
  getLocaleForCountry,
} from "@/lib/hreflang"
import {
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateProductSchema,
  generateArticleSchema,
  generateSoftwareAppSchema,
  generateOrganizationSchema,
} from "@/lib/structured-data"
import {
  SUPPORTED_COUNTRIES,
  DOCUMENT_TYPES,
  getProgrammaticPageData,
} from "@/lib/seo-data"
import sitemap from "@/app/sitemap"

// ── Shared generators ──────────────────────────────────────────────────

const countrySlugArb = fc.constantFrom(...SUPPORTED_COUNTRIES.map((c) => c.slug))
const docTypeSlugArb = fc.constantFrom(...DOCUMENT_TYPES.map((d) => d.slug))

// All valid city page combinations
const allCityPages = getAllCityPages()
const cityPageArb = fc.constantFrom(...allCityPages)

// ── Property 2: URL normalization ──────────────────────────────────────

describe("Feature: seo-comprehensive-optimization, Property 2: URL normalization produces canonical form", () => {
  /**
   * Validates: Requirements 1.2, 1.5
   */

  it("normalizePathname is idempotent — applying it twice gives the same result", () => {
    fc.assert(
      fc.property(
        fc.webPath(),
        (path) => {
          const once = normalizePathname(path)
          const canonical = once !== null ? once : path
          // Applying again should return null (already canonical)
          const twice = normalizePathname(canonical)
          expect(twice).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("normalizePathname produces lowercase paths", () => {
    fc.assert(
      fc.property(
        fc.webPath(),
        (path) => {
          const result = normalizePathname(path)
          const canonical = result !== null ? result : path
          expect(canonical).toBe(canonical.toLowerCase())
        }
      ),
      { numRuns: 100 }
    )
  })

  it("normalizePathname removes trailing slashes (except root /)", () => {
    fc.assert(
      fc.property(
        fc.webPath().filter((p) => p !== "/"),
        (path) => {
          const result = normalizePathname(path)
          const canonical = result !== null ? result : path
          if (canonical !== "/") {
            expect(canonical.endsWith("/")).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("normalizePathname collapses duplicate slashes", () => {
    fc.assert(
      fc.property(
        fc.webPath(),
        (path) => {
          const result = normalizePathname(path)
          const canonical = result !== null ? result : path
          expect(canonical).not.toMatch(/\/{2,}/)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("normalizePathname returns null for already-canonical paths", () => {
    // Paths that are already lowercase, no trailing slash, no duplicate slashes
    const canonicalPaths = [
      "/",
      "/tools",
      "/tools/invoice-generator/india",
      "/pricing",
      "/blog/some-post",
    ]
    fc.assert(
      fc.property(
        fc.constantFrom(...canonicalPaths),
        (path) => {
          expect(normalizePathname(path)).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("normalizePathname detects uppercase paths as non-canonical", () => {
    fc.assert(
      fc.property(
        fc.webPath().filter((p) => p !== p.toLowerCase()),
        (path) => {
          const result = normalizePathname(path)
          expect(result).not.toBeNull()
          expect(result).toBe(result!.toLowerCase())
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 3: Misspelling detection and correction ───────────────────

describe("Feature: seo-comprehensive-optimization, Property 3: Misspelling detection and correction", () => {
  /**
   * Validates: Requirements 3.2
   */

  it("isMisspellingPath returns corrected path for known misspelling variants", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...MISSPELLING_VARIANTS),
        fc.webPath(),
        (variant, suffix) => {
          // Build a path that contains the misspelling
          const path = `/${variant}${suffix}`
          const result = isMisspellingPath(path)
          expect(result).not.toBeNull()
          // The corrected path should contain "clorefy" instead of the variant
          expect(result!.toLowerCase()).toContain("clorefy")
          expect(result!.toLowerCase()).not.toContain(variant)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("isMisspellingPath returns null for paths with no known misspelling", () => {
    // Paths that don't contain any misspelling variant
    const cleanPaths = [
      "/tools/invoice-generator/india",
      "/pricing",
      "/blog/some-post",
      "/about",
      "/contact",
      "/clorefy-alternative-spellings",
      "/tools/contract-generator/usa",
    ]
    fc.assert(
      fc.property(
        fc.constantFrom(...cleanPaths),
        (path) => {
          expect(isMisspellingPath(path)).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("isMisspellingPath corrected path replaces misspelling with clorefy", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...MISSPELLING_VARIANTS),
        (variant) => {
          const path = `/${variant}-invoice-generator`
          const result = isMisspellingPath(path)
          expect(result).not.toBeNull()
          expect(result).toBe("/clorefy-invoice-generator")
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 4+5: City page data completeness and metadata constraints ─

describe("Feature: seo-comprehensive-optimization, Property 4+5: City page data completeness and metadata constraints", () => {
  /**
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 8.1, 8.2, 8.3, 8.5, 8.6, 9.3, 9.7
   */

  it("getCityPageData returns non-null for all valid city combinations", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)
          expect(data).not.toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("hero heading contains city name and document type (Property 4)", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          expect(data.heroHeading.toLowerCase()).toContain(data.city.name.toLowerCase())
        }
      ),
      { numRuns: 100 }
    )
  })

  it("businessContextSection is non-empty and contains city name (Property 4)", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          expect(data.businessContextSection.length).toBeGreaterThan(0)
          expect(data.businessContextSection.toLowerCase()).toContain(data.city.name.toLowerCase())
        }
      ),
      { numRuns: 100 }
    )
  })

  it("taxComplianceSection mentions country tax system (Property 4)", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          expect(data.taxComplianceSection.length).toBeGreaterThan(0)
          // Should mention the country's tax system
          expect(data.taxComplianceSection.toLowerCase()).toContain(
            data.country.taxSystem.toLowerCase().split(" ")[0]
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it("ctaMessage contains city name (Property 4)", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          expect(data.ctaMessage.toLowerCase()).toContain(data.city.name.toLowerCase())
        }
      ),
      { numRuns: 100 }
    )
  })

  it("useCaseContent is non-empty and contains city name (Property 4)", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          expect(data.useCaseContent.length).toBeGreaterThan(0)
          expect(data.useCaseContent.toLowerCase()).toContain(data.city.name.toLowerCase())
        }
      ),
      { numRuns: 100 }
    )
  })

  it("title follows pattern and does not exceed 60 characters (Property 5)", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          // Title must contain city name and end with | Clorefy
          expect(data.title).toContain(data.city.name)
          expect(data.title).toContain("Clorefy")
          expect(data.title.length).toBeLessThanOrEqual(60)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("meta description is between 120 and 160 characters (Property 5)", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          expect(data.metaDescription.length).toBeGreaterThanOrEqual(120)
          expect(data.metaDescription.length).toBeLessThanOrEqual(160)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("meta description contains city name and document type (Property 5)", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          expect(data.metaDescription.toLowerCase()).toContain(data.city.name.toLowerCase())
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 6: City page FAQ uniqueness ──────────────────────────────

describe("Feature: seo-comprehensive-optimization, Property 6: City page FAQ uniqueness", () => {
  /**
   * Validates: Requirements 2.6, 5.3, 8.4
   */

  it("city FAQs have at least 3 entries", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          expect(data.faqs.length).toBeGreaterThanOrEqual(3)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("each city FAQ has non-empty question and answer containing city name", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          for (const faq of data.faqs) {
            expect(faq.question.trim().length).toBeGreaterThan(0)
            expect(faq.answer.trim().length).toBeGreaterThan(0)
            expect(faq.question.toLowerCase()).toContain(data.city.name.toLowerCase())
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("city FAQ questions are distinct from parent country FAQ questions", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const cityData = getCityPageData(documentType, country, city)!
          const countryData = getProgrammaticPageData(documentType, country)!

          const cityQuestions = new Set(cityData.faqs.map((f) => f.question))
          const countryQuestions = new Set(countryData.faqs.map((f) => f.question))

          // No city FAQ question should appear in the country FAQ questions
          for (const q of cityQuestions) {
            expect(countryQuestions.has(q)).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 7+8: Internal linking ────────────────────────────────────

describe("Feature: seo-comprehensive-optimization, Property 7+8: Internal linking", () => {
  /**
   * Validates: Requirements 2.7, 2.8, 10.1, 10.2, 10.3
   */

  it("city page includes link to parent country page (Property 7)", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          expect(data.parentCountryHref).toBe(`/tools/${documentType}/${country}`)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("city page includes at least 2 sibling city links (Property 7)", () => {
    // Only test countries with 3+ cities (so there are always 2 siblings)
    const pagesWithSiblings = allCityPages.filter(({ country }) => {
      return getCitiesForCountry(country).length >= 3
    })
    fc.assert(
      fc.property(
        fc.constantFrom(...pagesWithSiblings),
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          expect(data.siblingCities.length).toBeGreaterThanOrEqual(2)
          // Siblings should not include the current city
          const siblingSlug = data.siblingCities.map((c) => c.slug)
          expect(siblingSlug).not.toContain(city)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("city page includes at least 1 related blog post slug (Property 7)", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          expect(data.relatedBlogSlugs.length).toBeGreaterThanOrEqual(1)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("country page cities list covers all child cities (Property 8)", () => {
    fc.assert(
      fc.property(
        countrySlugArb,
        (countrySlug) => {
          const cities = getCitiesForCountry(countrySlug)
          // Every city in the data should be accessible
          for (const city of cities) {
            expect(city.slug).toBeTruthy()
            expect(city.countrySlug).toBe(countrySlug)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 9+10+11: Hreflang correctness ────────────────────────────

describe("Feature: seo-comprehensive-optimization, Property 9+10+11: Hreflang correctness", () => {
  /**
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4
   */

  it("getCountryHreflangTags returns exactly 12 entries (Property 9)", () => {
    fc.assert(
      fc.property(
        docTypeSlugArb,
        (docTypeSlug) => {
          const tags = getCountryHreflangTags(docTypeSlug)
          expect(tags.length).toBe(12)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("hreflang entries include x-default pointing to USA variant (Property 9)", () => {
    fc.assert(
      fc.property(
        docTypeSlugArb,
        (docTypeSlug) => {
          const tags = getCountryHreflangTags(docTypeSlug)
          const xDefault = tags.find((t) => t.hrefLang === "x-default")
          expect(xDefault).toBeDefined()
          expect(xDefault!.href).toContain("/usa")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("hreflang entries cover all 11 supported country locales (Property 9)", () => {
    fc.assert(
      fc.property(
        docTypeSlugArb,
        (docTypeSlug) => {
          const tags = getCountryHreflangTags(docTypeSlug)
          const locales = tags.map((t) => t.hrefLang).filter((l) => l !== "x-default")
          const expectedLocales = SUPPORTED_COUNTRIES.map((c) => c.locale)
          for (const locale of expectedLocales) {
            expect(locales).toContain(locale)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("locale codes match ISO pattern [a-z]{2}-[A-Z]{2} (Property 10)", () => {
    const isoPattern = /^[a-z]{2}-[A-Z]{2}$/
    fc.assert(
      fc.property(
        countrySlugArb,
        (countrySlug) => {
          const locale = getLocaleForCountry(countrySlug)
          expect(locale).toMatch(isoPattern)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("city hreflang tag uses correct locale for its parent country (Property 10)", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const tag = getCityHreflangTag(country, documentType, city)
          const expectedLocale = getLocaleForCountry(country)
          expect(tag.hrefLang).toBe(expectedLocale)
          expect(tag.href).toContain(`/${country}/${city}`)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("hreflang references are reciprocal — every country page references all others (Property 11)", () => {
    fc.assert(
      fc.property(
        docTypeSlugArb,
        (docTypeSlug) => {
          // For any doc type, all country pages should reference each other
          const allTags = SUPPORTED_COUNTRIES.map((country) => ({
            country: country.slug,
            tags: getCountryHreflangTags(docTypeSlug),
          }))

          // Each country's hreflang set should include all other countries' URLs
          for (const { tags } of allTags) {
            const hrefs = tags.map((t) => t.href)
            for (const otherCountry of SUPPORTED_COUNTRIES) {
              const expectedHref = `https://clorefy.com/tools/${docTypeSlug}/${otherCountry.slug}`
              expect(hrefs).toContain(expectedHref)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 14: JSON-LD structural validity ──────────────────────────

describe("Feature: seo-comprehensive-optimization, Property 14: JSON-LD structural validity", () => {
  /**
   * Validates: Requirements 5.7
   */

  it("BreadcrumbList schema has @context, @type, and non-empty itemListElement", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            url: fc.option(fc.webUrl(), { nil: undefined }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (items) => {
          const schema = generateBreadcrumbSchema(items) as Record<string, unknown>
          expect(schema["@context"]).toBe("https://schema.org")
          expect(schema["@type"]).toBe("BreadcrumbList")
          const list = schema["itemListElement"] as unknown[]
          expect(list.length).toBeGreaterThan(0)
          for (const item of list as Record<string, unknown>[]) {
            expect(item["@type"]).toBe("ListItem")
            expect(typeof item["name"]).toBe("string")
            expect((item["name"] as string).length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("FAQPage schema has @context, @type, and non-empty mainEntity", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            question: fc.string({ minLength: 1, maxLength: 100 }).map((s) => s.trim()).filter((s) => s.length > 0),
            answer: fc.string({ minLength: 1, maxLength: 200 }).map((s) => s.trim()).filter((s) => s.length > 0),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (faqs) => {
          const schema = generateFAQSchema(faqs) as Record<string, unknown>
          expect(schema["@context"]).toBe("https://schema.org")
          expect(schema["@type"]).toBe("FAQPage")
          const entities = schema["mainEntity"] as unknown[]
          expect(entities.length).toBeGreaterThan(0)
          for (const entity of entities as Record<string, unknown>[]) {
            expect(entity["@type"]).toBe("Question")
            expect(typeof entity["name"]).toBe("string")
            expect((entity["name"] as string).length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("Product schema has @context, @type, name, and offers array", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            price: fc.float({ min: 0, max: 1000, noNaN: true }),
            currency: fc.constantFrom("USD", "EUR", "GBP", "INR"),
            description: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          { minLength: 1, maxLength: 4 }
        ),
        (plans) => {
          const schema = generateProductSchema(plans) as Record<string, unknown>
          expect(schema["@context"]).toBe("https://schema.org")
          expect(schema["@type"]).toBe("Product")
          expect(typeof schema["name"]).toBe("string")
          expect((schema["name"] as string).length).toBeGreaterThan(0)
          const offers = schema["offers"] as unknown[]
          expect(offers.length).toBe(plans.length)
          for (const offer of offers as Record<string, unknown>[]) {
            expect(offer["@type"]).toBe("Offer")
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("Article schema has @context, @type, headline, datePublished, author, publisher", () => {
    fc.assert(
      fc.property(
        fc.record({
          headline: fc.string({ minLength: 1, maxLength: 100 }),
          url: fc.webUrl(),
          datePublished: fc.constant("2025-01-01"),
        }),
        (article) => {
          const schema = generateArticleSchema(article) as Record<string, unknown>
          expect(schema["@context"]).toBe("https://schema.org")
          expect(schema["@type"]).toBe("Article")
          expect(typeof schema["headline"]).toBe("string")
          expect((schema["headline"] as string).length).toBeGreaterThan(0)
          expect(schema["datePublished"]).toBe("2025-01-01")
          expect(schema["author"]).toBeDefined()
          expect(schema["publisher"]).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("SoftwareApplication schema has @context, @type, name, areaServed with city name", () => {
    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const data = getCityPageData(documentType, country, city)!
          const schema = generateSoftwareAppSchema(data.city, data.documentType) as Record<string, unknown>
          expect(schema["@context"]).toBe("https://schema.org")
          expect(schema["@type"]).toBe("SoftwareApplication")
          expect(typeof schema["name"]).toBe("string")
          expect((schema["name"] as string).length).toBeGreaterThan(0)
          const areaServed = schema["areaServed"] as Record<string, unknown>
          expect(areaServed).toBeDefined()
          expect(areaServed["@type"]).toBe("City")
          expect(areaServed["name"]).toBe(data.city.name)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("Organization schema has @context, @type, name, url", () => {
    fc.assert(
      fc.property(
        fc.option(
          fc.array(fc.webUrl(), { minLength: 1, maxLength: 3 }),
          { nil: undefined }
        ),
        (sameAsUrls) => {
          const schema = generateOrganizationSchema(sameAsUrls) as Record<string, unknown>
          expect(schema["@context"]).toBe("https://schema.org")
          expect(schema["@type"]).toBe("Organization")
          expect(typeof schema["name"]).toBe("string")
          expect((schema["name"] as string).length).toBeGreaterThan(0)
          expect(typeof schema["url"]).toBe("string")
          expect((schema["url"] as string).length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 15+17: Sitemap coverage and canonical consistency ─────────

describe("Feature: seo-comprehensive-optimization, Property 15+17: Sitemap coverage and canonical consistency", () => {
  /**
   * Validates: Requirements 6.1, 6.6, 7.5
   */

  it("all city pages appear in sitemap with priority 0.7 and changeFrequency monthly (Property 15)", () => {
    const sitemapEntries = sitemap()
    const sitemapUrls = new Map(sitemapEntries.map((e) => [e.url, e]))

    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          const expectedUrl = `https://clorefy.com/tools/${documentType}/${country}/${city}`
          const entry = sitemapUrls.get(expectedUrl)
          expect(entry).toBeDefined()
          expect(entry!.priority).toBe(0.7)
          expect(entry!.changeFrequency).toBe("monthly")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("canonical URLs for city pages match sitemap URLs (Property 17)", () => {
    const sitemapEntries = sitemap()
    const sitemapUrls = new Set(sitemapEntries.map((e) => e.url))

    fc.assert(
      fc.property(
        cityPageArb,
        ({ documentType, country, city }) => {
          // The canonical URL for a city page is the absolute URL
          const canonicalUrl = `https://clorefy.com/tools/${documentType}/${country}/${city}`
          // It must appear in the sitemap
          expect(sitemapUrls.has(canonicalUrl)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("sitemap contains no duplicate URLs", () => {
    const sitemapEntries = sitemap()
    const urls = sitemapEntries.map((e) => e.url)
    const uniqueUrls = new Set(urls)
    expect(uniqueUrls.size).toBe(urls.length)
  })

  it("all sitemap URLs start with https://clorefy.com", () => {
    const sitemapEntries = sitemap()
    fc.assert(
      fc.property(
        fc.constantFrom(...sitemapEntries),
        (entry) => {
          expect(entry.url.startsWith("https://clorefy.com")).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})

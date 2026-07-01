import type { MetadataRoute } from "next"
import { getAllCombinedPosts } from "@/lib/blog-combined"
import { getAllProgrammaticPages } from "@/lib/seo-data"
import { getAllCityPages } from "@/lib/city-data"

const BASE_URL = "https://clorefy.com"

export const revalidate = 3600 // Regenerate sitemap every hour (picks up new blog posts)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Public marketing pages (indexed, high priority) ──────────────────
  // Use hardcoded content timestamps instead of current date for static pages
  const marketingPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date("2026-04-01"), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/pricing`, lastModified: new Date("2026-04-01"), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/features`, lastModified: new Date("2026-04-01"), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastModified: new Date("2026-04-01"), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/business`, lastModified: new Date("2026-01-01"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/resources`, lastModified: new Date("2026-01-01"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/integrations`, lastModified: new Date("2026-01-01"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/developers`, lastModified: new Date("2026-01-01"), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/contact`, lastModified: new Date("2026-01-01"), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/about`, lastModified: new Date("2026-01-01"), changeFrequency: "monthly", priority: 0.7 },
  ]

  // ── Use cases (long-tail SEO — each targets a specific audience) ─────
  const useCaseSlugs = [
    "freelancers",
    "agencies",
    "agents",
    "sales",
    "students",
    "teams",
    "developers",
  ]

  const useCasePages: MetadataRoute.Sitemap = useCaseSlugs.map((slug) => ({
    url: `${BASE_URL}/use-cases/${slug}`,
    lastModified: new Date("2025-03-01"),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }))

  // ── Programmatic SEO pages (44 country × document type combinations) ─
  const programmaticPages: MetadataRoute.Sitemap = getAllProgrammaticPages().map(
    ({ documentType, country }) => ({
      url: `${BASE_URL}/tools/${documentType}/${country}`,
      lastModified: new Date("2025-03-01"),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })
  )

  // ── City landing pages (~180 city × document type combinations) ───────
  const cityPages: MetadataRoute.Sitemap = getAllCityPages().map(
    ({ documentType, country, city }) => ({
      url: `${BASE_URL}/tools/${documentType}/${country}/${city}`,
      lastModified: new Date("2025-04-01"),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })
  )

  // ── Misspelling / alternative spellings landing page ─────────────────
  const misspellingPage: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/clorefy-alternative-spellings`,
      lastModified: new Date("2026-04-26"),
      changeFrequency: "monthly" as const,
      priority: 0.7, // bumped — this page directly targets branded misspelling searches
    },
  ]

  // ── Legal pages (trust signals for Google) ───────────────────────────
  const legalPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/terms`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/refund-policy`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.4 },
  ]

  // ── Auth pages are intentionally EXCLUDED from the sitemap ───────────
  // `/auth/login` and `/auth/signup` are thin, low-value routes that belong
  // to the noindex/exclude set (Property 1 — Sitemap Hygiene). Emitting them
  // wastes crawl budget and emits a low-quality signal, so they are dropped.

  // ── Blog posts (content marketing — high SEO value, includes AI-generated) ──
  // Build the list from real, resolvable posts (static + PUBLISHED DB posts)
  // rather than a raw slug list, so no sitemap entry can 404 / soft-404 for a
  // draft or unresolved slug. Use each post's real publish/update date instead
  // of `new Date()` so `lastModified` is stable and meaningful.
  const blogPosts = await getAllCombinedPosts()
  const blogPages: MetadataRoute.Sitemap = blogPosts
    .filter((post) => Boolean(post.slug))
    .map((post) => {
      const modified = post.updatedAt || post.publishedAt
      return {
        url: `${BASE_URL}/blog/${post.slug}`,
        lastModified: modified ? new Date(modified) : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }
    })

  return [
    ...marketingPages,
    ...useCasePages,
    ...programmaticPages,
    ...cityPages,
    ...misspellingPage,
    ...blogPages,
    ...legalPages,
  ]
}

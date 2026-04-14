import type { MetadataRoute } from "next"
import { getAllPosts } from "@/lib/blog-data"
import { getAllProgrammaticPages } from "@/lib/seo-data"
import { getAllCityPages } from "@/lib/city-data"

const BASE_URL = "https://clorefy.com"

export default function sitemap(): MetadataRoute.Sitemap {
  // ── Public marketing pages (indexed, high priority) ──────────────────
  // Use hardcoded content timestamps instead of current date for static pages
  const marketingPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date("2025-06-01"), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/pricing`, lastModified: new Date("2025-05-01"), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/features`, lastModified: new Date("2025-05-01"), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastModified: new Date("2025-06-01"), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/business`, lastModified: new Date("2025-04-01"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/resources`, lastModified: new Date("2025-04-01"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/developers`, lastModified: new Date("2025-03-01"), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/contact`, lastModified: new Date("2025-01-01"), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/about`, lastModified: new Date("2025-01-01"), changeFrequency: "monthly", priority: 0.7 },
  ]

  // ── Use cases (long-tail SEO — each targets a specific audience) ─────
  const useCaseSlugs = [
    "freelancers",
    "agencies",
    "lawyers",
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
      lastModified: new Date("2025-01-01"),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
  ]

  // ── Legal pages (trust signals for Google) ───────────────────────────
  const legalPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/terms`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/refund-policy`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.4 },
  ]

  // ── Auth pages (low priority but still indexed for branded searches) ─
  const authPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/auth/login`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/auth/signup`, lastModified: new Date("2025-01-01"), changeFrequency: "yearly", priority: 0.3 },
  ]

  // ── Blog posts (content marketing — high SEO value) ───────────────────
  const blogPages: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }))

  return [
    ...marketingPages,
    ...useCasePages,
    ...programmaticPages,
    ...cityPages,
    ...misspellingPage,
    ...blogPages,
    ...legalPages,
    ...authPages,
  ]
}

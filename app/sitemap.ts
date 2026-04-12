import type { MetadataRoute } from "next"
import { getAllPosts } from "@/lib/blog-data"
import { getAllProgrammaticPages } from "@/lib/seo-data"

const BASE_URL = "https://clorefy.com"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // ── Public marketing pages (indexed, high priority) ──────────────────
  const marketingPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/features`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/business`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/resources`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/developers`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
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
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }))

  // ── Programmatic SEO pages (44 country × document type combinations) ─
  const programmaticPages: MetadataRoute.Sitemap = getAllProgrammaticPages().map(
    ({ documentType, country }) => ({
      url: `${BASE_URL}/tools/${documentType}/${country}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })
  )

  // ── Legal pages (trust signals for Google) ───────────────────────────
  const legalPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/refund-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ]

  // ── Auth pages (low priority but still indexed for branded searches) ─
  const authPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/auth/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/auth/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]

  // ── Blog posts (content marketing — high SEO value) ───────────────────
  const blogPages: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }))

  return [...marketingPages, ...useCasePages, ...programmaticPages, ...blogPages, ...legalPages, ...authPages]
}

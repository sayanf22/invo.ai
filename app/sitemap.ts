import type { MetadataRoute } from "next"

const BASE_URL = "https://clorefy.com"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    // Core pages — highest priority
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/features`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },

    // Use cases — high priority for long-tail SEO
    { url: `${BASE_URL}/use-cases/freelancers`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/use-cases/agencies`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/use-cases/lawyers`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/use-cases/sales`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/use-cases/students`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/use-cases/teams`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/use-cases/developers`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },

    // Business & resources
    { url: `${BASE_URL}/business`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/resources`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },

    // Legal pages — important for trust signals
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/refund-policy`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },

    // Auth pages — lower priority but still indexed
    { url: `${BASE_URL}/auth/login`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE_URL}/auth/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ]
}

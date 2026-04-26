import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/clorefy-ctrl-8x2m",
          "/clorefy-ctrl-8x2m/",
          "/api/",
          "/auth/callback",
          "/auth/confirm",
          "/auth/update-password",
          "/auth/reset-password",
          "/onboarding",
          "/choose-plan",
          "/billing",
          "/profile",
          "/settings",
          "/notifications",
          "/documents",
          "/history",
          "/sign/",
        ],
      },
      // Allow AI crawlers to read llms.txt for AI search visibility
      {
        userAgent: "GPTBot",
        allow: ["/", "/llms.txt", "/blog/", "/features", "/pricing", "/about"],
        disallow: ["/api/", "/auth/", "/onboarding", "/documents", "/history"],
      },
      {
        userAgent: "ClaudeBot",
        allow: ["/", "/llms.txt", "/blog/", "/features", "/pricing", "/about"],
        disallow: ["/api/", "/auth/", "/onboarding", "/documents", "/history"],
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/", "/llms.txt", "/blog/", "/features", "/pricing", "/about"],
        disallow: ["/api/", "/auth/", "/onboarding", "/documents", "/history"],
      },
    ],
    sitemap: "https://clorefy.com/sitemap.xml",
    host: "https://clorefy.com",
  }
}

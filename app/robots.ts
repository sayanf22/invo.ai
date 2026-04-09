import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/callback", "/auth/confirm", "/onboarding"],
      },
    ],
    sitemap: "https://clorefy.com/sitemap.xml",
  }
}

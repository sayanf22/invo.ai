import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/callback",
          "/auth/confirm",
          "/auth/update-password",
          "/onboarding",
          "/choose-plan",
          "/billing",
          "/profile",
          "/settings",
          "/notifications",
          "/documents",
          "/history",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/", "/auth/callback", "/auth/confirm", "/onboarding"],
      },
    ],
    sitemap: "https://clorefy.com/sitemap.xml",
    host: "https://clorefy.com",
  }
}

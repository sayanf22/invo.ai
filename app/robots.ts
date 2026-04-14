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
    ],
    sitemap: "https://clorefy.com/sitemap.xml",
  }
}

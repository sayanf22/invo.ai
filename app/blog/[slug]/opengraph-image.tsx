import { ImageResponse } from "next/og"
import { getPostBySlug } from "@/lib/blog-data"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Clorefy Blog"

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  try {
    const { slug } = await params
    const post = getPostBySlug(slug)

    const title = post?.title ?? slug.replace(/-/g, " ")

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            padding: 60,
            fontFamily: "sans-serif",
          }}
        >
          {/* Blog post title */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#ffffff",
              textAlign: "center",
              lineHeight: 1.3,
              marginBottom: 32,
              display: "flex",
              maxWidth: 1000,
            }}
          >
            {title}
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              color: "#e07b39",
              display: "flex",
            }}
          >
            Clorefy Blog
          </div>
        </div>
      ),
      { ...size }
    )
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)",
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#e07b39",
              display: "flex",
            }}
          >
            Clorefy Blog
          </div>
        </div>
      ),
      { ...size }
    )
  }
}

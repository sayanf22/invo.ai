import { ImageResponse } from "next/og"

const USE_CASE_DATA: Record<string, { title: string; tagline: string }> = {
  freelancers: { title: "Clorefy for Freelancers", tagline: "Get paid faster, stress less" },
  developers: { title: "Clorefy for Consultants", tagline: "Professional proposals in minutes" },
  students: { title: "Clorefy for Students", tagline: "Professional docs, student budget" },
  lawyers: { title: "Clorefy for Lawyers", tagline: "Draft with precision, bill with ease" },
  agencies: { title: "Clorefy for Agencies", tagline: "Scale your client operations" },
  sales: { title: "Clorefy for Sales", tagline: "Close deals with speed" },
  teams: { title: "Clorefy for Teams", tagline: "One platform, every document" },
}

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Clorefy Use Cases"

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  try {
    const { slug } = await params
    const data = USE_CASE_DATA[slug]

    const title = data?.title ?? `Clorefy for ${slug}`
    const tagline = data?.tagline ?? "AI-powered document generation"

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
          {/* Use-case name */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: "#ffffff",
              textAlign: "center",
              marginBottom: 16,
              display: "flex",
            }}
          >
            {title}
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 32,
              fontWeight: 500,
              color: "#e07b39",
              textAlign: "center",
              marginBottom: 40,
              display: "flex",
            }}
          >
            {tagline}
          </div>

          {/* Branding */}
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#e07b39",
              letterSpacing: 2,
              display: "flex",
            }}
          >
            Clorefy
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
            Clorefy
          </div>
        </div>
      ),
      { ...size }
    )
  }
}

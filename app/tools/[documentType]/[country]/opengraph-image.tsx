import { ImageResponse } from "next/og"
import { getCountryBySlug, getDocumentTypeBySlug } from "@/lib/seo-data"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Clorefy — AI Document Generator"

export default async function OgImage({
  params,
}: {
  params: Promise<{ documentType: string; country: string }>
}) {
  try {
    const { documentType, country: countrySlug } = await params
    const country = getCountryBySlug(countrySlug)
    const docType = getDocumentTypeBySlug(documentType)

    const countryName = country?.name ?? countrySlug
    const flag = country?.flag ?? "🌍"
    const docTypeName = docType?.name ?? documentType

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
            fontFamily: "sans-serif",
          }}
        >
          {/* Flag */}
          <div style={{ fontSize: 96, marginBottom: 16, display: "flex" }}>
            {flag}
          </div>

          {/* Document type name */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: "#ffffff",
              textAlign: "center",
              marginBottom: 8,
              display: "flex",
            }}
          >
            {docTypeName}
          </div>

          {/* Country name */}
          <div
            style={{
              fontSize: 36,
              fontWeight: 500,
              color: "#e07b39",
              textAlign: "center",
              marginBottom: 40,
              display: "flex",
            }}
          >
            for {countryName}
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

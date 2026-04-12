type JsonLdData = Record<string, unknown>

interface JsonLdProps {
  data: JsonLdData
}

export function JsonLd({ data }: JsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    ...data,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

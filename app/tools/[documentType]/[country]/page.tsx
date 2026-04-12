import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"
import {
  getAllProgrammaticPages,
  getProgrammaticPageData,
} from "@/lib/seo-data"
import { LandingLayout } from "@/components/landing/landing-layout"
import { Breadcrumbs } from "@/components/seo/breadcrumbs"
import { RelatedLinks } from "@/components/seo/related-links"
import { JsonLd } from "@/components/seo/json-ld"
import { AnimatedCard } from "@/components/landing/animated-card"
import { CheckCircle, ArrowRight } from "lucide-react"

const BASE_URL = "https://clorefy.com"

// ISR: revalidate every 24 hours
export const revalidate = 86400

// ── Static params for all 44 combinations ──────────────────────────────

export function generateStaticParams() {
  return getAllProgrammaticPages()
}

// ── Per-page metadata ──────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ documentType: string; country: string }>
}): Promise<Metadata> {
  const { documentType, country } = await params
  const data = getProgrammaticPageData(documentType, country)

  if (!data) {
    return { title: "Page Not Found | Clorefy" }
  }

  const url = `${BASE_URL}/tools/${documentType}/${country}`

  return {
    title: data.title,
    description: data.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: data.title,
      description: data.metaDescription,
      url,
      siteName: "Clorefy",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description: data.metaDescription,
    },
  }
}

// ── Page component ─────────────────────────────────────────────────────

export default async function ToolPage({
  params,
}: {
  params: Promise<{ documentType: string; country: string }>
}) {
  const { documentType, country } = await params
  const data = getProgrammaticPageData(documentType, country)

  if (!data) return notFound()

  const pageUrl = `${BASE_URL}/tools/${documentType}/${country}`

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Tools", href: "/tools" },
    { label: data.documentType.name, href: `/tools/${documentType}` },
    { label: data.country.name },
  ]

  const faqJsonLd = data.faqs.length > 0
    ? {
        "@type": "FAQPage",
        mainEntity: data.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      }
    : null

  const softwareAppJsonLd = {
    "@type": "SoftwareApplication",
    name: `Clorefy ${data.documentType.name}`,
    description: data.metaDescription,
    url: pageUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: data.country.currency,
      description: `Free tier available for ${data.country.name}`,
    },
  }

  return (
    <LandingLayout>
      <JsonLd data={softwareAppJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumbs */}
        <Breadcrumbs items={breadcrumbItems} />

        {/* Hero Section */}
        <AnimatedCard className="mt-8 mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            {data.heroHeading}
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
            {data.heroSubheading}
          </p>
        </AnimatedCard>

        {/* Features Section */}
        <AnimatedCard delay={0.1} className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">
            Key Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.documentType.features.map((feature) => (
              <div
                key={feature}
                className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
              >
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </AnimatedCard>

        {/* Tax Section */}
        <AnimatedCard delay={0.15} className="mb-12">
          <div
            className="prose prose-gray dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: data.taxSection }}
          />
        </AnimatedCard>

        {/* Compliance Section */}
        <AnimatedCard delay={0.2} className="mb-12">
          <div
            className="prose prose-gray dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: data.complianceSection }}
          />
        </AnimatedCard>

        {/* FAQ Section */}
        {data.faqs.length > 0 && (
          <AnimatedCard delay={0.25} className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {data.faqs.map((faq, index) => (
                <div key={index}>
                  <h3 className="text-lg font-medium mb-2">{faq.question}</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </AnimatedCard>
        )}

        {/* CTA Section */}
        <AnimatedCard delay={0.3} className="mb-12">
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 p-8 text-center">
            <h2 className="text-2xl font-bold mb-3">
              Start Creating {data.documentType.singularName}s for{" "}
              {data.country.name}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-xl mx-auto">
              Join thousands of businesses using Clorefy to generate{" "}
              {data.country.taxSystem}-compliant{" "}
              {data.documentType.singularName.toLowerCase()}s in{" "}
              {data.country.currency}. Free to start — no credit card required.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </AnimatedCard>

        {/* Related Links */}
        <AnimatedCard delay={0.35}>
          <RelatedLinks
            relatedPages={data.relatedPages}
            relatedBlogSlugs={data.relatedBlogSlugs}
          />
        </AnimatedCard>
      </div>
    </LandingLayout>
  )
}

import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"
import { getAllCityPages, getCityPageData } from "@/lib/city-data"
import { getCityHreflangTag } from "@/lib/hreflang"
import { generateFAQSchema, generateSoftwareAppSchema, generateBreadcrumbSchema } from "@/lib/structured-data"
import { LandingLayout } from "@/components/landing/landing-layout"
import { Breadcrumbs } from "@/components/seo/breadcrumbs"
import { AnimatedCard } from "@/components/landing/animated-card"
import { ArrowRight, MapPin, Building2, FileText } from "lucide-react"

const BASE_URL = "https://clorefy.com"

export const revalidate = 86400

export function generateStaticParams() {
  return getAllCityPages()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ documentType: string; country: string; city: string }>
}): Promise<Metadata> {
  const { documentType, country, city } = await params
  const data = getCityPageData(documentType, country, city)
  if (!data) return { title: "Page Not Found | Clorefy" }
  const url = BASE_URL + "/tools/" + documentType + "/" + country + "/" + city
  const hreflang = getCityHreflangTag(country, documentType, city)
  return {
    title: data.title,
    description: data.metaDescription,
    alternates: {
      canonical: url,
      languages: { [hreflang.hrefLang]: hreflang.href },
    },
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

export default async function CityToolPage({
  params,
}: {
  params: Promise<{ documentType: string; country: string; city: string }>
}) {
  const { documentType, country, city } = await params
  const data = getCityPageData(documentType, country, city)
  if (!data) return notFound()

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Tools", href: "/tools" },
    { label: data.documentType.name, href: "/tools/" + documentType },
    { label: data.country.name, href: "/tools/" + documentType + "/" + country },
    { label: data.city.name },
  ]

  const faqSchema = generateFAQSchema(data.faqs)
  const softwareAppSchema = generateSoftwareAppSchema(data.city, data.documentType)
  const breadcrumbSchema = generateBreadcrumbSchema(
    breadcrumbItems.map((item) => ({
      name: item.label,
      url: item.href ? BASE_URL + item.href : undefined,
    }))
  )

  return (
    <LandingLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <AnimatedCard className="mt-8 mb-12">
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 font-medium mb-3">
            <MapPin className="h-4 w-4" />
            <span>{data.city.name}, {data.country.name}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{data.heroHeading}</h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl">{data.heroSubheading}</p>
        </AnimatedCard>

        <AnimatedCard delay={0.1} className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-2xl font-semibold">Business in {data.city.name}</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{data.businessContextSection}</p>
          {data.city.industries.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.city.industries.map((industry) => (
                <span key={industry} className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {industry}
                </span>
              ))}
            </div>
          )}
        </AnimatedCard>

        <AnimatedCard delay={0.15} className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-2xl font-semibold">{data.country.taxSystem} Compliance in {data.city.name}</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{data.taxComplianceSection}</p>
        </AnimatedCard>

        <AnimatedCard delay={0.2} className="mb-12">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-6">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed italic">{data.useCaseContent}</p>
          </div>
        </AnimatedCard>

        {data.faqs.length > 0 && (
          <AnimatedCard delay={0.25} className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions — {data.city.name}</h2>
            <div className="space-y-6">
              {data.faqs.map((faq, index) => (
                <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-0 last:pb-0">
                  <h3 className="text-lg font-medium mb-2">{faq.question}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{faq.answer}</p>
                </div>
              ))}
            </div>
          </AnimatedCard>
        )}

        <AnimatedCard delay={0.3} className="mb-12">
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 p-8 text-center">
            <h2 className="text-2xl font-bold mb-3">{data.ctaMessage}</h2>
            <Link href="/auth/signup" className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.35} className="mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <h2 className="text-lg font-semibold mb-4">{data.documentType.name} in {data.country.name}</h2>
              <div className="space-y-2">
                <Link href={data.parentCountryHref} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <ArrowRight className="h-3.5 w-3.5 text-amber-600" />
                  All of {data.country.name}
                </Link>
                {data.siblingCities.map((sibling) => (
                  <Link key={sibling.slug} href={"/tools/" + documentType + "/" + country + "/" + sibling.slug} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <MapPin className="h-3.5 w-3.5 text-amber-600" />
                    {sibling.name}
                  </Link>
                ))}
              </div>
            </div>
            {data.relatedBlogSlugs.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Related Articles</h2>
                <div className="space-y-2">
                  {data.relatedBlogSlugs.slice(0, 3).map((slug) => (
                    <Link key={slug} href={"/blog/" + slug} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors capitalize">
                      <FileText className="h-3.5 w-3.5 text-amber-600" />
                      {slug.replace(/-/g, " ")}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </AnimatedCard>
      </div>
    </LandingLayout>
  )
}
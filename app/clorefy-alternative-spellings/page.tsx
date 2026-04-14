import type { Metadata } from "next"
import Link from "next/link"
import { LandingLayout } from "@/components/landing/landing-layout"
import { Breadcrumbs } from "@/components/seo/breadcrumbs"
import { AnimatedCard } from "@/components/landing/animated-card"
import { MISSPELLING_VARIANTS } from "@/lib/misspelling-data"
import { generateOrganizationSchema } from "@/lib/structured-data"
import { ArrowRight } from "lucide-react"

const BASE_URL = "https://clorefy.com"
const PAGE_URL = BASE_URL + "/clorefy-alternative-spellings"

export const metadata: Metadata = {
  title: "Clorefy Alternative Spellings & Common Misspellings | Clorefy",
  description: "Looking for clorify, cloriphy, clorephy, or clorafy? You've found Clorefy — the AI-powered document generation platform for invoices, contracts, quotations, and proposals.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Clorefy Alternative Spellings & Common Misspellings | Clorefy",
    description: "Looking for clorify, cloriphy, clorephy, or clorafy? You've found Clorefy — the AI-powered document generation platform.",
    url: PAGE_URL,
    siteName: "Clorefy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clorefy Alternative Spellings & Common Misspellings | Clorefy",
    description: "Looking for clorify, cloriphy, clorephy, or clorafy? You've found Clorefy.",
  },
}

export default function AlternativeSpellingsPage() {
  const orgSchema = generateOrganizationSchema([
    "https://twitter.com/clorefy",
    "https://linkedin.com/company/clorefy",
    "https://instagram.com/clorefy",
  ])

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Alternative Spellings" },
  ]

  return (
    <LandingLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <AnimatedCard className="mt-8 mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Clorefy — Alternative Spellings
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
            If you searched for a different spelling and landed here, you&apos;re in the right place.
            Clorefy is the AI-powered document generation platform for invoices, contracts, quotations,
            and proposals across 11 countries.
          </p>
        </AnimatedCard>

        <AnimatedCard delay={0.1} className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Common Misspellings of Clorefy</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            People often search for Clorefy using these alternate spellings. All of them lead here:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {MISSPELLING_VARIANTS.map((variant) => (
              <div
                key={variant}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-4 py-3 text-center"
              >
                <span className="text-sm font-mono text-gray-500 dark:text-gray-400 line-through">{variant}</span>
                <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">→ clorefy</span>
              </div>
            ))}
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Whether you typed <strong>clorify</strong>, <strong>cloriphy</strong>, <strong>clorephy</strong>,{" "}
            <strong>clorafy</strong>, <strong>clorefi</strong>, <strong>clorfy</strong>, or{" "}
            <strong>clorifly</strong> — the correct name is <strong>Clorefy</strong>, and you&apos;ve found us.
          </p>
        </AnimatedCard>

        <AnimatedCard delay={0.15} className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">What is Clorefy?</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            <strong>Clorefy</strong> (pronounced &quot;klor-uh-fy&quot;) is an AI-powered document generation
            platform that helps businesses, freelancers, and professionals create compliant invoices,
            contracts, quotations, and proposals in seconds — across 11 countries including India, USA,
            UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, and the Netherlands.
          </p>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Just describe what you need, and Clorefy&apos;s AI generates a complete, tax-compliant document
            tailored to your country&apos;s regulations. No templates, no manual calculations — just
            professional documents, instantly.
          </p>
        </AnimatedCard>

        <AnimatedCard delay={0.2} className="mb-12">
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 p-8 text-center">
            <h2 className="text-2xl font-bold mb-3">Ready to get started with Clorefy?</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-xl mx-auto">
              Create your first AI-generated document for free. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.25}>
          <h2 className="text-xl font-semibold mb-4">Explore Clorefy Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Invoice Generator India", href: "/tools/invoice-generator/india" },
              { label: "Invoice Generator USA", href: "/tools/invoice-generator/usa" },
              { label: "Contract Generator UK", href: "/tools/contract-generator/uk" },
              { label: "Proposal Generator Germany", href: "/tools/proposal-generator/germany" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </AnimatedCard>
      </div>
    </LandingLayout>
  )
}
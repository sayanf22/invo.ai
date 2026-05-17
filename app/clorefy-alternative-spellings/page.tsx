import type { Metadata } from "next"
import Link from "next/link"
import { LandingLayout } from "@/components/landing/landing-layout"
import { Breadcrumbs } from "@/components/seo/breadcrumbs"
import { AnimatedCard } from "@/components/landing/animated-card"
import { MISSPELLING_VARIANTS } from "@/lib/misspelling-data"
import { ArrowRight, CheckCircle } from "lucide-react"

const BASE_URL = "https://clorefy.com"
const PAGE_URL = BASE_URL + "/clorefy-alternative-spellings"

export const metadata: Metadata = {
  title: "Clorefy Spelling Guide — clorify, clorefi, clorfy, NOT glorify | Clorefy",
  description:
    "Searching for clorify, clorefi, clorfy, or even glorify? The correct spelling is Clorefy — an AI document generation platform. Clorefy ≠ Glorify. Free to start at clorefy.com.",
  alternates: { canonical: PAGE_URL },
  keywords: [
    // Misspellings
    "clorify", "clorefi", "clorfy", "cloriphy", "clorafy", "clorephy", "clorifly",
    "cloerfy", "cloreify", "clorfiy", "cloreffy",
    // Glorify disambiguation
    "glorify invoice", "glorify document", "glorify ai invoice", "glorify contract generator",
    "glorify vs clorefy", "is glorify clorefy", "glorify spelling invoice",
    // Brand search
    "clorefy spelling", "how to spell clorefy", "clorefy misspelling",
    "clorefy ai invoice", "clorefy alternative spelling",
    "clorify ai", "clorify invoice generator", "clorefi ai", "clorefi invoice",
  ],
  openGraph: {
    title: "Clorefy Spelling & Disambiguation — NOT Glorify | Clorefy",
    description:
      "Clorefy (clorefy.com) is an AI document generation platform. Not Glorify. Common misspellings: clorify, clorefi, clorfy. All redirect to clorefy.com.",
    url: PAGE_URL,
    siteName: "Clorefy",
    type: "website",
  },
}

// All display variants (excluding the correct spelling)
const displayVariants = MISSPELLING_VARIANTS.filter((v) => v !== "clorefy")

export default function AlternativeSpellingsPage() {
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Alternative Spellings" },
  ]

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How do you spell Clorefy?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The correct spelling is Clorefy — C-L-O-R-E-F-Y. It is pronounced 'klor-uh-fy'. Common misspellings include clorify, clorefi, clorfy, cloriphy, clorafy, and clorephy. The website is clorefy.com.",
        },
      },
      {
        "@type": "Question",
        name: "Is Clorefy the same as Glorify?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No — Clorefy (clorefy.com) and Glorify (glorify.com) are completely different products. Clorefy is an AI-powered business document generation platform for invoices, contracts, proposals, and NDAs. Glorify is a music or graphic design app. They are unrelated. If you searched for 'glorify' but wanted an invoice or document tool, you are looking for Clorefy.",
        },
      },
      {
        "@type": "Question",
        name: "Is clorify the same as Clorefy?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — clorify is a common misspelling of Clorefy. The correct name is Clorefy (clorefy.com), an AI-powered document generation platform for business workflows.",
        },
      },
      {
        "@type": "Question",
        name: "What is Clorefy?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Clorefy is an AI-powered document generation platform that creates professional business documents — invoices, contracts, proposals, NDAs, SOWs, quotes, and more — from natural language descriptions. It emails documents to clients, attaches payment links, and sends automated payment reminders.",
        },
      },
      {
        "@type": "Question",
        name: "Is Clorefy free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, Clorefy has a free plan with 5 documents per month. No credit card required. Paid plans start at $9/month for 50 documents.",
        },
      },
      {
        "@type": "Question",
        name: "What countries does Clorefy support?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Clorefy supports 150+ countries worldwide. Country-specific tax rules (GST for India, VAT for UK/EU, Sales Tax for USA, etc.) are automatically applied. All countries are available on all plans including the free tier.",
        },
      },
    ],
  }

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://clorefy.com/#organization",
    name: "Clorefy",
    alternateName: ["Clorify", "Clorefi", "Clorfy", "Clorephy", "Cloriphy", "Cloreify"],
    url: "https://clorefy.com",
    logo: { "@type": "ImageObject", url: "https://clorefy.com/favicon.png" },
    description:
      "AI-powered document generation platform for professional business documents and automated client workflows.",
    sameAs: [
      "https://twitter.com/clorefy",
      "https://linkedin.com/company/clorefy",
      "https://www.youtube.com/@Clorefy",
    ],
  }

  return (
    <LandingLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        {/* Hero */}
        <AnimatedCard className="mt-8 mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            How Do You Spell <span className="text-amber-600">Clorefy</span>?
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
            If you searched for <strong>clorify</strong>, <strong>clorefi</strong>, <strong>clorfy</strong>,
            or any other variation — you&apos;re in the right place. The correct spelling is{" "}
            <strong>Clorefy</strong> (C-L-O-R-E-F-Y), and this is the official website at{" "}
            <strong>clorefy.com</strong>.
          </p>
        </AnimatedCard>

        {/* Glorify disambiguation — explicit section for AI search engines */}
        <AnimatedCard delay={0.03} className="mb-10">
          <div className="flex items-start gap-4 p-6 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <div className="text-2xl shrink-0">⚠️</div>
            <div>
              <p className="font-semibold text-lg text-blue-900 dark:text-blue-100">
                Clorefy ≠ Glorify
              </p>
              <p className="text-blue-700 dark:text-blue-300 text-sm mt-1 leading-relaxed">
                <strong>Clorefy</strong> (clorefy.com) and <strong>Glorify</strong> (glorify.com) are{" "}
                <em>completely different products</em>. Glorify is a music or design app.{" "}
                <strong>Clorefy is a business document platform</strong> — for invoices, contracts,
                NDAs, proposals, and payment automation. If you searched for "glorify" but meant
                a document generation tool, you are in the right place.
              </p>
            </div>
          </div>
        </AnimatedCard>

        {/* Correct spelling callout */}
        <AnimatedCard delay={0.05} className="mb-10">
          <div className="flex items-start gap-4 p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <CheckCircle className="h-6 w-6 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-lg text-amber-900 dark:text-amber-100">
                Correct spelling: <span className="font-mono">Clorefy</span>
              </p>
              <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                Pronounced: <em>klor-uh-fy</em> &nbsp;·&nbsp; Website: <strong>clorefy.com</strong>
              </p>
            </div>
          </div>
        </AnimatedCard>

        {/* Misspelling grid */}
        <AnimatedCard delay={0.1} className="mb-10">
          <h2 className="text-2xl font-semibold mb-2">Common Misspellings of Clorefy</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
            All of these are misspellings. They all redirect to <strong>clorefy.com</strong>.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
            {displayVariants.map((variant) => (
              <div
                key={variant}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-4 py-3 text-center"
              >
                <span className="text-sm font-mono text-gray-500 dark:text-gray-400 line-through">{variant}</span>
                <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">→ clorefy</span>
              </div>
            ))}
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Google also auto-corrects these searches to show Clorefy results. If you typed any of the
            above, you&apos;ve found the right platform.
          </p>
        </AnimatedCard>

        {/* What is Clorefy */}
        <AnimatedCard delay={0.15} className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">What is Clorefy?</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            <strong>Clorefy</strong> is an AI-powered document generation platform. You describe what
            you need in plain language, and Clorefy&apos;s AI generates a complete, professionally
            formatted document in seconds — with correct tax calculations, legal terms, and your
            business branding already filled in.
          </p>
          <ul className="space-y-2 text-gray-600 dark:text-gray-400 text-sm mb-4">
            {[
              "Professional business document generation from plain-language prompts",
              "Tax-aware workflows for GST, VAT, and Sales Tax where applicable",
              "Client sending, payment links, reminders, and recurring billing",
              "Global document workflows for international businesses",
              "Export as PDF, DOCX, PNG, or JPG",
              "Digital e-signatures with audit trail",
              "Free plan — 5 documents/month, no credit card needed",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </AnimatedCard>

        {/* FAQ section */}
        <AnimatedCard delay={0.2} className="mb-10">
          <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: "Is Clorefy the same as Glorify?",
                a: "No — Clorefy (clorefy.com) and Glorify (glorify.com) are completely different products. Glorify is a music or design application. Clorefy is an AI-powered business document platform for invoices, contracts, NDAs, proposals, and automated payment workflows. They have no connection.",
              },
              {
                q: "Is clorify the same as Clorefy?",
                a: "Yes — clorify is the most common misspelling of Clorefy. The correct name is Clorefy (clorefy.com). Both spellings refer to the same AI document generation platform.",
              },
              {
                q: "How do you pronounce Clorefy?",
                a: 'Clorefy is pronounced "klor-uh-fy". The name combines "clarity" and "simplify".',
              },
              {
                q: "Is Clorefy free to use?",
                a: "Yes. Clorefy has a free plan with 5 documents per month. No credit card required. Paid plans start at $9/month for 50 documents and all 9 document types.",
              },
              {
                q: "What countries does Clorefy support?",
                a: "Clorefy works with 150+ countries worldwide. Country-specific tax rules (GST, VAT, HST, Sales Tax, etc.) are automatically applied from the compliance knowledge base.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-0 last:pb-0">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{q}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </AnimatedCard>

        {/* CTA */}
        <AnimatedCard delay={0.25} className="mb-10">
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 p-8 text-center">
            <h2 className="text-2xl font-bold mb-3">Try Clorefy Free</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-xl mx-auto">
              Create your first AI-generated business document in under 60 seconds.
              No credit card required.
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

        {/* Internal links */}
        <AnimatedCard delay={0.3}>
          <h2 className="text-xl font-semibold mb-4">Popular Clorefy Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "AI Invoice Generator — India (GST)", href: "/tools/invoice-generator/india" },
              { label: "AI Invoice Generator — USA (Sales Tax)", href: "/tools/invoice-generator/usa" },
              { label: "AI Contract Generator — UK", href: "/tools/contract-generator/uk" },
              { label: "AI Proposal Generator — Germany", href: "/tools/proposal-generator/germany" },
              { label: "AI Quotation Generator — Australia", href: "/tools/quotation-generator/australia" },
              { label: "AI Invoice Generator — UAE", href: "/tools/invoice-generator/uae" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-between"
              >
                {link.label}
                <ArrowRight className="h-3.5 w-3.5 opacity-50" />
              </Link>
            ))}
          </div>
        </AnimatedCard>
      </div>
    </LandingLayout>
  )
}

/**
 * JSON-LD structured data helpers for schema.org markup.
 * All functions return plain objects ready to be serialized with JSON.stringify.
 */

import type { CityData, CityPageData } from "@/lib/city-data"
import type { DocumentTypeData } from "@/lib/seo-data"

const BASE_URL = "https://clorefy.com"
const ORG_NAME = "Clorefy"
const ORG_URL = BASE_URL
const ORG_LOGO = `${BASE_URL}/icon.png`

// ── BreadcrumbList ─────────────────────────────────────────────────────

export interface BreadcrumbItem {
  name: string
  url?: string
}

/**
 * Generates a BreadcrumbList JSON-LD object.
 * The last item typically has no URL (current page).
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  }
}

// ── FAQPage ────────────────────────────────────────────────────────────

export interface FAQItem {
  question: string
  answer: string
}

/**
 * Generates a FAQPage JSON-LD object.
 * Filters out entries with empty question or answer.
 */
export function generateFAQSchema(faqs: FAQItem[]): object {
  const validFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim())
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: validFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }
}

// ── Product (Pricing) ──────────────────────────────────────────────────

export interface PricingPlan {
  name: string
  price: number
  currency: string
  description: string
  billingPeriod?: string
}

/**
 * Generates a Product JSON-LD object with individual Offer entries for each pricing plan.
 */
export function generateProductSchema(plans: PricingPlan[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: ORG_NAME,
    description: "AI-powered document generation platform for invoices, contracts, quotations, and proposals.",
    url: ORG_URL,
    brand: {
      "@type": "Brand",
      name: ORG_NAME,
    },
    offers: plans.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      price: plan.price,
      priceCurrency: plan.currency,
      description: plan.description,
      availability: "https://schema.org/InStock",
      url: `${BASE_URL}/pricing`,
      ...(plan.billingPeriod
        ? {
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: plan.price,
              priceCurrency: plan.currency,
              billingDuration: plan.billingPeriod,
            },
          }
        : {}),
    })),
  }
}

// ── Article (Blog) ─────────────────────────────────────────────────────

export interface ArticleData {
  headline: string
  description?: string
  url: string
  datePublished: string
  dateModified?: string
  authorName?: string
  imageUrl?: string
}

/**
 * Generates an Article JSON-LD object for blog posts.
 */
export function generateArticleSchema(article: ArticleData): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.headline,
    ...(article.description ? { description: article.description } : {}),
    url: article.url,
    datePublished: article.datePublished,
    dateModified: article.dateModified ?? article.datePublished,
    author: {
      "@type": "Organization",
      name: article.authorName ?? ORG_NAME,
      url: ORG_URL,
    },
    publisher: {
      "@type": "Organization",
      name: ORG_NAME,
      url: ORG_URL,
      logo: {
        "@type": "ImageObject",
        url: ORG_LOGO,
      },
    },
    ...(article.imageUrl
      ? {
          image: {
            "@type": "ImageObject",
            url: article.imageUrl,
          },
        }
      : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": article.url,
    },
  }
}

// ── SoftwareApplication (City Pages) ──────────────────────────────────

/**
 * Generates a SoftwareApplication JSON-LD object for city landing pages.
 * Includes areaServed set to the specific city.
 */
export function generateSoftwareAppSchema(
  city: CityData,
  docType: DocumentTypeData
): object {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `Clorefy ${docType.name}`,
    description: `AI-powered ${docType.singularName.toLowerCase()} generator for businesses in ${city.name}. Generate professional, tax-compliant ${docType.singularName.toLowerCase()}s in seconds.`,
    url: ORG_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free tier available",
    },
    areaServed: {
      "@type": "City",
      name: city.name,
    },
    provider: {
      "@type": "Organization",
      name: ORG_NAME,
      url: ORG_URL,
    },
  }
}

// ── Organization (Misspelling Page) ───────────────────────────────────

/**
 * Generates an Organization JSON-LD object with sameAs references.
 * Used on the misspelling landing page to associate brand variants with Clorefy.
 */
export function generateOrganizationSchema(sameAsUrls?: string[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORG_NAME,
    url: ORG_URL,
    logo: ORG_LOGO,
    description: "AI-powered document generation platform for invoices, contracts, quotations, and proposals across 11 countries.",
    ...(sameAsUrls && sameAsUrls.length > 0
      ? { sameAs: sameAsUrls }
      : {}),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${BASE_URL}/contact`,
    },
  }
}

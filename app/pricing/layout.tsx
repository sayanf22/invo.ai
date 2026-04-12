import type { Metadata } from "next"
import { JsonLd } from "@/components/seo/json-ld"

export const metadata: Metadata = {
    title: "Pricing — Free, Starter, Pro & Agency Plans",
    description: "Clorefy pricing plans starting from free. Starter at $9/mo for 50 documents, Pro at $24/mo for 150 documents. AI invoice generator, contract maker, proposal writer. Cancel anytime.",
    keywords: ["Clorefy pricing", "AI invoice generator price", "document generator pricing", "free invoice maker", "cheap invoice software", "SaaS pricing plans"],
    alternates: { canonical: "/pricing" },
    openGraph: {
        title: "Clorefy Pricing — Plans for Every Business Size",
        description: "Free plan with 5 docs/month. Starter $9/mo, Pro $24/mo. AI-powered document generation for invoices, contracts, quotations, proposals.",
    },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {/* JSON-LD — Product + Offers for pricing rich results */}
            <JsonLd
                data={{
                    "@type": "Product",
                    name: "Clorefy AI Document Generator",
                    description: "AI-powered platform to generate invoices, contracts, quotations, and proposals from natural language.",
                    brand: { "@type": "Brand", name: "Clorefy" },
                    offers: [
                        {
                            "@type": "Offer",
                            name: "Free",
                            price: "0",
                            priceCurrency: "USD",
                            description: "5 documents per month with PDF export",
                            availability: "https://schema.org/InStock",
                            url: "https://clorefy.com/pricing",
                        },
                        {
                            "@type": "Offer",
                            name: "Starter",
                            price: "9",
                            priceCurrency: "USD",
                            description: "50 documents per month, all 4 document types, PDF + DOCX export",
                            availability: "https://schema.org/InStock",
                            url: "https://clorefy.com/pricing",
                            priceValidUntil: "2026-12-31",
                        },
                        {
                            "@type": "Offer",
                            name: "Starter (Yearly)",
                            price: "7",
                            priceCurrency: "USD",
                            description: "50 documents per month, billed yearly — save ~20%",
                            availability: "https://schema.org/InStock",
                            url: "https://clorefy.com/pricing",
                            priceValidUntil: "2026-12-31",
                        },
                        {
                            "@type": "Offer",
                            name: "Pro",
                            price: "24",
                            priceCurrency: "USD",
                            description: "150 documents per month, digital signatures, custom branding",
                            availability: "https://schema.org/InStock",
                            url: "https://clorefy.com/pricing",
                            priceValidUntil: "2026-12-31",
                        },
                        {
                            "@type": "Offer",
                            name: "Pro (Yearly)",
                            price: "19",
                            priceCurrency: "USD",
                            description: "150 documents per month, billed yearly — save ~20%",
                            availability: "https://schema.org/InStock",
                            url: "https://clorefy.com/pricing",
                            priceValidUntil: "2026-12-31",
                        },
                        {
                            "@type": "Offer",
                            name: "Agency",
                            price: "59",
                            priceCurrency: "USD",
                            description: "Unlimited documents, 3 team members, priority support",
                            availability: "https://schema.org/PreOrder",
                            url: "https://clorefy.com/pricing",
                            priceValidUntil: "2026-12-31",
                        },
                        {
                            "@type": "Offer",
                            name: "Agency (Yearly)",
                            price: "47",
                            priceCurrency: "USD",
                            description: "Unlimited documents, billed yearly — save ~20%",
                            availability: "https://schema.org/PreOrder",
                            url: "https://clorefy.com/pricing",
                            priceValidUntil: "2026-12-31",
                        },
                    ],
                    aggregateRating: {
                        "@type": "AggregateRating",
                        ratingValue: "4.8",
                        ratingCount: "150",
                        bestRating: "5",
                    },
                }}
            />
            {children}
        </>
    )
}

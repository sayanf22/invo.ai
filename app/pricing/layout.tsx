import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Pricing — Free, Starter, Pro & Agency Plans",
    description: "Clorefy pricing plans starting from free. Starter at $9.99/mo for 50 documents, Pro at $24.99/mo for 150 documents. AI invoice generator, contract maker, proposal writer. Cancel anytime.",
    keywords: ["Clorefy pricing", "AI invoice generator price", "document generator pricing", "free invoice maker", "cheap invoice software", "SaaS pricing plans"],
    alternates: { canonical: "/pricing" },
    openGraph: {
        title: "Clorefy Pricing — Plans for Every Business Size",
        description: "Free plan with 3 docs/month. Starter $9.99/mo, Pro $24.99/mo. AI-powered document generation for invoices, contracts, quotations, proposals.",
    },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {/* JSON-LD — Product + Offers for pricing rich results */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Product",
                        "name": "Clorefy AI Document Generator",
                        "description": "AI-powered platform to generate invoices, contracts, quotations, and proposals from natural language.",
                        "brand": { "@type": "Brand", "name": "Clorefy" },
                        "offers": [
                            { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "USD", "description": "3 documents per month", "url": "https://clorefy.com/pricing" },
                            { "@type": "Offer", "name": "Starter", "price": "9.99", "priceCurrency": "USD", "description": "50 documents per month", "url": "https://clorefy.com/pricing", "priceValidUntil": "2026-12-31" },
                            { "@type": "Offer", "name": "Pro", "price": "24.99", "priceCurrency": "USD", "description": "150 documents per month", "url": "https://clorefy.com/pricing", "priceValidUntil": "2026-12-31" },
                            { "@type": "Offer", "name": "Agency", "price": "59.99", "priceCurrency": "USD", "description": "Unlimited documents", "url": "https://clorefy.com/pricing", "priceValidUntil": "2026-12-31" },
                        ],
                        "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "ratingCount": "150", "bestRating": "5" },
                    }),
                }}
            />
            {children}
        </>
    )
}

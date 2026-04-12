import type { Metadata } from "next"
import { JsonLd } from "@/components/seo/json-ld"

export const metadata: Metadata = {
    title: "Features — AI Document Generation, Templates, Export & E-Signatures",
    description: "Explore Clorefy's AI-powered features: instant document generation, 9 professional templates, multi-country tax compliance, PDF/DOCX/image export, digital signatures, and more.",
    keywords: ["AI document features", "invoice templates", "contract templates", "PDF export", "e-signatures", "tax compliance", "document automation features"],
    alternates: { canonical: "/features" },
    openGraph: {
        title: "Clorefy Features — AI Document Generation Platform",
        description: "AI-powered invoices, contracts, quotations, proposals. 9 templates, 11 countries, all export formats.",
    },
}

const webPageJsonLd = {
    "@type": "WebPage",
    name: "Clorefy Features — AI Document Generation Platform",
    description: "Explore Clorefy's AI-powered features: instant document generation, 9 professional templates, multi-country tax compliance, PDF/DOCX/image export, digital signatures, and more.",
    url: "https://clorefy.com/features",
    mainEntity: {
        "@type": "SoftwareApplication",
        name: "Clorefy",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "AI-powered document generation platform for invoices, contracts, quotations, and proposals across 11 countries.",
        featureList: [
            "AI-powered document generation",
            "Multi-country tax compliance",
            "PDF, DOCX, and image export",
            "Digital e-signatures",
            "Custom branding and templates",
            "Multi-currency support",
            "Audit trail and version history",
            "Team collaboration",
        ],
        offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: "0",
            highPrice: "59",
            offerCount: 4,
        },
    },
}

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <JsonLd data={webPageJsonLd} />
            {children}
        </>
    )
}

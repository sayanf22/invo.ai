import type { Metadata } from "next"

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

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
    return children
}

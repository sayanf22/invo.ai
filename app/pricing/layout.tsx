import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Pricing — Free, Starter, Pro & Agency Plans",
    description: "Clorefy pricing plans starting from free. Starter at $9.99/mo for 50 documents, Pro at $24.99/mo for 150 documents. AI invoice generator, contract maker, proposal writer. Cancel anytime.",
    keywords: ["Clorefy pricing", "AI invoice generator price", "document generator pricing", "free invoice maker", "cheap invoice software", "SaaS pricing plans"],
    openGraph: {
        title: "Clorefy Pricing — Plans for Every Business Size",
        description: "Free plan with 3 docs/month. Starter $9.99/mo, Pro $24.99/mo. AI-powered document generation for invoices, contracts, quotations, proposals.",
    },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return children
}

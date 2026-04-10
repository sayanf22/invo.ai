import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Resources — Guides, Tutorials & Templates",
    description: "Learn how to use Clorefy for AI document generation. Guides for invoices, contracts, quotations, proposals. Video tutorials, template gallery, and compliance documentation.",
    keywords: ["invoice guide", "contract template guide", "AI document tutorial", "how to create invoice", "proposal writing guide"],
}

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
    return children
}

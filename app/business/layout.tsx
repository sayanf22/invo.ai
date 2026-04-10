import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Clorefy for Business — Team Document Generation",
    description: "Centralized AI document generation for teams. Shared templates, consistent branding, usage dashboards, and enterprise-grade security. Scale your document workflow.",
    keywords: ["business document automation", "team invoicing", "enterprise document generation", "business proposal tool", "team contract management"],
}

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
    return children
}

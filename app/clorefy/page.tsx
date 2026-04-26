import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Clorefy — AI Invoice, Contract & Proposal Generator",
  description:
    "Clorefy is an AI-powered platform that generates professional invoices, contracts, quotations, and proposals in seconds. Free plan available. Supports 11 countries.",
  alternates: {
    canonical: "https://clorefy.com",
  },
  robots: { index: false, follow: true },
}

/**
 * /clorefy — brand name URL slug.
 * Redirects to homepage. The page existing at this URL helps Google associate
 * the brand name "Clorefy" with this domain (same pattern used by Notion, Linear, etc.)
 */
export default function ClorefyPage() {
  redirect("/")
}

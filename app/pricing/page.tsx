import { LandingLayout } from "@/components/landing/landing-layout"
import { Clock, Zap, Lock } from "lucide-react"
import { BillingToggle, type PlanData } from "@/components/landing/billing-toggle"
import { FaqAccordion, type FaqItem } from "@/components/landing/faq-accordion"
import { AnimatedHero } from "@/components/landing/animated-hero"
import { AnimatedCard } from "@/components/landing/animated-card"
import { Breadcrumbs } from "@/components/seo/breadcrumbs"
import { generateProductSchema, type PricingPlan } from "@/lib/structured-data"
import { ComparisonTable } from "@/components/landing/comparison-table"

// ─── Plan data ────────────────────────────────────────────────────────────────

const plans: PlanData[] = [
  {
    id: "free",
    name: "Free",
    badge: null,
    monthly: 0,
    yearly: 0,
    desc: "Perfect for trying it out",
    valueHint: "~$0 per document",
    cta: "Get Started Free",
    ctaNote: "No credit card required",
    href: "/auth/signup",
    featured: false,
    comingSoon: false,
    features: [
      { text: "5 documents / month", tip: null },
      { text: "Invoice + Contract", tip: null },
      { text: "10 messages per session", tip: null },
      { text: "3 templates", tip: "Modern, Classic, Minimal" },
      { text: "All 11 countries", tip: null },
      { text: "PDF export", tip: null },
      { text: "5 email sends / month", tip: null },
      { text: "Custom logo & branding", tip: null },
    ],
    missing: [
      "Quotations & Proposals",
      "All 9 templates",
      "DOCX & image export",
      "Digital signatures",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    badge: null,
    monthly: 9,
    yearly: 7,
    desc: "For freelancers & solo pros",
    valueHint: "~$0.18 per document",
    cta: "Start Free Trial",
    ctaNote: "14-day free trial",
    href: "/auth/signup",
    featured: false,
    comingSoon: false,
    features: [
      { text: "50 documents / month", tip: null },
      { text: "All 4 document types", tip: "Invoice, Contract, Quote, Proposal" },
      { text: "30 messages per session", tip: null },
      { text: "All 9 templates", tip: null },
      { text: "All 11 countries", tip: null },
      { text: "PDF + DOCX export", tip: null },
      { text: "100 email sends / month", tip: null },
      { text: "Custom logo & branding", tip: null },
    ],
    missing: [
      "Digital signatures",
      "Image export",
      "Team members",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Most Popular",
    monthly: 24,
    yearly: 19,
    desc: "For growing businesses",
    valueHint: "~$0.16 per document",
    cta: "Start Free Trial",
    ctaNote: "14-day free trial",
    href: "/auth/signup",
    featured: true,
    comingSoon: false,
    features: [
      { text: "150 documents / month", tip: null },
      { text: "All 4 document types", tip: null },
      { text: "50 messages per session", tip: null },
      { text: "All 9 templates", tip: null },
      { text: "All 11 countries", tip: null },
      { text: "PDF + DOCX + Image export", tip: null },
      { text: "250 email sends / month", tip: null },
      { text: "Digital signatures", tip: null },
      { text: "Custom logo & branding", tip: null },
    ],
    missing: [
      "Team members",
      "Priority support",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    badge: "Coming Soon",
    monthly: 59,
    yearly: 47,
    desc: "For teams & agencies",
    valueHint: "Unlimited documents",
    cta: "Join Waitlist",
    ctaNote: "Be first when it launches",
    href: "#",
    featured: false,
    comingSoon: true,
    features: [
      { text: "Unlimited documents", tip: null },
      { text: "All 4 document types", tip: null },
      { text: "Unlimited messages per session", tip: null },
      { text: "All 9 templates", tip: null },
      { text: "All 11 countries", tip: null },
      { text: "All export formats", tip: null },
      { text: "Unlimited email sends", tip: null },
      { text: "Digital signatures", tip: null },
      { text: "Custom logo & branding", tip: null },
      { text: "3 team members", tip: null },
      { text: "Priority support", tip: null },
    ],
    missing: [],
  },
]

const faqs: FaqItem[] = [
  {
    question: "Is there a free trial?",
    answer: "Yes — the Free plan is free forever, no card needed. Starter and Pro include a 14-day free trial so you can explore everything before committing.",
  },
  {
    question: "What counts as one document?",
    answer: "Each new document session counts as one document. All AI messages within that session (edits, refinements, follow-ups) are free up to your plan's message limit. Once you download a document, it's finalized and locked — you'll need a new session for changes.",
  },
  {
    question: "Can I switch plans anytime?",
    answer: "Absolutely. Upgrade, downgrade, or cancel at any time. No lock-in, no cancellation fees. Unused quota doesn't roll over.",
  },
  {
    question: "What's the difference between monthly and yearly?",
    answer: "Yearly billing saves you ~20% compared to monthly. You're billed once per year upfront. You can switch to yearly at any time.",
  },
  {
    question: "When does Agency launch?",
    answer: "Agency is coming soon. Join the waitlist and you'll be the first to know — plus get an early-bird discount when it launches.",
  },
]

// ─── Structured data (Product schema) ────────────────────────────────────────

const pricingPlans: PricingPlan[] = [
  {
    name: "Free",
    price: 0,
    currency: "USD",
    description: "5 documents/month, Invoice + Contract, all 11 countries, PDF export. No credit card required.",
    billingPeriod: "P1M",
  },
  {
    name: "Starter",
    price: 9,
    currency: "USD",
    description: "50 documents/month, all 4 document types, all 9 templates, PDF + DOCX export, 30-day history.",
    billingPeriod: "P1M",
  },
  {
    name: "Pro",
    price: 24,
    currency: "USD",
    description: "150 documents/month, all document types and templates, PDF + DOCX + Image export, digital signatures, custom branding.",
    billingPeriod: "P1M",
  },
  {
    name: "Agency",
    price: 59,
    currency: "USD",
    description: "Unlimited documents, all features, 3 team members, priority support, forever history.",
    billingPeriod: "P1M",
  },
]

const productJsonLd = generateProductSchema(pricingPlans)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <LandingLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <div className="min-h-screen" style={{ backgroundColor: "#faf8f5" }}>

        {/* ── Breadcrumbs ── */}
        <div className="max-w-6xl mx-auto pt-28 px-6">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Pricing" }]} />
        </div>

        {/* ── Hero ── */}
        <section className="pt-8 pb-16 px-6 text-center">
          <AnimatedHero className="space-y-7">
            {/* Social proof pill */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-stone-200/80 text-sm shadow-sm">
              <span className="flex -space-x-1.5">
                {["#f97316", "#3b82f6", "#10b981", "#8b5cf6"].map((c, i) => (
                  <span key={i} className="w-5 h-5 rounded-full border-2 border-white" style={{ background: c }} />
                ))}
              </span>
              <span className="text-stone-500 font-medium">2,400+ professionals save hours every week</span>
            </div>

            <h1 className="font-display text-5xl sm:text-6xl font-medium tracking-tight leading-[1.08]" style={{ color: "#1a1a1a" }}>
              Simple pricing,<br />
              <span className="font-serif italic" style={{ color: "#e07b39" }}>serious value</span>
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-stone-400">
              <span className="flex items-center gap-1.5"><Clock size={13} style={{ color: "#e07b39" }} /> Save 3–5 hrs per document</span>
              <span className="flex items-center gap-1.5"><Zap size={13} style={{ color: "#e07b39" }} /> Ready in under 30 seconds</span>
              <span className="flex items-center gap-1.5"><Lock size={13} style={{ color: "#e07b39" }} /> Cancel anytime</span>
            </div>

            {/* BillingToggle handles: toggle, cards, trust strip, comparison, and bottom CTA */}
            <BillingToggle plans={plans} />
          </AnimatedHero>
        </section>

        {/* ── Competitor Comparison Table ── */}
        <ComparisonTable />

        {/* ── FAQ ── */}
        <section className="py-24 px-6" style={{ backgroundColor: "#faf8f5" }}>
          <div className="max-w-2xl mx-auto">
            <AnimatedCard y={20}>
              <div className="text-center mb-12">
                <h2 className="font-display text-4xl font-medium mb-2" style={{ color: "#1a1a1a" }}>Common questions</h2>
                <p className="text-stone-400 text-sm">Everything you need to know before signing up.</p>
              </div>
            </AnimatedCard>

            <FaqAccordion items={faqs} />
          </div>
        </section>

      </div>
    </LandingLayout>
  )
}

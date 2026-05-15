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
      { text: "Invoice + Contract + Quote", tip: null },
      { text: "10 messages per session", tip: null },
      { text: "3 templates", tip: "Modern, Classic, Minimal" },
      { text: "Every country worldwide", tip: "Tax and compliance rules for 150+ countries" },
      { text: "PDF export", tip: null },
      { text: "5 email sends / month", tip: null },
      { text: "Custom logo & branding", tip: null },
    ],
    missing: [
      "Proposals, SOWs, NDAs & 3 more types",
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
      { text: "All 9 document types", tip: "Invoice, Contract, Quote, Proposal, SOW, NDA, Change Order, Onboarding Form, Payment Reminder" },
      { text: "30 messages per session", tip: null },
      { text: "All 9 templates", tip: null },
      { text: "Every country worldwide", tip: "Tax and compliance rules for 150+ countries" },
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
      { text: "All 9 document types", tip: null },
      { text: "50 messages per session", tip: null },
      { text: "All 9 templates", tip: null },
      { text: "Every country worldwide", tip: "Tax and compliance rules for 150+ countries" },
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
      { text: "All 9 document types", tip: null },
      { text: "Unlimited messages per session", tip: null },
      { text: "All 9 templates", tip: null },
      { text: "Every country worldwide", tip: "Tax and compliance rules for 150+ countries" },
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
    description: "5 documents/month, Invoice + Contract + Quote, every country worldwide, PDF export. No credit card required.",
    billingPeriod: "P1M",
  },
  {
    name: "Starter",
    price: 9,
    currency: "USD",
    description: "50 documents/month, all 9 document types, all 9 templates, PDF + DOCX export, 30-day history.",
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

// ─── FAQ Structured Data (for rich snippets) ─────────────────────────────────

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <LandingLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── Hero section — matches landing hero aesthetic ── */}
      <section className="relative w-full overflow-hidden bg-[var(--landing-cream)] pt-32 pb-0 sm:pt-36">
        {/* Same background treatment as landing hero */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-[#F5F4F0] to-[#EAE8E3] opacity-90" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none" />
        <div
          className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[500px] rounded-[100%] opacity-40 pointer-events-none blur-[100px]"
          style={{ background: "radial-gradient(circle, rgba(198,122,60,0.12) 0%, transparent 60%)" }}
        />

        <div className="relative z-10 max-w-6xl mx-auto">
          {/* Breadcrumbs */}
          <div className="px-4 sm:px-6 mb-6">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Pricing" }]} />
          </div>

          {/* Hero content */}
          <div className="text-center px-4 sm:px-6 pb-12">
            <AnimatedHero className="space-y-6 sm:space-y-7">
              {/* Beta-style pill */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-stone-200/50 bg-white/70 backdrop-blur-md shadow-sm">
                <span className="flex -space-x-1.5">
                  {["#C67A3C", "#1e3a8a", "#065f46", "#881337"].map((c, i) => (
                    <span key={i} className="w-4 h-4 rounded-full border-2 border-white" style={{ background: c }} />
                  ))}
                </span>
                <span className="text-[13px] font-medium text-[var(--landing-text-dark)]">
                  <span className="font-bold text-[var(--landing-amber)] mr-1">2,400+</span>
                  professionals save hours every week
                </span>
              </div>

              {/* Main heading — matches landing typography */}
              <h1
                className="font-display text-[2.75rem] sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tighter leading-[1.02] text-[var(--landing-text-dark)]"
                style={{ textShadow: "3px 3px 0px rgba(26,26,26,0.08), 0 8px 24px rgba(26,26,26,0.06)" }}
              >
                Simple pricing,<br />
                <span
                  className="font-serif italic"
                  style={{
                    backgroundImage: "linear-gradient(120deg, #d97757 0%, #e07b39 45%, #b8421c 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  serious value
                </span>
              </h1>

              {/* Value props strip */}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--landing-text-muted)] font-medium">
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-[var(--landing-amber)]" strokeWidth={2.5} /> Save 3–5 hrs per document
                </span>
                <span className="w-1 h-1 rounded-full bg-stone-300" />
                <span className="flex items-center gap-1.5">
                  <Zap size={13} className="text-[var(--landing-amber)]" strokeWidth={2.5} /> Ready in under 30 seconds
                </span>
                <span className="w-1 h-1 rounded-full bg-stone-300" />
                <span className="flex items-center gap-1.5">
                  <Lock size={13} className="text-[var(--landing-amber)]" strokeWidth={2.5} /> Cancel anytime
                </span>
              </div>

              {/* BillingToggle handles: toggle, cards, trust strip, comparison, and bottom CTA */}
              <BillingToggle plans={plans}>
                <ComparisonTable />
              </BillingToggle>
            </AnimatedHero>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-[var(--landing-cream)]">
        <div className="max-w-2xl mx-auto">
          <AnimatedCard y={20}>
            <div className="text-center mb-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3 text-[var(--landing-amber)]">FAQ</p>
              <h2
                className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-[var(--landing-text-dark)] leading-[1.05]"
                style={{ textShadow: "2px 2px 0px rgba(26,26,26,0.06), 0 6px 20px rgba(26,26,26,0.04)" }}
              >
                Common{" "}
                <span
                  className="font-serif italic"
                  style={{
                    backgroundImage: "linear-gradient(120deg, #d97757 0%, #e07b39 45%, #b8421c 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  questions
                </span>
              </h2>
              <p className="text-[var(--landing-text-muted)] text-sm sm:text-base mt-4">
                Everything you need to know before signing up.
              </p>
            </div>
          </AnimatedCard>

          <FaqAccordion items={faqs} />
        </div>
      </section>
    </LandingLayout>
  )
}

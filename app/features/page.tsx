import { LandingLayout } from "@/components/landing/landing-layout"
import { FeatureTabNav, type TabData, type TabContentData } from "@/components/landing/feature-tab-nav"
import { AnimatedCard } from "@/components/landing/animated-card"
import { Breadcrumbs } from "@/components/seo/breadcrumbs"
import {
    FileText, Wand2, Globe, Zap, Shield, Palette,
    CheckCircle, ArrowRight,
    Stamp, Calculator, PenTool, Bell, RefreshCw, CreditCard, Mail
} from "lucide-react"
import Link from "next/link"

const tabs: TabData[] = [
    { id: "generate", label: "Generate", icon: "Wand2" },
    { id: "customize", label: "Customize", icon: "Palette" },
    { id: "comply", label: "Comply", icon: "Shield" },
    { id: "export", label: "Export", icon: "FileText" },
    { id: "send", label: "Send & Collect", icon: "Zap" },
]

const tabContent: Record<string, TabContentData> = {
    generate: {
        title: "AI document generation",
        desc: "Describe what you need in plain language. Clorefy generates invoices, contracts, quotes, estimates, proposals, NDAs, SOWs, change orders, and every document type in seconds.",
        features: [
            { icon: "Wand2", name: "Every document type", detail: "Invoice, Contract, Quote, Estimate, Proposal, SOW, NDA, Change Order, Client Onboarding Form, Payment Follow-up" },
            { icon: "FileText", name: "Smart AI drafting", detail: "Turn a few sentences into a complete, formatted document — your business details auto-filled" },
            { icon: "Globe", name: "Global tax compliance", detail: "GST, VAT, HST, Sales Tax — calculated automatically based on your country and registration status" },
        ]
    },
    customize: {
        title: "Make every document yours",
        desc: "Your logo, your colors, your fonts. Choose from a library of PDF templates and customize them to match your brand.",
        features: [
            { icon: "Palette", name: "Premium PDF templates", detail: "Modern, Classic, Bold, Minimal, Elegant, Corporate, Creative, Warm, Geometric" },
            { icon: "PenTool", name: "Custom logo & branding", detail: "Upload your logo — it appears on every document you generate" },
            { icon: "FileText", name: "Editable after generation", detail: "Edit any field after the AI generates it — full manual control in the editor" },
        ]
    },
    comply: {
        title: "Stay compliant, automatically",
        desc: "Country-specific tax rules, mandatory fields, and legal requirements are injected automatically at generation time — no manual lookup needed.",
        features: [
            { icon: "Calculator", name: "Auto tax calculation", detail: "GST (India), VAT (UK/EU/UAE), HST/GST (Canada), Sales Tax (USA) — auto-applied" },
            { icon: "Shield", name: "Tax registration aware", detail: "If you're not tax-registered, taxRate stays 0. Registered businesses get correct rates applied" },
            { icon: "Stamp", name: "Signature audit trail", detail: "E-signed contracts record IP, timestamp, signer identity, and document hash for verification" },
        ]
    },
    export: {
        title: "Export in any format",
        desc: "Download as PDF, Word document, or image. Share via link. Send directly to clients by email — all from the same screen.",
        features: [
            { icon: "FileText", name: "PDF export", detail: "Pixel-perfect PDFs with your branding, all tiers" },
            { icon: "Globe", name: "DOCX export", detail: "Word-compatible .docx files — Starter, Pro, and Agency" },
            { icon: "PenTool", name: "Image export (PNG/JPG)", detail: "Export as image for social or sharing — Pro and Agency" },
        ]
    },
    send: {
        title: "Send, collect, and follow up",
        desc: "Email documents directly to clients, attach a payment link, and let automated reminders handle the follow-up.",
        features: [
            { icon: "Zap", name: "Email to clients", detail: "Send any document via email with AI-written message — directly from the app" },
            { icon: "Globe", name: "Payment links", detail: "Attach Razorpay, Stripe, or Cashfree payment links — clients pay in one click" },
            { icon: "FileText", name: "Auto follow-up reminders", detail: "Automated payment reminders up to 37 days after the due date — paid tiers" },
        ]
    }
}

const featureGrid = [
    { icon: Wand2, name: "AI Generation", desc: "Natural language to documents" },
    { icon: Palette, name: "Custom Branding", desc: "Your logo, colors, and premium templates" },
    { icon: Calculator, name: "Auto Tax", desc: "GST, VAT, sales tax calculated" },
    { icon: Globe, name: "Multi-Currency", desc: "Generate in any currency" },
    { icon: Bell, name: "Payment Reminders", desc: "Auto follow-up until paid" },
    { icon: Shield, name: "E-Signatures", desc: "Built-in signing with audit trail" },
    { icon: FileText, name: "PDF Export", desc: "Pixel-perfect documents" },
    { icon: Zap, name: "DOCX & Image Export", desc: "PDF, DOCX, PNG, JPG" },
    { icon: RefreshCw, name: "Recurring Invoices", desc: "Weekly, monthly, or quarterly" },
    { icon: Stamp, name: "Signature Audit", desc: "Verified e-sign records" },
    { icon: CheckCircle, name: "Global Compliance", desc: "150+ country tax rules" },
    { icon: CreditCard, name: "Payment Links", desc: "Razorpay, Stripe, Cashfree" },
]

export default function FeaturesPage() {
    return (
        <LandingLayout>
            <div className="min-h-screen">
                {/* Breadcrumbs */}
                <div className="max-w-5xl mx-auto pt-28 px-6 sm:px-10">
                    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Features" }]} />
                </div>

                {/* Hero */}
                <section className="relative pt-6 pb-20 px-6 sm:px-10 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100/40 via-transparent to-transparent opacity-60 pointer-events-none" />
                    <div className="max-w-5xl mx-auto text-center relative z-10">
                        <AnimatedCard>
                            <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-tight text-[var(--landing-text-dark)] mb-6 leading-[1.1]">
                                Everything you actually <br />
                                <span className="font-serif italic text-[var(--landing-amber)]">get with Clorefy</span>
                            </h1>
                            <p className="text-xl sm:text-2xl text-[var(--landing-text-muted)] max-w-2xl mx-auto mb-10">
                                Every document type. Global tax compliance. Email, payment links, and reminders. No separate tools needed.
                            </p>
                        </AnimatedCard>

                        {/* Tab Navigation */}
                        <AnimatedCard delay={0.2}>
                            <FeatureTabNav tabs={tabs} tabContent={tabContent} />
                        </AnimatedCard>
                    </div>
                </section>

                {/* All Features Grid */}
                <section className="py-24 px-6 sm:px-10 bg-white">
                    <div className="max-w-6xl mx-auto">
                        <AnimatedCard>
                            <div className="text-center mb-16">
                                <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">What&apos;s included</h2>
                                <p className="text-lg text-[var(--landing-text-muted)] max-w-xl mx-auto">
                                    Every feature below is built and working in the app today.
                                </p>
                            </div>
                        </AnimatedCard>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {featureGrid.map((item, i) => (
                                <AnimatedCard key={item.name} delay={i * 0.04}>
                                    <div className="p-5 rounded-2xl bg-white border-[2px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] hover:shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 transition-all duration-200">
                                        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
                                            <item.icon size={18} className="text-[var(--landing-amber)]" />
                                        </div>
                                        <p className="font-bold text-sm text-[var(--landing-text-dark)] mb-1">{item.name}</p>
                                        <p className="text-xs text-[var(--landing-text-muted)]">{item.desc}</p>
                                    </div>
                                </AnimatedCard>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-24 px-6 sm:px-10">
                    <AnimatedCard>
                        <div className="max-w-4xl mx-auto bg-[var(--landing-dark)] rounded-[3rem] p-12 sm:p-20 text-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-mesh-dark opacity-50" />
                            <h2 className="font-display text-4xl sm:text-5xl text-[var(--landing-cream)] mb-4 relative z-10">
                                Ready to <span className="text-[var(--landing-amber)] italic font-serif">flow</span>?
                            </h2>
                            <p className="text-[var(--landing-text-dim)] text-lg mb-8 relative z-10">
                                Start creating professional documents in seconds, not hours.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
                                <Link
                                    href="/auth/signup"
                                    className="group inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[var(--landing-cream)] text-[var(--landing-dark)] font-bold text-lg hover:scale-105 transition-transform"
                                >
                                    Get Started Free
                                    <ArrowRight className="transition-transform group-hover:translate-x-1" size={20} />
                                </Link>
                            </div>
                        </div>
                    </AnimatedCard>
                </section>
            </div>
        </LandingLayout>
    )
}

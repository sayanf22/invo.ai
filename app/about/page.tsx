"use client"

import { LandingLayout } from "@/components/landing/landing-layout"
import { motion } from "framer-motion"
import { ArrowRight, Zap, Globe, FileText, Shield, CreditCard, Bell } from "lucide-react"
import Link from "next/link"

const fadeUp = {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
}

const howItWorks = [
    {
        step: "01",
        title: "Set up your business profile",
        desc: "During onboarding, tell the AI your business name, country, tax registration status, and currency. This is saved permanently — you never fill it in again.",
    },
    {
        step: "02",
        title: "Describe your document",
        desc: "Type what you need in plain English. 'Invoice for ₹5,000 web design to Acme Corp' or 'NDA with GlobalCorp valid for 2 years' — the AI handles the rest.",
    },
    {
        step: "03",
        title: "Review and edit",
        desc: "The AI generates a complete document with your business details pre-filled and the correct tax rates applied. Edit any field in the editor or by chatting with the AI.",
    },
    {
        step: "04",
        title: "Send, sign, and get paid",
        desc: "Email the document directly to your client with a payment link attached. For contracts and NDAs, send a signing link. Follow-up reminders run automatically.",
    },
]

const whatWeActuallyBuild = [
    { icon: FileText, label: "Every document type", detail: "Invoice, Contract, Quote, Estimate, Proposal, SOW, NDA, Change Order, Onboarding Form, Payment Follow-up" },
    { icon: Globe, label: "Global tax compliance", detail: "GST (India), VAT (UK/EU/UAE), HST/GST (Canada), Sales Tax (USA), and more" },
    { icon: Zap, label: "AI from plain language", detail: "No forms to fill — just describe what you need and the document is generated" },
    { icon: CreditCard, label: "Payment links", detail: "Razorpay, Stripe, and Cashfree — clients pay directly from the document" },
    { icon: Bell, label: "Automated reminders", detail: "Payment reminders sent automatically until the invoice is paid" },
    { icon: Shield, label: "E-signatures", detail: "Send documents for signing — recipients sign in the browser, no account needed" },
]

export default function AboutPage() {
    return (
        <LandingLayout>
            <div className="min-h-screen">
                {/* Hero */}
                <section className="relative pt-32 pb-20 px-6 sm:px-10 overflow-hidden bg-[var(--landing-cream)]">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-[#F5F4F0] to-[#EAE8E3] opacity-90" />
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none" />
                    <div className="max-w-4xl mx-auto text-center relative z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <h1
                                className="font-display text-5xl sm:text-7xl font-semibold tracking-tighter text-[var(--landing-text-dark)] mb-6 leading-[1.02]"
                                style={{ textShadow: "3px 3px 0px rgba(26,26,26,0.08), 0 8px 24px rgba(26,26,26,0.06)" }}
                            >
                                About{" "}
                                <span
                                    className="font-serif italic"
                                    style={{
                                        backgroundImage: "linear-gradient(120deg, #d97757 0%, #e07b39 45%, #b8421c 100%)",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                        backgroundClip: "text",
                                    }}
                                >
                                    Clorefy
                                </span>
                            </h1>
                            <p className="text-xl sm:text-2xl text-[var(--landing-text-muted)] max-w-2xl mx-auto">
                                An AI-powered document generation platform for service businesses — invoices, contracts, proposals, NDAs, and more.
                            </p>
                        </motion.div>
                    </div>
                </section>

                {/* What we are */}
                <section className="py-20 px-6 sm:px-10 bg-white">
                    <div className="max-w-4xl mx-auto">
                        <motion.div {...fadeUp} className="space-y-6 text-[var(--landing-text-dark)]">
                            <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
                                What Clorefy is
                            </h2>
                            <p className="text-lg text-[var(--landing-text-muted)] leading-relaxed">
                                Clorefy is a document generation platform powered by AI. You describe what you need in plain language — an invoice, a contract, a proposal — and the AI produces a complete, formatted document with your business details and the correct tax rules already applied.
                            </p>
                            <p className="text-lg text-[var(--landing-text-muted)] leading-relaxed">
                                It was built for freelancers, consultants, agencies, and small businesses that create professional documents regularly and want to spend less time on admin. You spend 30 seconds describing the document. We handle the formatting, tax calculation, email delivery, payment collection, and follow-up reminders.
                            </p>
                            <div className="flex flex-wrap gap-3 pt-2">
                                <Link href="/auth/signup" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--landing-dark)] text-white font-bold text-sm border-[2px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] hover:shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 transition-all group">
                                    Try it free <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                                <Link href="/features" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm border-[2px] border-[var(--landing-dark)] hover:bg-[var(--landing-dark)] hover:text-white hover:shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] transition-all">
                                    See all features
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* What we've built */}
                <section className="py-20 px-6 sm:px-10 bg-[var(--landing-cream)]">
                    <div className="max-w-5xl mx-auto">
                        <motion.div {...fadeUp} className="mb-12">
                            <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] mb-3">
                                What&apos;s built
                            </h2>
                            <p className="text-lg text-[var(--landing-text-muted)]">
                                Every item below is live in the app today.
                            </p>
                        </motion.div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {whatWeActuallyBuild.map((item, i) => (
                                <motion.div
                                    key={item.label}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.07, duration: 0.55 }}
                                    className="flex items-start gap-4 p-5 rounded-2xl bg-white border-[2px] border-[var(--landing-dark)] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
                                >
                                    <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-[var(--landing-amber)] shrink-0 mt-0.5">
                                        <item.icon size={18} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-[var(--landing-text-dark)]">{item.label}</p>
                                        <p className="text-xs text-[var(--landing-text-muted)] mt-0.5 leading-relaxed">{item.detail}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section className="py-20 px-6 sm:px-10 bg-white">
                    <div className="max-w-4xl mx-auto">
                        <motion.div {...fadeUp} className="mb-12">
                            <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
                                How it works
                            </h2>
                        </motion.div>
                        <div className="space-y-6">
                            {howItWorks.map((step, i) => (
                                <motion.div
                                    key={step.step}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1, duration: 0.6 }}
                                    className="flex gap-5 p-6 rounded-2xl border-[2px] border-[var(--landing-dark)] bg-[var(--landing-cream)] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]"
                                >
                                    <div className="text-[var(--landing-amber)] font-display font-bold text-2xl leading-none shrink-0 mt-0.5">
                                        {step.step}
                                    </div>
                                    <div>
                                        <h3 className="font-display text-lg font-bold text-[var(--landing-text-dark)] mb-1.5">{step.title}</h3>
                                        <p className="text-sm text-[var(--landing-text-muted)] leading-relaxed">{step.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Technology */}
                <section className="py-20 px-6 sm:px-10 bg-[var(--landing-cream)]">
                    <div className="max-w-4xl mx-auto">
                        <motion.div {...fadeUp} className="space-y-4">
                            <h2 className="font-display text-4xl font-semibold tracking-tight">Technology</h2>
                            <p className="text-[var(--landing-text-muted)] leading-relaxed">
                                Clorefy runs on <strong className="text-[var(--landing-text-dark)]">DeepSeek AI</strong> for document generation, <strong className="text-[var(--landing-text-dark)]">Supabase</strong> for the database with row-level security, <strong className="text-[var(--landing-text-dark)]">Cloudflare Workers</strong> for the edge runtime, and <strong className="text-[var(--landing-text-dark)]">Cloudflare R2</strong> for file storage. Payments go through Razorpay, Stripe, or Cashfree — Clorefy never stores card details.
                            </p>
                        </motion.div>
                    </div>
                </section>

                {/* Contact */}
                <section className="py-20 px-6 sm:px-10 bg-white">
                    <motion.div
                        {...fadeUp}
                        className="max-w-4xl mx-auto bg-[var(--landing-dark)] rounded-[2.5rem] p-12 sm:p-16 text-center border-[2px] border-[var(--landing-dark)] shadow-[6px_6px_0px_0px_rgba(26,26,26,1)]"
                    >
                        <h2 className="font-display text-4xl sm:text-5xl text-[var(--landing-cream)] font-semibold tracking-tight mb-3">
                            Questions?
                        </h2>
                        <p className="text-stone-400 text-base mb-8">
                            Email <a href="mailto:support@clorefy.com" className="text-[var(--landing-amber)] hover:underline font-semibold">support@clorefy.com</a>. We respond within 24 hours on business days.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--landing-cream)] text-[var(--landing-dark)] font-bold text-sm hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] transition-all">
                                Contact us
                            </Link>
                            <Link href="/auth/signup" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-stone-600 text-stone-300 hover:text-white hover:border-stone-400 font-bold text-sm transition-all">
                                Start free →
                            </Link>
                        </div>
                    </motion.div>
                </section>
            </div>
        </LandingLayout>
    )
}

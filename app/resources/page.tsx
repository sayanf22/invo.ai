"use client"

import { LandingLayout } from "@/components/landing/landing-layout"
import { motion } from "framer-motion"
import { FileText, MessageCircle, HelpCircle, ArrowRight, BookOpen, Shield } from "lucide-react"
import Link from "next/link"

const resources = [
    {
        category: "Blog",
        title: "Tips, guides & product updates",
        desc: "How-to articles on creating invoices, contracts, proposals, and more — plus updates on new Clorefy features.",
        icon: BookOpen,
        color: "bg-orange-50 text-[var(--landing-amber)]",
        href: "/blog",
        live: true,
    },
    {
        category: "Pricing",
        title: "Free, Starter, Pro & Agency plans",
        desc: "Detailed plan comparison — what each plan includes, document limits, export formats, and feature availability.",
        icon: FileText,
        color: "bg-stone-100 text-stone-600",
        href: "/pricing",
        live: true,
    },
    {
        category: "Features",
        title: "What's built into Clorefy",
        desc: "A complete list of every feature available — document types, export formats, payment integrations, and compliance support.",
        icon: FileText,
        color: "bg-blue-50 text-blue-600",
        href: "/features",
        live: true,
    },
    {
        category: "Privacy & Security",
        title: "How your data is protected",
        desc: "Row-level security, CSRF protection, rate limiting, and payment processing via Razorpay, Stripe, and Cashfree.",
        icon: Shield,
        color: "bg-green-50 text-green-600",
        href: "/privacy",
        live: true,
    },
    {
        category: "Support",
        title: "Contact support",
        desc: "Email us at support@clorefy.com. We respond within 24 hours on business days (Mon–Fri, 10 AM – 7 PM IST).",
        icon: MessageCircle,
        color: "bg-rose-50 text-rose-600",
        href: "/contact",
        live: true,
    },
    {
        category: "Legal",
        title: "Terms, Privacy & Refund Policy",
        desc: "Full terms of service, privacy policy, and cancellation/refund policy — all in plain language.",
        icon: HelpCircle,
        color: "bg-purple-50 text-purple-600",
        href: "/terms",
        live: true,
    },
]

export default function ResourcesPage() {
    return (
        <LandingLayout>
            <div className="min-h-screen">
                {/* Hero */}
                <section className="pt-32 pb-16 px-6 text-center bg-[var(--landing-cream)]">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-[#F5F4F0] to-[#EAE8E3] opacity-90 pointer-events-none" />
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="relative z-10"
                    >
                        <h1
                            className="font-display text-5xl sm:text-7xl font-semibold tracking-tighter text-[var(--landing-text-dark)] mb-6 leading-[1.02]"
                            style={{ textShadow: "3px 3px 0px rgba(26,26,26,0.08), 0 8px 24px rgba(26,26,26,0.06)" }}
                        >
                            Resources
                        </h1>
                        <p className="text-xl text-[var(--landing-text-muted)] max-w-xl mx-auto">
                            Everything available for Clorefy right now.
                        </p>
                    </motion.div>
                </section>

                {/* Resources Grid */}
                <section className="pb-24 px-6 sm:px-10 bg-[var(--landing-cream)]">
                    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
                        {resources.map((res, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.07, duration: 0.55 }}
                            >
                                <Link
                                    href={res.href}
                                    className="group flex items-start gap-5 p-7 rounded-2xl bg-white border-[2px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] hover:shadow-[5px_5px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 transition-all h-full"
                                >
                                    <div className={`w-12 h-12 rounded-xl ${res.color} flex items-center justify-center shrink-0`}>
                                        <res.icon size={22} />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1 block">{res.category}</span>
                                        <h3 className="font-display text-lg font-bold mb-1.5 group-hover:text-[var(--landing-amber)] transition-colors">{res.title}</h3>
                                        <p className="text-[var(--landing-text-muted)] leading-relaxed text-sm mb-3">{res.desc}</p>
                                        <span className="inline-flex items-center text-[var(--landing-dark)] font-bold text-sm">
                                            Explore <ArrowRight size={13} className="ml-1 transition-transform group-hover:translate-x-1" />
                                        </span>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Contact CTA */}
                <section className="py-20 px-6 sm:px-10 bg-white">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                        className="max-w-2xl mx-auto text-center"
                    >
                        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mb-3">
                            Have a question?
                        </h2>
                        <p className="text-[var(--landing-text-muted)] mb-6">
                            Email <a href="mailto:support@clorefy.com" className="text-[var(--landing-amber)] font-semibold hover:underline">support@clorefy.com</a> and we&apos;ll respond within 24 hours on business days.
                        </p>
                        <Link
                            href="/contact"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--landing-dark)] text-white font-bold text-sm border-[2px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] hover:shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 transition-all"
                        >
                            Contact Support <ArrowRight size={15} />
                        </Link>
                    </motion.div>
                </section>
            </div>
        </LandingLayout>
    )
}

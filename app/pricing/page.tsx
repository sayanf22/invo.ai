"use client"

import { LandingLayout } from "@/components/landing/landing-layout"
import { motion } from "framer-motion"
import { Check, ArrowRight, Minus, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
}

const plans = [
    {
        name: "Starter",
        price: { monthly: "Free", yearly: "Free" },
        priceNote: "forever",
        desc: "The start of your document journey",
        cta: "Get Started",
        ctaStyle: "bg-white text-[var(--landing-dark)] border border-stone-200 hover:bg-stone-50",
        features: [
            "5 documents/month",
            "Basic AI generation",
            "PDF export",
            "1 template",
            "Email support",
        ],
        excluded: [
            "Custom branding",
            "E-signatures",
            "API access",
            "Team collaboration",
            "Priority support",
        ]
    },
    {
        name: "Pro",
        price: { monthly: "$15", yearly: "$12" },
        priceNote: "/user/mo",
        desc: "Everything in Starter, plus:",
        cta: "Start Free Trial",
        ctaStyle: "bg-[var(--landing-dark)] text-white hover:scale-105",
        popular: true,
        features: [
            "Unlimited documents",
            "Advanced AI generation",
            "All export formats",
            "Unlimited templates",
            "Custom branding",
            "E-signatures",
            "Multi-currency",
            "Tax auto-calculation",
            "Priority email support",
        ],
        excluded: [
            "API access",
            "Team collaboration",
        ]
    },
    {
        name: "Enterprise",
        price: { monthly: "Custom", yearly: "Custom" },
        priceNote: "contact us",
        desc: "Everything in Pro for your team, plus:",
        cta: "Talk to Sales",
        ctaStyle: "bg-white text-[var(--landing-dark)] border border-stone-200 hover:bg-stone-50",
        features: [
            "Unlimited everything",
            "Full API access",
            "Team collaboration",
            "Shared templates & snippets",
            "Usage dashboards",
            "SSO & SCIM",
            "Custom integrations",
            "Dedicated account manager",
            "SLA guarantee",
            "SOC 2 Type II compliant",
        ],
        excluded: []
    }
]

const faqs = [
    {
        q: "Is there a free trial?",
        a: "Yes! Start with our Starter plan for free, or try Pro with a 14-day free trial. No credit card required."
    },
    {
        q: "Can I change or cancel anytime?",
        a: "Absolutely. Upgrade, downgrade, or cancel your subscription at any time. No lock-in contracts."
    },
    {
        q: "Do you offer discounts for startups?",
        a: "Yes, we offer 50% off for startups with fewer than 10 employees. Contact our sales team for eligibility."
    },
    {
        q: "What payment methods do you accept?",
        a: "We accept all major credit cards, PayPal, and bank transfers for Enterprise plans."
    },
    {
        q: "Can I use Invo for my whole team?",
        a: "Yes! Our Enterprise plan includes team collaboration, shared templates, centralized billing, and admin controls."
    }
]

export default function PricingPage() {
    const [billing, setBilling] = useState<"monthly" | "yearly">("yearly")
    const [openFaq, setOpenFaq] = useState<number | null>(null)

    return (
        <LandingLayout>
            <div className="min-h-screen">
                {/* Hero */}
                <section className="pt-32 pb-16 px-6 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-tight text-[var(--landing-text-dark)] mb-6">
                            Pricing
                        </h1>
                        <p className="text-xl text-[var(--landing-text-muted)] max-w-xl mx-auto mb-10">
                            Start free. Upgrade when you need more power.
                        </p>

                        {/* Billing Toggle */}
                        <div className="inline-flex items-center gap-3 p-1.5 rounded-full bg-white border border-stone-200 shadow-sm">
                            <button
                                onClick={() => setBilling("monthly")}
                                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${billing === "monthly" ? 'bg-[var(--landing-dark)] text-white shadow-md' : 'text-[var(--landing-text-muted)]'}`}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setBilling("yearly")}
                                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${billing === "yearly" ? 'bg-[var(--landing-dark)] text-white shadow-md' : 'text-[var(--landing-text-muted)]'}`}
                            >
                                Yearly <span className="text-[var(--landing-amber)] ml-1">Save 20%</span>
                            </button>
                        </div>
                    </motion.div>
                </section>

                {/* Pricing Cards */}
                <section className="pb-24 px-6 sm:px-10">
                    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                        {plans.map((plan, i) => (
                            <motion.div
                                key={plan.name}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1, duration: 0.6 }}
                                className={`relative p-8 rounded-[2.5rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${plan.popular
                                    ? 'bg-[var(--landing-dark)] text-[var(--landing-cream)] border-[var(--landing-dark)] shadow-2xl scale-[1.02]'
                                    : 'bg-white border-stone-200'
                                    }`}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[var(--landing-amber)] text-white text-xs font-bold uppercase tracking-wider">
                                        Most Popular
                                    </div>
                                )}

                                <h3 className="text-lg font-bold mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-4xl font-display font-bold">
                                        {plan.price[billing]}
                                    </span>
                                    <span className={`text-sm ${plan.popular ? 'text-[var(--landing-text-dim)]' : 'text-[var(--landing-text-muted)]'}`}>
                                        {plan.priceNote}
                                    </span>
                                </div>
                                <p className={`text-sm mb-8 ${plan.popular ? 'text-[var(--landing-text-dim)]' : 'text-[var(--landing-text-muted)]'}`}>
                                    {plan.desc}
                                </p>

                                <Link
                                    href={plan.name === "Enterprise" ? "/contact-sales" : "/auth/register"}
                                    className={`block w-full text-center py-3.5 rounded-full font-bold text-sm transition-all duration-300 ${plan.ctaStyle}`}
                                >
                                    {plan.cta}
                                </Link>

                                <div className="mt-8 space-y-3">
                                    {plan.features.map((f) => (
                                        <div key={f} className="flex items-center gap-3">
                                            <Check size={16} className="text-green-500 shrink-0" />
                                            <span className="text-sm">{f}</span>
                                        </div>
                                    ))}
                                    {plan.excluded.map((f) => (
                                        <div key={f} className={`flex items-center gap-3 ${plan.popular ? 'text-[var(--landing-text-dim)]' : 'text-stone-300'}`}>
                                            <Minus size={16} className="shrink-0" />
                                            <span className="text-sm line-through">{f}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* FAQ */}
                <section className="py-24 px-6 sm:px-10 bg-white">
                    <div className="max-w-3xl mx-auto">
                        <motion.div {...fadeUp} className="text-center mb-16">
                            <h2 className="font-display text-4xl font-bold mb-4">Frequently asked questions</h2>
                        </motion.div>

                        <div className="space-y-3">
                            {faqs.map((faq, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.05 }}
                                    className="border border-stone-200 rounded-2xl overflow-hidden"
                                >
                                    <button
                                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                        className="w-full flex items-center justify-between p-6 text-left font-semibold hover:bg-stone-50 transition-colors"
                                    >
                                        {faq.q}
                                        <ChevronDown
                                            size={20}
                                            className={`transition-transform duration-300 shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    <motion.div
                                        initial={false}
                                        animate={{ height: openFaq === i ? "auto" : 0, opacity: openFaq === i ? 1 : 0 }}
                                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                        className="overflow-hidden"
                                    >
                                        <p className="px-6 pb-6 text-[var(--landing-text-muted)] leading-relaxed">
                                            {faq.a}
                                        </p>
                                    </motion.div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-24 px-6 sm:px-10">
                    <motion.div {...fadeUp} className="max-w-4xl mx-auto bg-[var(--landing-dark)] rounded-[3rem] p-12 sm:p-20 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-mesh-dark opacity-50" />
                        <h2 className="font-display text-4xl sm:text-5xl text-[var(--landing-cream)] mb-4 relative z-10">
                            Start <span className="text-[var(--landing-amber)] italic font-serif">generating</span>
                        </h2>
                        <p className="text-[var(--landing-text-dim)] text-lg mb-8 relative z-10 max-w-lg mx-auto">
                            Professional documents in seconds. Try free, no credit card required.
                        </p>
                        <Link
                            href="/auth/register"
                            className="group relative z-10 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[var(--landing-cream)] text-[var(--landing-dark)] font-bold text-lg hover:scale-105 transition-transform"
                        >
                            Get Started Free
                            <ArrowRight className="transition-transform group-hover:translate-x-1" size={20} />
                        </Link>
                    </motion.div>
                </section>
            </div>
        </LandingLayout>
    )
}

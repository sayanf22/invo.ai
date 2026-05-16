"use client"

import { motion } from "framer-motion"
import { Wand2, Clock, Share2, FileText, Zap, ArrowRight, CreditCard } from "lucide-react"

const features = [
    {
        title: "Prompt-to-Document",
        desc: "Describe your document in plain English. Clorefy generates a complete, compliant document with your business details pre-filled.",
        icon: FileText,
        className: "md:col-span-2 bg-[var(--landing-dark)] text-white shadow-2xl overflow-hidden relative"
    },
    {
        title: "Country-Compliant",
        desc: "Tax rules, mandatory fields, and legal requirements auto-applied based on your business location. No manual lookup required.",
        icon: Wand2,
        className: "md:col-span-1 bg-white border border-stone-100 shadow-xl"
    },
    {
        title: "5+ Hours Saved Monthly",
        desc: "Eliminate manual invoicing, proposal drafting, and compliance checking. One prompt replaces an afternoon of admin.",
        icon: Clock,
        className: "md:col-span-1 bg-white border border-stone-100 shadow-xl"
    },
    {
        title: "Send & Get Paid",
        desc: "Email documents to clients with a payment link attached. Export as PDF, DOCX, or image — one click.",
        icon: Share2,
        className: "md:col-span-2 bg-[var(--landing-cream-deep)] border border-stone-100 shadow-xl"
    },
    {
        title: "9+ Document Types",
        desc: "Invoices, contracts, proposals, quotations, NDAs, SOWs, purchase orders, receipts, and credit notes — all from one platform.",
        icon: FileText,
        className: "md:col-span-1 bg-white border border-stone-100 shadow-xl"
    },
    {
        title: "Integrated Payments",
        desc: "Accept payments via Razorpay, Cashfree, and Stripe directly from your documents. No separate payment tool needed.",
        icon: Zap,
        className: "md:col-span-2 bg-gradient-to-br from-[var(--landing-amber)] to-[var(--landing-amber-light)] text-white shadow-2xl"
    }
]

// Per-card directional offsets: [y, x]
// Cards slide in from slightly different directions for a natural bento feel
const cardOffsets: [number, number][] = [
    [50, -20],  // 0: Text-to-Document — from bottom-left
    [40,  20],  // 1: AI Formatting     — from bottom-right
    [40, -20],  // 2: Save Hours        — from bottom-left
    [50,  20],  // 3: Instant Sharing   — from bottom-right
    [40, -20],  // 4: Custom Templates  — from bottom-left
    [50,  20],  // 5: Lightning Fast    — from bottom-right
]

// Hoisted outside component so Framer Motion never sees new object references
const gridVariants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.11,
            delayChildren: 0.08,
        },
    },
}

// Uses `custom` prop (index) to pick directional offset
const cardVariants = {
    hidden: (i: number) => ({
        opacity: 0,
        y: cardOffsets[i][0],
        x: cardOffsets[i][1],
        scale: 0.95,
    }),
    visible: {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        transition: {
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
        },
    },
}

const headingVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
    },
}

const subVariants = {
    hidden: { opacity: 0, y: 18 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.75, delay: 0.13, ease: [0.22, 1, 0.36, 1] },
    },
}

export function FeaturesSection() {
    return (
        <section className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)]">
            <div className="max-w-7xl mx-auto">
                {/* Section heading */}
                <div className="text-center mb-12 sm:mb-24">
                    <motion.h2
                        variants={headingVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-60px" }}
                        className="font-display text-3xl sm:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-[0.95]"
                    >
                        Everything your business needs to <br />
                        <span className="text-[var(--landing-amber)] italic font-serif">get paid</span>
                    </motion.h2>
                    <motion.p
                        variants={subVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-60px" }}
                        className="text-base sm:text-xl text-[var(--landing-text-muted)] max-w-2xl mx-auto"
                    >
                        Generate compliant documents, collect payments, and save 5+ hours a month — from a single prompt.
                    </motion.p>
                </div>

                {/* Bento grid — parent triggers stagger, children inherit */}
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    variants={gridVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                >
                    {features.map((feat, i) => (
                        <motion.div
                            key={feat.title}
                            custom={i}
                            variants={cardVariants}
                            className={`rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 flex flex-col justify-between hover:-translate-y-2 hover:shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] transition-[transform,box-shadow] duration-300 cursor-default border-[2.5px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] ${feat.className.replace('shadow-xl', '').replace('shadow-2xl', '').replace('border border-stone-100', '')}`}
                        >
                            <div className="mb-4 sm:mb-8">
                                <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 ${feat.className.includes('text-white') ? 'bg-white/10 text-white' : 'bg-[var(--landing-cream)] text-[var(--landing-amber)]'}`}>
                                    <feat.icon size={22} className="sm:w-[26px] sm:h-[26px]" />
                                </div>
                                <h3 className="font-display text-xl sm:text-3xl font-bold mb-2 sm:mb-4">{feat.title}</h3>
                                <p className={`text-sm sm:text-lg leading-relaxed ${feat.className.includes('text-white') ? 'text-white/80' : 'text-[var(--landing-text-muted)]'}`}>
                                    {feat.desc}
                                </p>
                            </div>

                            {i === 0 && (
                                <div className="mt-4 flex gap-2">
                                    <div className="h-2 w-12 bg-white/20 rounded-full animate-pulse" />
                                    <div className="h-2 w-8 bg-white/20 rounded-full animate-pulse delay-75" />
                                    <div className="h-2 w-16 bg-white/20 rounded-full animate-pulse delay-150" />
                                </div>
                            )}
                            {i === 3 && (
                                <div className="mt-4 flex items-center gap-2 text-[var(--landing-amber)] font-bold text-sm">
                                    View Integration <ArrowRight size={14} />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}

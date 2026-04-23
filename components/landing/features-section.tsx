"use client"

import { motion } from "framer-motion"
import { Wand2, Clock, Share2, FileText, Zap, ArrowRight, CreditCard } from "lucide-react"

const features = [
    {
        title: "Text-to-Document",
        desc: "Type naturally. Our AI captures every detail and turns it into a structured document instantly.",
        icon: FileText,
        className: "md:col-span-2 bg-[var(--landing-dark)] text-white shadow-2xl overflow-hidden relative"
    },
    {
        title: "AI Formatting",
        desc: "Automatically formats your raw thoughts into professional reports, emails, or notes.",
        icon: Wand2,
        className: "md:col-span-1 bg-white border border-stone-100 shadow-xl"
    },
    {
        title: "Save Hours",
        desc: "Skip the drafting phase. Go from idea to finished document in seconds, not hours.",
        icon: Clock,
        className: "md:col-span-1 bg-white border border-stone-100 shadow-xl"
    },
    {
        title: "Instant Sharing",
        desc: "Share links, export PDFs, or send directly to email with one click.",
        icon: Share2,
        className: "md:col-span-2 bg-[var(--landing-cream-deep)] border border-stone-100 shadow-xl"
    },
    {
        title: "Custom Templates",
        desc: "Create templates for your specific needs—meeting notes, daily standups, or client updates.",
        icon: FileText,
        className: "md:col-span-1 bg-white border border-stone-100 shadow-xl"
    },
    {
        title: "Payments Integration",
        desc: "Seamlessly accept payments via Razorpay, Cashfree, and Stripe directly from your generated documents.",
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
                        Everything you need to <br />
                        <span className="text-[var(--landing-amber)] italic font-serif">flow</span>
                    </motion.h2>
                    <motion.p
                        variants={subVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-60px" }}
                        className="text-base sm:text-xl text-[var(--landing-text-muted)] max-w-2xl mx-auto"
                    >
                        Powerful tools wrapped in a simple, intuitive interface. No complex setup required.
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
                            className={`rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 flex flex-col justify-between hover:-translate-y-2 hover:shadow-2xl transition-[transform,box-shadow] duration-300 cursor-default ${feat.className}`}
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

"use client"

import { motion } from "framer-motion"
import { Wand2, Clock, Share2, FileText, Zap, ArrowRight } from "lucide-react"

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
        title: "Lightning Fast",
        desc: "From simple prompt to finished document in under 30 seconds.",
        icon: Zap,
        className: "md:col-span-2 bg-gradient-to-br from-[var(--landing-amber)] to-[var(--landing-amber-light)] text-white shadow-2xl"
    }
]

export function FeaturesSection() {
    return (
        <section className="py-32 px-6 sm:px-10 bg-[var(--landing-cream)]">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-24">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="font-display text-5xl sm:text-7xl font-bold mb-6 leading-[0.9]"
                    >
                        Everything you need to <br />
                        <span className="text-[var(--landing-amber)] italic font-serif">flow</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-xl text-[var(--landing-text-muted)] max-w-2xl mx-auto"
                    >
                        Powerful tools wrapped in a simple, intuitive interface. No complex setup required.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((feat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            className={`rounded-[2.5rem] p-10 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 ${feat.className}`}
                        >
                            <div className="mb-8">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 
                                    ${feat.className.includes('text-white') ? 'bg-white/10 text-white' : 'bg-[var(--landing-cream)] text-[var(--landing-amber)]'}`}>
                                    <feat.icon size={26} />
                                </div>
                                <h3 className="font-display text-3xl font-bold mb-4">{feat.title}</h3>
                                <p className={`text-lg leading-relaxed ${feat.className.includes('text-white') ? 'text-white/80' : 'text-[var(--landing-text-muted)]'}`}>
                                    {feat.desc}
                                </p>
                            </div>

                            {/* Decorative element for Voice-to-Document */}
                            {i === 0 && (
                                <div className="mt-4 flex gap-2">
                                    <div className="h-2 w-12 bg-white/20 rounded-full animate-pulse" />
                                    <div className="h-2 w-8 bg-white/20 rounded-full animate-pulse delay-75" />
                                    <div className="h-2 w-16 bg-white/20 rounded-full animate-pulse delay-150" />
                                </div>
                            )}
                            {/* Decorative element for Instant Sharing */}
                            {i === 3 && (
                                <div className="mt-4 flex items-center gap-2 text-[var(--landing-amber)] font-bold text-sm">
                                    View Integration <ArrowRight size={14} />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import { Briefcase, Code2, GraduationCap, Bot, Palette } from "lucide-react"

const personas = [
    { id: "freelancers", label: "Freelancers", icon: Briefcase, title: "Get paid faster", desc: "Turn a rough outline into a professional invoice and send it before you leave the meeting." },
    { id: "developers", label: "Developers", icon: Code2, title: "Docs that write themselves", desc: "Describe your project scope, deliverables, and terms. Clorefy generates polished proposals and contracts instantly." },
    { id: "students", label: "Students", icon: GraduationCap, title: "Professional docs, zero stress", desc: "Create internship contracts, project proposals, and freelance invoices. Free tier covers everything you need to start." },
    { id: "agents", label: "Agents", icon: Bot, title: "Close deals with speed", desc: "Generate client proposals, service agreements, and quotations in seconds. Spend less time on paperwork, more time closing." },
    { id: "creatives", label: "Creatives", icon: Palette, title: "Capture fleeting ideas", desc: "Don't let inspiration slip away. Record your creative bursts and get organized project briefs instantly." },
]

export function PersonaTabs() {
    const [active, setActive] = useState(0)

    return (
        <section className="py-24 px-6 sm:px-10 bg-[var(--landing-cream)]">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="font-display text-3xl sm:text-4xl lg:text-6xl font-bold mb-4"
                    >
                        Made for <span className="text-[var(--landing-amber)] italic font-serif">you</span>
                    </motion.h2>
                </div>

                <div className="flex flex-col lg:flex-row gap-12 items-center">
                    {/* Tabs */}
                    <div className="w-full lg:w-1/3 flex flex-col gap-2">
                        {personas.map((persona, i) => (
                            <button
                                key={persona.id}
                                onClick={() => setActive(i)}
                                className={`group flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left ${active === i ? 'bg-white shadow-lg scale-105' : 'hover:bg-white/50'}`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${active === i ? 'bg-[var(--landing-amber)] text-white' : 'bg-stone-100 text-[var(--landing-text-muted)]'}`}>
                                    <persona.icon size={20} />
                                </div>
                                <span className={`font-bold text-lg ${active === i ? 'text-[var(--landing-text-dark)]' : 'text-[var(--landing-text-muted)]'}`}>
                                    {persona.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="w-full lg:w-2/3 min-h-[400px] relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={active}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="h-full bg-[var(--landing-dark)] rounded-[3rem] p-10 sm:p-16 flex flex-col justify-center text-[var(--landing-cream)] relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(198,122,60,0.15)_0%,transparent_70%)] pointer-events-none" />

                                <h3 className="font-display text-2xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 relative z-10">
                                    {personas[active].title}
                                </h3>
                                <p className="text-xl sm:text-2xl text-[var(--landing-text-dim)] leading-relaxed relative z-10">
                                    {personas[active].desc}
                                </p>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </section>
    )
}

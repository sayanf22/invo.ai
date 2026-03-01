"use client"

import { useScrollReveal } from "@/hooks/use-scroll-reveal"
import { MessageSquare, Sparkles, Download, ArrowRight } from "lucide-react"

const steps = [
    {
        number: "01",
        icon: MessageSquare,
        title: "Describe what you need",
        description:
            "Just type naturally: \"Create an invoice for $5,000 to my US client for web development.\" Invo.ai understands your intent.",
        accent: "bg-blue-500/10 text-blue-600 border-blue-200",
    },
    {
        number: "02",
        icon: Sparkles,
        title: "AI generates your document",
        description:
            "Our AI creates a fully compliant document using your business profile, local tax rules, and the right legal clauses — all validated automatically.",
        accent: "bg-[var(--landing-amber)]/10 text-[var(--landing-amber)] border-[var(--landing-amber)]/20",
    },
    {
        number: "03",
        icon: Download,
        title: "Edit & export",
        description:
            "Review your document in the live editor, make any changes you want, then export as PDF. Every field is editable — you're always in control.",
        accent: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    },
]

export function HowItWorks() {
    const { ref, revealed } = useScrollReveal()

    return (
        <section id="how-it-works" ref={ref} className="section-padding px-6 bg-[var(--landing-cream)]">
            <div className="max-w-[1400px] mx-auto">
                {/* Heading */}
                <div
                    className={`flex flex-col md:flex-row md:items-end justify-between mb-24 transition-all duration-700 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                        }`}
                >
                    <div className="max-w-3xl">
                        <h2 className="font-display text-6xl sm:text-7xl md:text-8xl tracking-tight text-[var(--landing-text-dark)] mb-6 leading-[0.9]">
                            How it works
                        </h2>
                        <p className="text-xl sm:text-2xl text-[var(--landing-text-muted)] leading-relaxed">
                            From description to compliant document in three simple steps.
                        </p>
                    </div>
                    <div className="hidden md:block pb-2">
                        <div className="w-24 h-24 rounded-full bg-[var(--landing-text-dark)] flex items-center justify-center text-[var(--landing-cream)] animate-spin-slow">
                            <ArrowRight size={32} className="-rotate-45" />
                        </div>
                    </div>
                </div>

                {/* Steps */}
                <div
                    className={`grid grid-cols-1 md:grid-cols-3 gap-8 stagger-children ${revealed ? "revealed" : ""
                        }`}
                >
                    {steps.map((step) => (
                        <div
                            key={step.number}
                            className="relative p-12 sm:p-14 rounded-[3rem] bg-white border border-[var(--landing-cream-deep)] shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 group overflow-hidden"
                        >
                            {/* Step number watermark */}
                            <span className="text-[12rem] font-display font-bold text-[var(--landing-cream)]/80 absolute -top-10 -right-10 select-none leading-none z-0 group-hover:text-[var(--landing-cream)]/50 transition-colors">
                                {step.number}
                            </span>

                            {/* Icon */}
                            <div
                                className={`relative z-10 inline-flex items-center justify-center w-20 h-20 rounded-[2rem] ${step.accent} border mb-10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 ease-out`}
                            >
                                <step.icon size={32} strokeWidth={1.5} />
                            </div>

                            {/* Content */}
                            <h3 className="relative z-10 text-3xl font-bold text-[var(--landing-text-dark)] mb-5 tracking-tight group-hover:translate-x-2 transition-transform duration-300">
                                {step.title}
                            </h3>
                            <p className="relative z-10 text-lg text-[var(--landing-text-muted)] leading-relaxed">
                                {step.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

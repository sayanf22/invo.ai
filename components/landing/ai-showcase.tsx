"use client"

import { motion } from "framer-motion"
import { Type, Sparkles, FileCheck, ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"

export function AIShowcase() {
    const [step, setStep] = useState(0)

    // Smooth 6s cycle for readability
    useEffect(() => {
        const timer = setInterval(() => {
            setStep((prev) => (prev + 1) % 3)
        }, 6000)
        return () => clearInterval(timer)
    }, [])

    return (
        <section className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)] overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-20 items-center">
                    {/* Left Content - Text Focused */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 text-sm font-semibold mb-8 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-[var(--landing-amber)] animate-pulse" />
                            How it works
                        </div>
                        <h2 className="font-display text-3xl sm:text-5xl lg:text-7xl font-bold mb-6 sm:mb-8 leading-[0.95]">
                            From messy thought <br />
                            to <span className="text-[var(--landing-amber)] italic font-serif">masterpiece</span>
                        </h2>
                        <p className="text-xl text-[var(--landing-text-muted)] mb-12 leading-relaxed max-w-lg">
                            Stop worrying about structure or format. Just type your rough ideas. Clorefy understands context and formats everything perfectly.
                        </p>

                        <div className="space-y-8">
                            {[
                                { title: "Describe", desc: "Type your request in plain English. No rigid templates.", icon: Type },
                                { title: "Refine", desc: "Our AI structures your data instantly.", icon: Sparkles },
                                { title: "Done", desc: "Export professional PDFs or share seamlessly.", icon: FileCheck }
                            ].map((item, i) => (
                                <div key={i} className={`flex gap-6 group transition-opacity duration-300 ${step === i ? 'opacity-100' : 'opacity-40'}`}>
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all duration-300 ${step === i ? 'bg-[var(--landing-amber)] text-white scale-110 shadow-lg shadow-orange-200' : 'bg-white border border-stone-100 text-stone-400'}`}>
                                        <item.icon size={24} />
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-xl mb-1 transition-colors ${step === i ? 'text-[var(--landing-text-dark)]' : 'text-stone-400'}`}>{item.title}</h4>
                                        <p className="text-[var(--landing-text-muted)] leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Interactive Visual - Text Input Flow */}
                    <div className="relative perspective-1000">
                        {/* Ambient Glow */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-[var(--landing-amber)]/20 to-purple-500/10 blur-[100px] rounded-full" />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="relative bg-white/60 backdrop-blur-xl rounded-[3rem] p-8 sm:p-12 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] border border-white min-h-[600px] flex flex-col will-change-transform"
                        >
                            {/* Steps Indicator */}
                            <div className="flex justify-center mb-10">
                                <div className="flex items-center gap-3 p-1.5 bg-stone-100/80 rounded-full border border-stone-200/50">
                                    {['Prompt', 'Generating', 'Result'].map((label, i) => (
                                        <div
                                            key={label}
                                            className={`px-5 py-2 rounded-full text-xs font-bold transition-all duration-500 ${step === i ? 'bg-white shadow-sm text-black' : 'text-stone-400'}`}
                                        >
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex-1 flex items-center justify-center relative w-full">
                                {/* Step 0: Input Prompt */}
                                {step === 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="w-full"
                                    >
                                        <div className="bg-white rounded-3xl p-6 shadow-xl border border-stone-100 relative overflow-hidden">
                                            <div className="flex gap-4 mb-4">
                                                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-400">U</div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="font-serif text-xl sm:text-2xl text-[var(--landing-text-dark)] leading-relaxed">
                                                        &ldquo;Need a quotation for a web development project, include hosting and maintenance for <span className="text-[var(--landing-amber)] bg-orange-50 px-1 rounded">12 months</span>...&rdquo;
                                                    </div>
                                                    <div className="h-4 w-2 bg-[var(--landing-amber)] animate-pulse" />
                                                </div>
                                            </div>
                                            <div className="absolute bottom-4 right-4">
                                                <div className="w-10 h-10 rounded-full bg-[var(--landing-dark)] flex items-center justify-center text-white shadow-lg">
                                                    <ArrowRight size={18} />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 1: Processing */}
                                {step === 1 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="text-center w-full"
                                    >
                                        <div className="relative w-24 h-24 mx-auto mb-8">
                                            <div className="absolute inset-0 border-4 border-[var(--landing-amber)]/30 rounded-full" />
                                            <div className="absolute inset-0 border-4 border-t-[var(--landing-amber)] rounded-full animate-spin" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Sparkles className="text-[var(--landing-amber)] animate-pulse" size={32} />
                                            </div>
                                        </div>
                                        <p className="font-display text-3xl font-bold text-[var(--landing-text-dark)] mb-2">Analyzing...</p>
                                        <p className="text-stone-400">Extracting legal clauses</p>
                                    </motion.div>
                                )}

                                {/* Step 2: Result */}
                                {step === 2 && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="w-full bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden transform rotate-1 transition-transform hover:rotate-0"
                                    >
                                        {/* Doc Header */}
                                        <div className="h-16 border-b border-stone-100 flex items-center px-6 justify-between bg-stone-50/50">
                                            <div className="font-bold text-sm text-[var(--landing-text-dark)]">QUOTATION</div>
                                            <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">Draft</div>
                                        </div>
                                        {/* Doc Content */}
                                        <div className="p-8 space-y-6">
                                            <div className="space-y-2">
                                                <div className="h-4 w-3/4 bg-stone-100 rounded" />
                                                <div className="h-4 w-full bg-stone-100 rounded" />
                                                <div className="h-4 w-5/6 bg-stone-100 rounded" />
                                            </div>

                                            <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                                                <div className="text-xs font-bold text-[var(--landing-amber)] uppercase tracking-wider mb-2">Non-Compete Clause</div>
                                                <div className="h-3 w-full bg-[var(--landing-amber)]/10 rounded mb-2" />
                                                <div className="h-3 w-2/3 bg-[var(--landing-amber)]/10 rounded" />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="h-4 w-full bg-stone-100 rounded" />
                                                <div className="h-4 w-4/5 bg-stone-100 rounded" />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    )
}

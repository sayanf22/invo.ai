"use client"

import { motion, AnimatePresence } from "framer-motion"
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
                                <AnimatePresence mode="wait">
                                {/* Step 0: Input Prompt */}
                                {step === 0 && (
                                    <motion.div
                                        key="step-prompt"
                                        initial={{ opacity: 0, y: 20, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -20, scale: 0.97 }}
                                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                        className="w-full"
                                    >
                                        <div className="bg-white rounded-3xl p-6 shadow-xl border border-stone-100 relative overflow-hidden">
                                            <div className="flex gap-4 mb-4">
                                                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-400">U</div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="font-serif text-xl sm:text-2xl text-[var(--landing-text-dark)] leading-relaxed">
                                                        &ldquo;Create an invoice for Acme Corp, $5,000 for web development, include <span className="text-[var(--landing-amber)] bg-orange-50 px-1 rounded">hosting and maintenance</span>...&rdquo;
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
                                        key="step-generating"
                                        initial={{ opacity: 0, y: 20, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -20, scale: 0.97 }}
                                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                        className="text-center w-full"
                                    >
                                        <div className="relative w-24 h-24 mx-auto mb-8">
                                            <div className="absolute inset-0 border-4 border-[var(--landing-amber)]/30 rounded-full" />
                                            <div className="absolute inset-0 border-4 border-t-[var(--landing-amber)] rounded-full animate-spin" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Sparkles className="text-[var(--landing-amber)] animate-pulse" size={32} />
                                            </div>
                                        </div>
                                        <p className="font-display text-3xl font-bold text-[var(--landing-text-dark)] mb-2">Generating...</p>
                                        <p className="text-stone-400">Building your invoice with compliance</p>
                                    </motion.div>
                                )}

                                {/* Step 2: Result — scaled-down invoice preview that fits the container */}
                                {step === 2 && (
                                    <motion.div
                                        key="step-result"
                                        initial={{ opacity: 0, y: 20, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -20, scale: 0.97 }}
                                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                        className="w-full"
                                    >
                                        {/* Outer wrapper clips the scaled content to the right height */}
                                        <div className="w-full overflow-hidden rounded-2xl shadow-2xl" style={{ border: "1px solid #e8e4de" }}>
                                            {/* Scale the invoice down so it fits without scrolling */}
                                            <div style={{ transform: "scale(0.72)", transformOrigin: "top center", width: "138.9%", marginLeft: "-19.4%" }}>
                                                <div className="bg-white relative">
                                                    {/* Top accent bar */}
                                                    <div className="h-2 w-full" style={{ backgroundColor: "#e07b39" }} />
                                                    {/* Corner accent */}
                                                    <div className="absolute top-0 right-0 w-28 h-16 rounded-bl-[2rem]" style={{ backgroundColor: "#fde8d8" }} />

                                                    <div className="relative p-6">
                                                        {/* Header */}
                                                        <div className="flex justify-between items-start mb-5">
                                                            <div>
                                                                <h3 className="text-2xl font-bold tracking-[2px]" style={{ color: "#e07b39" }}>INVOICE</h3>
                                                                <p className="text-[11px] text-stone-400 mt-1">INV-2026-0087</p>
                                                            </div>
                                                            <div className="px-3 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#fde8d8", color: "#e07b39" }}>DRAFT</div>
                                                        </div>

                                                        {/* Date strip */}
                                                        <div className="flex gap-4 mb-5 p-3 rounded-lg" style={{ backgroundColor: "#faf8f5" }}>
                                                            {[
                                                                { label: "Issue Date", value: "Apr 12, 2026" },
                                                                { label: "Due Date", value: "May 12, 2026" },
                                                                { label: "Terms", value: "Net 30" },
                                                            ].map(d => (
                                                                <div key={d.label} className="flex-1">
                                                                    <p className="text-[9px] font-bold text-stone-400 uppercase tracking-[1px] mb-0.5">{d.label}</p>
                                                                    <p className="text-[12px] font-semibold text-stone-800">{d.value}</p>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* From / To */}
                                                        <div className="grid grid-cols-2 gap-4 mb-5">
                                                            <div>
                                                                <p className="text-[9px] font-bold uppercase tracking-[1px] mb-1.5 pb-1" style={{ color: "#e07b39", borderBottom: "2px solid #fde8d8" }}>From</p>
                                                                <p className="text-[12px] font-semibold text-stone-800">TechFlow Studio</p>
                                                                <p className="text-[10px] text-stone-400 leading-relaxed">Bangalore, India<br/>hello@techflow.io<br/>GSTIN: 29AABCT1234F1ZP</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-bold uppercase tracking-[1px] mb-1.5 pb-1" style={{ color: "#e07b39", borderBottom: "2px solid #fde8d8" }}>Bill To</p>
                                                                <p className="text-[12px] font-semibold text-stone-800">Acme Corporation</p>
                                                                <p className="text-[10px] text-stone-400 leading-relaxed">San Francisco, CA<br/>billing@acme.com</p>
                                                            </div>
                                                        </div>

                                                        {/* Items table */}
                                                        <div className="mb-4">
                                                            <div className="grid grid-cols-12 gap-1 text-[10px] font-bold text-white uppercase tracking-wider py-2 px-2.5 rounded-md" style={{ backgroundColor: "#e07b39" }}>
                                                                <div className="col-span-5">Description</div>
                                                                <div className="col-span-2 text-center">Qty</div>
                                                                <div className="col-span-2 text-right">Rate</div>
                                                                <div className="col-span-3 text-right">Amount</div>
                                                            </div>
                                                            {[
                                                                { desc: "Web Development", qty: "1", rate: "₹3,500", amt: "₹3,500" },
                                                                { desc: "Hosting (12 mo)", qty: "12", rate: "₹50", amt: "₹600" },
                                                                { desc: "Maintenance", qty: "1", rate: "₹900", amt: "₹900" },
                                                            ].map((item, i) => (
                                                                <div key={i} className={`grid grid-cols-12 gap-1 text-[11px] py-2 px-2.5 ${i % 2 === 1 ? "bg-[#faf8f5]" : ""}`} style={{ borderBottom: "1px solid #f5f3f0" }}>
                                                                    <div className="col-span-5 text-stone-700 font-medium">{item.desc}</div>
                                                                    <div className="col-span-2 text-center text-stone-400">{item.qty}</div>
                                                                    <div className="col-span-2 text-right text-stone-400">{item.rate}</div>
                                                                    <div className="col-span-3 text-right text-stone-800 font-semibold">{item.amt}</div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Totals */}
                                                        <div className="flex justify-end mb-4">
                                                            <div className="w-44 space-y-1 text-[11px]">
                                                                <div className="flex justify-between text-stone-400">
                                                                    <span>Subtotal</span><span className="font-medium text-stone-600">₹5,000</span>
                                                                </div>
                                                                <div className="flex justify-between text-stone-400">
                                                                    <span>GST (18%)</span><span className="font-medium text-stone-600">₹900</span>
                                                                </div>
                                                                <div className="flex justify-between pt-2 mt-1 text-[13px] font-bold text-stone-900" style={{ borderTop: "2px solid #e07b39" }}>
                                                                    <span>Total</span><span style={{ color: "#e07b39" }}>₹5,900</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Footer */}
                                                        <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid #f0ece6" }}>
                                                            <p className="text-[9px] text-stone-300">Generated by Clorefy</p>
                                                            <div className="flex items-center gap-1">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                                <span className="text-[9px] font-semibold text-emerald-600">India GST Compliant</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    )
}

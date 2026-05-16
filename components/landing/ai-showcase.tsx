"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Type, FileCheck, ArrowRight, Wand2, Check } from "lucide-react"
import { useState, useEffect } from "react"

const STEPS = [
    { title: "Describe", desc: "Tell Clorefy what you need — client, amount, terms. No forms to fill.", icon: Type },
    { title: "Comply",   desc: "Tax rules, mandatory fields, and legal requirements auto-applied for your country.", icon: Wand2 },
    { title: "Deliver",  desc: "Export as PDF, attach a payment link, and send — in under 30 seconds.", icon: FileCheck },
] as const

export function AIShowcase() {
    const [step, setStep] = useState(0)
    // Increments when user manually clicks a step — used to reset the auto-advance timer
    const [userNonce, setUserNonce] = useState(0)

    // Smooth 6s cycle. Re-runs (resetting the countdown) whenever the user clicks a step.
    useEffect(() => {
        const timer = setInterval(() => {
            setStep((prev) => (prev + 1) % 3)
        }, 6000)
        return () => clearInterval(timer)
    }, [userNonce])

    const goTo = (i: number) => {
        setStep(i)
        setUserNonce((n) => n + 1)
    }

    return (
        <section className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)] overflow-hidden relative">
            {/* Subtle ambient gradient — adds depth without colored fill */}
            <div
                className="absolute inset-0 pointer-events-none opacity-60"
                style={{
                    background:
                        "radial-gradient(ellipse 80% 60% at 20% 30%, rgba(224,123,57,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 85% 70%, rgba(26,26,26,0.04) 0%, transparent 60%)",
                }}
            />

            <div className="max-w-7xl mx-auto relative">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 sm:gap-16 xl:gap-20 items-center">
                    {/* ── Left content ─────────────────────────────────────────── */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        {/* "How it works" badge — now with stronger contrast and dot */}
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--landing-dark)] text-white text-[12px] font-semibold mb-8 shadow-sm">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--landing-amber)] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--landing-amber)]"></span>
                            </span>
                            How it works
                        </div>

                        <h2 className="font-display text-3xl sm:text-5xl lg:text-7xl font-bold mb-6 sm:mb-8 leading-[0.95] text-[var(--landing-text-dark)]"
                            style={{ textShadow: "2px 2px 0px rgba(26,26,26,0.06), 0 6px 20px rgba(26,26,26,0.04)" }}
                        >
                            From prompt to <br />
                            <span
                                className="italic font-serif"
                                style={{
                                    // Gradient text with drop-shadow (same technique as hero)
                                    backgroundImage: "linear-gradient(120deg, #d97757 0%, #e07b39 45%, #b8421c 100%)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    backgroundClip: "text",
                                    filter: "drop-shadow(2px 2px 0px rgba(26,26,26,0.08))",
                                }}
                            >
                                compliant document
                            </span>
                        </h2>

                        <p className="text-lg sm:text-xl text-[var(--landing-text-muted)] mb-10 sm:mb-12 leading-relaxed max-w-lg">
                            Describe what you need in plain English. Clorefy applies your business profile, checks country-specific compliance rules, and delivers a professionally formatted document.
                        </p>

                        {/* Steps — higher contrast, progress indicator, number badge */}
                        <div className="space-y-3 sm:space-y-4">
                            {STEPS.map((item, i) => {
                                const isActive = step === i
                                const isPast = step > i
                                const Icon = item.icon
                                return (
                                    <motion.button
                                        key={i}
                                        type="button"
                                        onClick={() => goTo(i)}
                                        aria-pressed={isActive}
                                        aria-label={`Show step ${i + 1}: ${item.title}`}
                                        animate={{
                                            scale: isActive ? 1 : 0.985,
                                        }}
                                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                        className={`group relative w-full text-left flex gap-4 sm:gap-5 p-4 sm:p-5 rounded-2xl border transition-all duration-500 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-amber)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--landing-cream)] ${
                                            isActive
                                                ? "bg-white border-[var(--landing-dark)] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]"
                                                : "bg-white/40 border-stone-200/60 hover:bg-white/70 hover:border-stone-300"
                                        }`}
                                    >
                                        {/* Icon tile */}
                                        <div
                                            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 ${
                                                isActive
                                                    ? "bg-[var(--landing-dark)] text-white shadow-md"
                                                    : isPast
                                                        ? "bg-[var(--landing-amber)]/15 text-[var(--landing-amber)] border border-[var(--landing-amber)]/20"
                                                        : "bg-stone-100 text-stone-500 border border-stone-200"
                                            }`}
                                        >
                                            {isPast ? <Check size={22} strokeWidth={2.5} /> : <Icon size={20} />}
                                        </div>

                                        {/* Text */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[11px] font-bold tabular-nums tracking-wider uppercase transition-colors duration-500 ${isActive ? "text-[var(--landing-amber)]" : "text-stone-400"}`}>
                                                    Step 0{i + 1}
                                                </span>
                                                {isActive && (
                                                    <motion.span
                                                        layoutId="active-dot"
                                                        className="w-1 h-1 rounded-full bg-[var(--landing-amber)]"
                                                    />
                                                )}
                                            </div>
                                            <h4 className={`font-bold text-lg sm:text-xl mb-0.5 transition-colors duration-500 ${
                                                isActive ? "text-[var(--landing-text-dark)]" : "text-stone-600"
                                            }`}>
                                                {item.title}
                                            </h4>
                                            <p className={`text-sm sm:text-base leading-relaxed transition-colors duration-500 ${
                                                isActive ? "text-[var(--landing-text-muted)]" : "text-stone-400"
                                            }`}>
                                                {item.desc}
                                            </p>
                                        </div>

                                        {/* Progress rail on the left of active card */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="active-rail"
                                                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[var(--landing-amber)]"
                                                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                            />
                                        )}
                                    </motion.button>
                                )
                            })}
                        </div>
                    </motion.div>

                    {/* ── Right: device mockup ─────────────────────────────────── */}
                    <div className="relative perspective-1000">
                        {/* Ambient glow — softer, matches brand */}
                        <div
                            className="absolute -inset-8 pointer-events-none opacity-70"
                            style={{
                                background:
                                    "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(224,123,57,0.15) 0%, transparent 70%)",
                                filter: "blur(60px)",
                            }}
                        />

                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ layout: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }}
                            className="relative bg-white rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 border-[3px] border-[var(--landing-dark)] shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] min-h-[560px] sm:min-h-[620px] flex flex-col will-change-transform overflow-hidden"
                        >
                            {/* Top-right window dots for that "app" feel */}
                            <div className="absolute top-5 right-6 flex items-center gap-1.5 opacity-40">
                                <div className="w-2 h-2 rounded-full bg-stone-300" />
                                <div className="w-2 h-2 rounded-full bg-stone-300" />
                                <div className="w-2 h-2 rounded-full bg-stone-300" />
                            </div>

                            {/* Step pills — stronger contrast, dark bg inactive */}
                            <div className="flex justify-center mb-8 sm:mb-10">
                                <div className="flex items-center gap-1 p-1 bg-[var(--landing-dark)] rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]">
                                    {["Prompt", "Generating", "Result"].map((label, i) => {
                                        const isActive = step === i
                                        return (
                                            <button
                                                key={label}
                                                type="button"
                                                onClick={() => goTo(i)}
                                                aria-pressed={isActive}
                                                aria-label={`Show ${label} step`}
                                                className="relative cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-amber)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--landing-dark)]"
                                            >
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="active-pill"
                                                        className="absolute inset-0 bg-white rounded-full"
                                                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                                    />
                                                )}
                                                <div
                                                    className={`relative px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold transition-colors duration-300 ${
                                                        isActive ? "text-[var(--landing-dark)]" : "text-white/60 hover:text-white/90"
                                                    }`}
                                                >
                                                    {label}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Auto-advance progress bar */}
                            <div className="absolute top-0 left-0 right-0 h-[3px] bg-stone-100">
                                <motion.div
                                    key={step}
                                    initial={{ width: "0%" }}
                                    animate={{ width: "100%" }}
                                    transition={{ duration: 6, ease: "linear" }}
                                    className="h-full bg-[var(--landing-amber)]"
                                />
                            </div>

                            <div className="flex-1 flex items-center justify-center relative w-full">
                                <AnimatePresence mode="wait">
                                    {/* Step 0: Prompt */}
                                    {step === 0 && (
                                        <motion.div
                                            key="step-prompt"
                                            initial={{ opacity: 0, y: 20, scale: 0.97 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -20, scale: 0.97 }}
                                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                            className="w-full"
                                        >
                                            <div className="bg-[#faf8f5] rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 border-2 border-[var(--landing-dark)]/10 shadow-sm relative overflow-hidden">
                                                <div className="flex gap-3 sm:gap-4 mb-4">
                                                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--landing-dark)] text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">U</div>
                                                    <div className="flex-1 space-y-2 min-w-0">
                                                        <div className="font-serif text-lg sm:text-2xl text-[var(--landing-text-dark)] leading-relaxed">
                                                            &ldquo;Create an invoice for Acme Corp, $5,000 for web development, include{" "}
                                                            <span className="relative inline-block">
                                                                <span className="relative z-10 text-[var(--landing-amber)] font-semibold">hosting and maintenance</span>
                                                                <span className="absolute bottom-0.5 left-0 right-0 h-2 bg-[var(--landing-amber)]/15 rounded-sm -z-0" />
                                                            </span>
                                                            ...&rdquo;
                                                        </div>
                                                        <div className="h-4 w-[2px] bg-[var(--landing-amber)] animate-pulse" />
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-3 border-t border-stone-200/60">
                                                    <span className="text-[11px] font-medium text-stone-400">Press Enter to generate</span>
                                                    <div className="w-9 h-9 rounded-full bg-[var(--landing-dark)] flex items-center justify-center text-white shadow-md">
                                                        <ArrowRight size={16} />
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Step 1: Generating */}
                                    {step === 1 && (
                                        <motion.div
                                            key="step-generating"
                                            initial={{ opacity: 0, y: 20, scale: 0.97 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -20, scale: 0.97 }}
                                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                            className="text-center w-full"
                                        >
                                            {/* Spinner with stronger contrast */}
                                            <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6 sm:mb-8">
                                                <div className="absolute inset-0 rounded-full border-[3px] border-stone-200" />
                                                <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[var(--landing-amber)] border-r-[var(--landing-amber)] animate-spin" />
                                                <div className="absolute inset-3 rounded-full bg-[var(--landing-amber)]/8 flex items-center justify-center">
                                                    <Wand2 className="text-[var(--landing-amber)]" size={28} />
                                                </div>
                                            </div>
                                            <p className="font-display text-2xl sm:text-3xl font-bold text-[var(--landing-text-dark)] mb-1.5">Generating…</p>
                                            <p className="text-stone-500 text-sm sm:text-base">Building your invoice with compliance</p>

                                            {/* Progress pills showing what's happening */}
                                            <div className="mt-6 flex flex-col items-center gap-1.5 max-w-[280px] mx-auto">
                                                {[
                                                    "Reading business profile",
                                                    "Applying GST compliance",
                                                    "Formatting document",
                                                ].map((label, i) => (
                                                    <motion.div
                                                        key={label}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.8, duration: 0.3 }}
                                                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-stone-100 text-left"
                                                    >
                                                        <Check size={12} className="text-[var(--landing-amber)] shrink-0" strokeWidth={3} />
                                                        <span className="text-[11px] text-stone-600 font-medium">{label}</span>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Step 2: Result — full invoice preview */}
                                    {step === 2 && (
                                        <motion.div
                                            key="step-result"
                                            initial={{ opacity: 0, y: 20, scale: 0.97 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -20, scale: 0.97 }}
                                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                            className="w-full flex justify-center"
                                        >
                                            <div className="w-full max-w-[500px] h-[400px] sm:h-[460px] overflow-hidden rounded-2xl shadow-2xl relative bg-white" style={{ border: "1px solid #e8e4de" }}>
                                                <div className="absolute top-0 left-0" style={{ transform: "scale(0.72)", transformOrigin: "top center", width: "138.9%", marginLeft: "-19.4%" }}>
                                                    <div className="bg-white relative">
                                                        <div className="h-2 w-full" style={{ backgroundColor: "#e07b39" }} />
                                                        <div className="absolute top-0 right-0 w-28 h-16 rounded-bl-[2rem]" style={{ backgroundColor: "#fde8d8" }} />

                                                        <div className="relative p-6">
                                                            <div className="flex justify-between items-start mb-5">
                                                                <div>
                                                                    <h3 className="text-2xl font-bold tracking-[2px]" style={{ color: "#e07b39" }}>INVOICE</h3>
                                                                    <p className="text-[11px] text-stone-400 mt-1">INV-2026-0087</p>
                                                                </div>
                                                                <div className="px-3 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#fde8d8", color: "#e07b39" }}>DRAFT</div>
                                                            </div>

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

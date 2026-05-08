"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

const personas = [
    { id: "agencies", label: "Agencies", title: "Scale your client onboarding", desc: "Generate client proposals, service agreements, and quotations in seconds. Spend less time on paperwork, more time closing." },
    { id: "creators", label: "Creators", title: "Capture fleeting ideas", desc: "Don't let inspiration slip away. Record your creative bursts and get organized project briefs instantly." },
    { id: "developers", label: "Developers", title: "Docs that write themselves", desc: "Describe your project scope, deliverables, and terms. Clorefy generates polished proposals and contracts instantly." },
    { id: "lawyers", label: "Lawyers", title: "Precision legal drafting", desc: "The accuracy is astounding. It handles legal terminology perfectly and formats contracts exactly how you need them." },
    { id: "leaders", label: "Leaders", title: "Communicate with clarity", desc: "Turn raw meeting notes into structured investor updates and strategy memos automatically." },
    { id: "sales", label: "Sales", title: "Close deals with speed", desc: "Send customized proposals right after a discovery call while the lead is hot." },
    { id: "students", label: "Students", title: "Professional docs, zero stress", desc: "Create internship contracts, project proposals, and freelance invoices. Free tier covers everything." },
    { id: "teams", label: "Teams", title: "Unified document knowledge", desc: "Every generated document is stored, searchable, and reusable across your entire organization." },
]

export function PersonaTabs() {
    const [active, setActive] = useState(0)

    return (
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)]">
            <div className="max-w-[1400px] mx-auto bg-[var(--landing-dark)] rounded-[2.5rem] sm:rounded-[3.5rem] p-8 sm:p-14 lg:p-20 relative overflow-hidden shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] border-[3px] border-[var(--landing-dark)]">
                
                <div className="flex flex-col lg:flex-row gap-16 lg:gap-20 items-start">
                    
                    {/* Left side: Content & Pills */}
                    <div className="w-full lg:w-1/2 relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="font-serif text-5xl sm:text-6xl lg:text-7xl font-medium text-[#F4F0EB] mb-4 tracking-tight leading-tight"
                            >
                                Made for the <br /> way <span className="italic text-[#c6a3db]">you</span> work
                            </motion.h2>
                            <p className="text-[var(--landing-text-muted)] text-sm sm:text-base font-semibold tracking-wide uppercase mb-10">
                                Select one to see Clorefy in action.
                            </p>

                            <div className="flex flex-wrap gap-2.5 mb-16 max-w-xl">
                                {personas.map((persona, i) => (
                                    <button
                                        key={persona.id}
                                        onClick={() => setActive(i)}
                                        className={`px-5 py-2 rounded-full border-[1.5px] text-sm sm:text-base font-bold transition-all duration-300 ${
                                            active === i 
                                            ? 'bg-white text-[var(--landing-dark)] border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)]' 
                                            : 'bg-transparent text-white border-white/20 hover:border-white/50'
                                        }`}
                                    >
                                        {persona.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={active}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <h3 className="font-serif text-3xl text-white mb-3">{personas[active].title}.</h3>
                                    <p className="text-[var(--landing-text-muted)] text-base sm:text-lg mb-8 max-w-md leading-relaxed">
                                        {personas[active].desc}
                                    </p>
                                </motion.div>
                            </AnimatePresence>

                            <Link
                                href="/auth/signup"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#f1d0f5] text-[var(--landing-dark)] font-bold text-sm sm:text-base transition-all hover:-translate-y-0.5 active:translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(241,208,245,0.5)]"
                            >
                                Get Started Free
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>

                    {/* Right side: Custom UI Mockup Illustration */}
                    <div className="w-full lg:w-1/2 relative h-[400px] lg:h-[600px] lg:-my-10 flex items-center justify-center">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(198,163,219,0.1)_0%,transparent_60%)] pointer-events-none" />
                        
                        <motion.div 
                            className="relative w-full max-w-[450px] aspect-[4/3]"
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                        >
                            {/* Main Editor Mockup */}
                            <div className="absolute inset-0 bg-[#fbf9f6] rounded-2xl shadow-2xl border-2 border-stone-200 overflow-hidden flex flex-col z-10">
                                {/* Header */}
                                <div className="h-12 border-b border-stone-200 bg-white flex items-center px-4 justify-between">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 rounded-full bg-stone-300" />
                                        <div className="w-3 h-3 rounded-full bg-stone-300" />
                                        <div className="w-3 h-3 rounded-full bg-stone-300" />
                                    </div>
                                    <div className="w-32 h-4 bg-stone-100 rounded-full" />
                                </div>
                                {/* Body */}
                                <div className="flex-1 p-6 sm:p-8 flex flex-col gap-6 relative">
                                    <div className="flex justify-between items-start">
                                        <div className="w-24 h-8 bg-stone-200 rounded-lg" />
                                        <div className="text-right flex flex-col gap-2 items-end">
                                            <div className="w-16 h-3 bg-stone-200 rounded-full" />
                                            <div className="w-20 h-3 bg-stone-100 rounded-full" />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3 mt-4">
                                        <div className="w-full h-4 bg-stone-200 rounded-full" />
                                        <div className="w-5/6 h-4 bg-stone-200 rounded-full" />
                                        <div className="w-4/6 h-4 bg-stone-100 rounded-full" />
                                    </div>

                                    <div className="mt-auto border-t border-stone-200 pt-4 flex justify-between items-center">
                                        <div className="w-20 h-4 bg-stone-200 rounded-full" />
                                        <div className="w-16 h-6 bg-[var(--landing-amber)]/20 rounded-md" />
                                    </div>

                                    {/* Animated Typing Indicator */}
                                    <motion.div 
                                        className="absolute left-8 top-32 w-1 h-5 bg-[var(--landing-amber)]"
                                        animate={{ opacity: [1, 0, 1] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                    />
                                </div>
                            </div>

                            {/* Floating "AI Generated" Tag */}
                            <motion.div 
                                className="absolute -right-4 top-1/4 bg-[var(--landing-dark)] text-white px-4 py-2 rounded-xl shadow-xl border border-stone-700 z-20 flex items-center gap-2"
                                animate={{ y: [0, -8, 0], rotate: [0, 2, 0] }}
                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                            >
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-xs font-bold uppercase tracking-wider">Generating</span>
                            </motion.div>

                            {/* Floating Status Card */}
                            <motion.div 
                                className="absolute -left-8 bottom-1/4 bg-white p-3 rounded-2xl shadow-xl border border-stone-200 z-20 flex items-center gap-3"
                                animate={{ y: [0, 8, 0], rotate: [0, -2, 0] }}
                                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                            >
                                <div className="w-8 h-8 rounded-full bg-[var(--landing-amber)]/10 flex items-center justify-center">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--landing-amber)]"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                                <div>
                                    <div className="w-16 h-2.5 bg-stone-300 rounded-full mb-1.5" />
                                    <div className="w-10 h-2 bg-stone-200 rounded-full" />
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>

                </div>
            </div>
        </section>
    )
}

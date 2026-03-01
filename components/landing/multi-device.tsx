"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"
import { FileText, Home, Settings, Menu, ChevronLeft, Mic, Send, Plus, Shield, Scale } from "lucide-react"

export function MultiDeviceSection() {
    const containerRef = useRef(null)
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    })

    // Parallax logic - clearer separation
    const yDesktop = useTransform(scrollYProgress, [0, 1], [100, -100])
    const yTablet = useTransform(scrollYProgress, [0, 1], [150, -150])
    const yMobile = useTransform(scrollYProgress, [0, 1], [200, -200])

    return (
        <section ref={containerRef} className="py-24 sm:py-32 px-6 overflow-hidden bg-[var(--landing-cream)]">
            <div className="max-w-7xl mx-auto text-center mb-16 sm:mb-24 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="inline-block px-4 py-1.5 rounded-full bg-white border border-stone-200/50 text-sm font-semibold mb-6 shadow-sm text-[var(--landing-text-muted)]"
                >
                    Cross-Platform Sync
                </motion.div>
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="font-display text-4xl sm:text-6xl md:text-7xl font-bold mb-6 text-[var(--landing-text-dark)] drop-shadow-sm"
                >
                    Everywhere you <br />
                    <span className="text-[var(--landing-amber)] italic font-serif">work</span>
                </motion.h2>
                <p className="text-xl sm:text-2xl text-[var(--landing-text-muted)] max-w-2xl mx-auto drop-shadow-sm">
                    Capture ideas on your phone, edit on your tablet, finalize on your desktop.
                </p>
            </div>

            {/* Device Composition */}
            <div className="relative h-[600px] md:h-[800px] w-full max-w-[1200px] mx-auto perspective-[2000px] flex items-center justify-center">

                {/* 1. DESKTOP: Main Document Editor */}
                <motion.div
                    style={{ y: yDesktop }}
                    className="relative z-10 w-[90%] md:w-[75%] aspect-[16/10] bg-white rounded-2xl md:rounded-[2rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.25)] border border-stone-100 overflow-hidden ring-1 ring-black/5"
                >
                    {/* Fake Browser UI */}
                    <div className="h-10 md:h-12 bg-[#F9F9F9] border-b border-stone-200 flex items-center px-4 gap-2">
                        <div className="flex gap-1.5 opacity-50">
                            <div className="w-3 h-3 rounded-full bg-red-400" />
                            <div className="w-3 h-3 rounded-full bg-amber-400" />
                            <div className="w-3 h-3 rounded-full bg-green-400" />
                        </div>
                        <div className="hidden md:flex ml-4 px-3 py-1 bg-white rounded-md border border-stone-200 text-xs text-stone-400 w-64 shadow-sm items-center gap-2">
                            <span className="opacity-50">invo.ai/editor/proposal-v2</span>
                        </div>
                    </div>

                    {/* App UI */}
                    <div className="flex h-full">
                        {/* Sidebar */}
                        <div className="hidden md:flex w-64 bg-[#FAFAFA] border-r border-stone-200 flex-col p-6 gap-6">
                            <div className="flex items-center gap-2 font-bold text-xl text-[var(--landing-text-dark)] opacity-80 mb-4">
                                <div className="w-6 h-6 rounded bg-[var(--landing-amber)]" /> Invo
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3 p-2 bg-white rounded-lg shadow-sm font-medium text-sm text-[var(--landing-amber)]">
                                    <Home size={16} /> Dashboard
                                </div>
                                <div className="flex items-center gap-3 p-2 text-stone-500 hover:bg-stone-100 rounded-lg transition-colors text-sm">
                                    <FileText size={16} /> Templates
                                </div>
                                <div className="flex items-center gap-3 p-2 text-stone-500 hover:bg-stone-100 rounded-lg transition-colors text-sm">
                                    <Settings size={16} /> Settings
                                </div>
                            </div>
                            {/* Recent Docs */}
                            <div className="mt-8">
                                <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Recents</div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-2 hover:bg-stone-50 rounded-lg cursor-pointer">
                                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                                        <div className="text-sm font-medium text-stone-600">Q3 Marketing Plan</div>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 hover:bg-stone-50 rounded-lg cursor-pointer">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                        <div className="text-sm font-medium text-stone-600">Client Proposal</div>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 hover:bg-stone-50 rounded-lg cursor-pointer">
                                        <div className="w-2 h-2 rounded-full bg-purple-400" />
                                        <div className="text-sm font-medium text-stone-600">Website Copy</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 bg-white p-8 md:p-12 font-serif text-stone-800 relative">
                            {/* Paper texture overlay */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.02)_2px,rgba(0,0,0,0.02)_4px)]" />

                            <div className="max-w-2xl mx-auto space-y-6">
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.2 }}
                                    className="text-4xl font-bold font-display text-stone-900 border-b border-stone-100 pb-4 mb-8"
                                >
                                    Project Proposal: Q3 Marketing
                                </motion.div>

                                {/* Animated Typing Content */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    whileInView={{ opacity: 1 }}
                                    transition={{ staggerChildren: 0.1, delayChildren: 0.5 }}
                                    className="space-y-4 text-lg leading-relaxed text-stone-600"
                                >
                                    <motion.p initial={{ opacity: 0, y: 5 }} whileInView={{ opacity: 1, y: 0 }}>
                                        <span className="font-semibold text-stone-800">Objective:</span> To increase brand awareness by 25% through targeted social media campaigns.
                                    </motion.p>
                                    <motion.p initial={{ opacity: 0, y: 5 }} whileInView={{ opacity: 1, y: 0 }} className="p-4 bg-[var(--landing-cream)] rounded-xl border border-[var(--landing-amber)]/20 text-stone-700 italic">
                                        &ldquo;Strategy without tactics is the slowest route to victory. Tactics without strategy is the noise before defeat.&rdquo;
                                    </motion.p>
                                    <motion.p initial={{ opacity: 0, y: 5 }} whileInView={{ opacity: 1, y: 0 }}>
                                        This proposal outlines the key deliverables, timeline, and budget allocation for the upcoming quarter. We will focus on...
                                    </motion.p>
                                    <div className="flex items-center gap-2 text-[var(--landing-amber)] font-sans text-sm animate-pulse mt-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-current" /> AI generating next section...
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* 2. TABLET: Dashboard List - Floating Left */}
                <motion.div
                    style={{ y: yTablet, x: -50, rotate: -5 }}
                    className="absolute left-[-5%] md:left-[0%] bottom-[5%] z-20 w-[45%] md:w-[300px] aspect-[3/4] bg-white rounded-[2rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] border-[8px] border-stone-900 overflow-hidden hidden sm:block"
                >
                    <div className="h-full bg-stone-50 flex flex-col">
                        {/* Tablet Header */}
                        <div className="p-5 flex justify-between items-center bg-white border-b border-stone-100">
                            <Menu size={20} className="text-stone-400" />
                            <div className="font-bold text-stone-800">Documents</div>
                            <div className="w-8 h-8 rounded-full bg-stone-100" />
                        </div>
                        {/* List Items */}
                        <div className="p-4 space-y-3">
                            {[
                                { title: "Invoice #1024", date: "Today", icon: FileText, color: "bg-blue-50 text-blue-600" },
                                { title: "Quotation #47", date: "Yesterday", icon: Shield, color: "bg-purple-50 text-purple-600" },
                                { title: "Q3 Proposal", date: "2 days ago", icon: FileText, color: "bg-emerald-50 text-emerald-600" },
                                { title: "Contract v2", date: "Last week", icon: Scale, color: "bg-orange-50 text-orange-600" }
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ x: -20, opacity: 0 }}
                                    whileInView={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 + (i * 0.1) }}
                                    className="p-3 bg-white rounded-xl shadow-sm border border-stone-100 flex items-center gap-3 group hover:shadow-md transition-all"
                                >
                                    <div className={`h-10 w-10 rounded-lg ${item.color} flex items-center justify-center shrink-0`}>
                                        <item.icon size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-stone-800 truncate">{item.title}</div>
                                        <div className="text-xs text-stone-400 font-medium">{item.date}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                        {/* FAB */}
                        <div className="absolute bottom-6 right-6 w-12 h-12 bg-[var(--landing-amber)] rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-300/50">
                            <Plus size={24} />
                        </div>
                    </div>
                </motion.div>

                {/* 3. MOBILE: Prompt Interface - Floating Right */}
                <motion.div
                    style={{ y: yMobile, x: 50, rotate: 5 }}
                    className="absolute right-[-2%] md:right-[5%] top-[10%] z-30 w-[40%] md:w-[220px] aspect-[9/18] bg-white rounded-[2.5rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.35)] border-[8px] border-stone-900 overflow-hidden hidden sm:block"
                >
                    <div className="h-full bg-white flex flex-col relative">
                        {/* Dynamic Island */}
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-6 bg-stone-900 rounded-full z-20" />

                        {/* Header */}
                        <div className="pt-12 px-4 pb-2 flex items-center gap-2 border-b border-stone-100">
                            <ChevronLeft size={20} className="text-stone-400" />
                            <span className="font-semibold text-sm">New Request</span>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 p-4 flex flex-col justify-end space-y-3 bg-stone-50">
                            {/* User Message */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                whileInView={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="self-end bg-[var(--landing-dark)] text-white p-3 rounded-2xl rounded-tr-sm text-xs max-w-[85%] shadow-sm"
                            >
                                Draft a freelance contract for web design services.
                            </motion.div>

                            {/* AI Response loading */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                whileInView={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 1 }}
                                className="self-start bg-white border border-stone-100 p-3 rounded-2xl rounded-tl-sm text-xs max-w-[85%] shadow-sm flex items-center gap-2 text-stone-500"
                            >
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-[var(--landing-amber)] rounded-full animate-bounce" />
                                    <div className="w-1.5 h-1.5 bg-[var(--landing-amber)] rounded-full animate-bounce delay-75" />
                                    <div className="w-1.5 h-1.5 bg-[var(--landing-amber)] rounded-full animate-bounce delay-150" />
                                </div>
                                Generating...
                            </motion.div>
                        </div>

                        {/* Input Bar */}
                        <div className="p-3 bg-white border-t border-stone-100 flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                                <Mic size={14} />
                            </div>
                            <div className="flex-1 h-8 bg-stone-100 rounded-full px-3 flex items-center text-xs text-stone-400">
                                Describe your document...
                            </div>
                            <div className="h-8 w-8 rounded-full bg-[var(--landing-amber)] flex items-center justify-center text-white">
                                <Send size={14} />
                            </div>
                        </div>
                    </div>
                </motion.div>

            </div>
        </section>
    )
}

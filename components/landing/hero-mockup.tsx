"use client"

import { motion } from "framer-motion"
import { Send, FileText, CheckCircle2, Loader2, Plus, Sparkles } from "lucide-react"

export function HeroMockup() {
    return (
        <div className="relative mt-10 sm:mt-16 lg:mt-24 w-full max-w-5xl mx-auto px-2 sm:px-4 lg:px-6 z-20 perspective-[2000px]">
            {/* Ambient background glow for the mockup (Soft white/cream glow) */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent blur-[80px] opacity-80 pointer-events-none" />
            
            <motion.div
                initial={{ opacity: 0, y: 80, rotateX: 15 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative rounded-t-[1.25rem] sm:rounded-t-[2rem] border-t-[2.5px] sm:border-t-[3px] border-l-[2.5px] sm:border-l-[3px] border-r-[2.5px] sm:border-r-[3px] border-[var(--landing-dark)] bg-[var(--landing-cream)]/95 backdrop-blur-xl shadow-[5px_5px_0px_0px_rgba(26,26,26,1)] sm:shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] overflow-hidden aspect-[4/5] xs:aspect-[5/6] sm:aspect-[16/10] md:aspect-[21/9]"
                style={{ transformStyle: "preserve-3d" }}
            >
                {/* Mockup Header - App style */}
                <div className="absolute top-0 inset-x-0 h-10 sm:h-14 bg-white border-b border-stone-200 flex items-center px-3 sm:px-6 z-20 justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2 font-bold text-[#1a1a1a] text-[11px] sm:text-base">
                        <div className="w-4 h-4 sm:w-6 sm:h-6 rounded bg-[var(--landing-amber)] flex items-center justify-center">
                            <span className="text-[8px] sm:text-[10px] text-white">C</span>
                        </div>
                        Clorefy
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-3">
                        <div className="px-2 sm:px-3 py-0.5 sm:py-1.5 rounded-full bg-stone-100 text-[9px] sm:text-xs font-semibold text-stone-500">
                            Draft
                        </div>
                        <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-stone-200 flex items-center justify-center border border-stone-300">
                            <span className="text-[8px] sm:text-xs font-bold text-stone-500">SB</span>
                        </div>
                    </div>
                </div>

                {/* Mockup Body Area - Dual Pane */}
                <div className="absolute top-10 sm:top-14 inset-0 flex">
                    
                    {/* Left Pane - AI Chat */}
                    <div className="w-full md:w-[40%] flex flex-col border-r border-stone-200 bg-[#FAFAF9] relative z-10">
                        {/* Chat Messages */}
                        <div className="flex-1 p-3 sm:p-5 overflow-hidden flex flex-col justify-end gap-2.5 sm:gap-4">
                            
                            {/* User Message */}
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8, duration: 0.4 }}
                                className="self-end max-w-[85%] bg-[#1a1a1a] text-white rounded-2xl rounded-br-sm px-3 sm:px-4 py-2 sm:py-3 shadow-sm text-[11px] sm:text-sm leading-snug"
                            >
                                Create an invoice for $5,900 to Acme Corp for web design.
                            </motion.div>

                            {/* Assistant Thinking/Generating */}
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.2, duration: 0.4 }}
                                className="self-start max-w-[90%] bg-white border border-stone-200 rounded-2xl rounded-bl-sm p-3 sm:p-4 shadow-sm"
                            >
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 text-[11px] sm:text-sm font-semibold text-[#1a1a1a]">
                                    <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-[var(--landing-amber)]" />
                                    Generating your invoice...
                                </div>
                                <div className="space-y-1 sm:space-y-2">
                                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-stone-500">
                                        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500 shrink-0" />
                                        Found Acme Corp in CRM
                                    </div>
                                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-stone-500">
                                        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500 shrink-0" />
                                        Applied 18% Tax
                                    </div>
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 1.8 }}
                                        className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-[#1a1a1a] font-medium"
                                    >
                                        <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin text-[var(--landing-amber)] shrink-0" />
                                        Writing line items
                                    </motion.div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Chat Input */}
                        <div className="p-2.5 sm:p-4 bg-white border-t border-stone-200">
                            <div className="relative flex items-center bg-stone-50 border border-stone-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 shadow-inner">
                                <span className="text-[11px] sm:text-sm text-stone-400 truncate">Reply to Clorefy...</span>
                                <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 bg-[#1a1a1a] rounded-md sm:rounded-lg flex items-center justify-center shadow-sm">
                                    <Send className="w-3 h-3 sm:w-4 sm:h-4 text-white ml-0.5" />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Right Pane - Editor / Preview */}
                    <div className="hidden md:flex flex-1 flex-col bg-stone-100 relative">
                        {/* Editor Header */}
                        <div className="px-6 py-4 flex items-center justify-between border-b border-stone-200 bg-white">
                            <div className="flex items-center gap-2 text-sm font-bold text-[#1a1a1a]">
                                <FileText className="w-4 h-4 text-stone-400" />
                                Invoice #INV-2026
                            </div>
                            <button className="px-4 py-1.5 rounded-lg bg-[#1a1a1a] text-white text-xs font-semibold shadow-sm hover:opacity-90">
                                Send Invoice
                            </button>
                        </div>

                        {/* Document Content */}
                        <div className="flex-1 p-6 overflow-hidden flex items-start justify-center">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 1.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                className="w-full max-w-lg bg-white rounded-xl shadow-md border border-stone-200 p-8 flex flex-col"
                            >
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <div className="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200 mb-3 flex items-center justify-center">
                                            <span className="text-xs font-bold text-stone-400">LOGO</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Billed To</p>
                                        <h3 className="text-sm font-bold text-[#1a1a1a]">Acme Corp.</h3>
                                        <p className="text-xs text-stone-500 mt-0.5">123 Business Ave, NY</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Amount Due</p>
                                        <h2 className="text-2xl font-bold text-[#1a1a1a]">$5,900.00</h2>
                                        <p className="text-xs text-stone-500 mt-1">Due: May 15, 2026</p>
                                    </div>
                                </div>

                                {/* Line Items */}
                                <div className="border-t border-stone-100 pt-4">
                                    <div className="grid grid-cols-12 gap-2 pb-2 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                        <div className="col-span-8">Description</div>
                                        <div className="col-span-4 text-right">Amount</div>
                                    </div>
                                    <div className="space-y-3 pt-2">
                                        {[
                                            { desc: "Website Redesign", amt: "$4,000.00" },
                                            { desc: "Frontend Development", amt: "$1,500.00" },
                                            { desc: "SEO Setup", amt: "$400.00" }
                                        ].map((item, i) => (
                                            <motion.div 
                                                key={i}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 2.0 + (i * 0.2), duration: 0.4 }}
                                                className="grid grid-cols-12 gap-2"
                                            >
                                                <div className="col-span-8 text-xs font-semibold text-[#1a1a1a]">{item.desc}</div>
                                                <div className="col-span-4 text-right text-xs font-semibold text-[#1a1a1a]">{item.amt}</div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* Floating Action Button inside preview */}
                                <div className="mt-auto pt-6 flex justify-center">
                                    <div className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100 flex items-center gap-1.5 shadow-sm">
                                        <Plus className="w-3 h-3" />
                                        Add Line Item
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>

                {/* Bottom gradient fade so it seamlessly connects to the sections below */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--landing-cream)] to-transparent pointer-events-none z-30" />
            </motion.div>
        </div>
    )
}

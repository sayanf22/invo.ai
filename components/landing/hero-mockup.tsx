"use client"

import { motion } from "framer-motion"

export function HeroMockup() {
    return (
        <div className="relative mt-16 sm:mt-24 w-full max-w-5xl mx-auto px-4 sm:px-6 z-20 perspective-[2000px]">
            {/* Ambient background glow for the mockup */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--landing-amber)]/20 via-transparent to-transparent blur-[80px] opacity-60 pointer-events-none" />
            
            <motion.div
                initial={{ opacity: 0, y: 80, rotateX: 15 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative rounded-t-[2rem] border-t border-l border-r border-white/10 bg-[#121211]/95 backdrop-blur-xl shadow-2xl overflow-hidden aspect-[16/10] md:aspect-[21/9]"
                style={{ transformStyle: "preserve-3d" }}
            >
                {/* Mockup Header */}
                <div className="absolute top-0 inset-x-0 h-12 bg-white/[0.03] border-b border-white/5 flex items-center px-6 z-10">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-white/20" />
                        <div className="w-3 h-3 rounded-full bg-white/20" />
                        <div className="w-3 h-3 rounded-full bg-white/20" />
                    </div>
                    <div className="mx-auto w-1/3 max-w-[200px] h-4 rounded bg-white/5" />
                </div>

                {/* Mockup Body Area */}
                <div className="absolute top-12 inset-0 p-4 sm:p-6 flex gap-6">
                    {/* Sidebar */}
                    <div className="w-48 hidden md:flex flex-col gap-4 border-r border-white/5 pr-6">
                        <div className="w-full h-8 rounded bg-white/10" />
                        <div className="w-3/4 h-4 rounded bg-white/5 mt-4" />
                        <div className="w-2/3 h-4 rounded bg-white/5" />
                        <div className="w-4/5 h-4 rounded bg-white/5" />
                    </div>
                    
                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col gap-6">
                        <div className="flex justify-between items-center">
                            <div className="w-1/3 max-w-[150px] h-8 rounded bg-white/10" />
                            <div className="w-24 h-8 rounded-full bg-[var(--landing-amber)]/80" />
                        </div>
                        <div className="flex-1 rounded-xl border border-white/5 bg-white/[0.02] p-4 sm:p-6 overflow-hidden relative">
                            
                            {/* Abstract Document Headers */}
                            <div className="flex justify-between border-b border-white/10 pb-4 sm:pb-6 mb-4 sm:mb-6">
                                <div className="space-y-3 w-1/2">
                                    <div className="w-3/4 max-w-[120px] h-8 sm:h-10 rounded bg-white/10" />
                                    <div className="w-full max-w-[180px] h-3 sm:h-4 rounded bg-white/5" />
                                </div>
                                <div className="space-y-3 items-end flex flex-col w-1/3">
                                    <div className="w-full max-w-[80px] h-5 sm:h-6 rounded bg-white/10" />
                                    <div className="w-full max-w-[100px] h-3 sm:h-4 rounded bg-white/5" />
                                </div>
                            </div>
                            
                            {/* Document Rows */}
                            <div className="space-y-3 sm:space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <motion.div 
                                        key={i}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.8 + (i * 0.15), duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                        className="w-full h-10 sm:h-12 rounded-lg bg-white/[0.04] flex items-center px-4 gap-4" 
                                    >
                                        <div className="w-6 h-6 rounded bg-white/10 shrink-0" />
                                        <div className="w-1/3 h-3 rounded bg-white/10" />
                                        <div className="w-1/4 h-3 rounded bg-white/5 ml-auto hidden sm:block" />
                                    </motion.div>
                                ))}
                            </div>

                            {/* Floating "AI Generated" Indicator */}
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 1.5, duration: 0.5, type: "spring" }}
                                className="absolute bottom-6 right-6 px-3 py-1.5 rounded-full bg-[var(--landing-amber)]/10 border border-[var(--landing-amber)]/20 text-[var(--landing-amber)] text-xs font-medium flex items-center gap-2"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--landing-amber)] animate-pulse" />
                                Auto-filled
                            </motion.div>
                        </div>
                    </div>
                </div>

                {/* Glass reflection overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />
                
                {/* Bottom gradient fade so it seamlessly connects to the dark sections below */}
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#121211] to-transparent pointer-events-none z-20" />
            </motion.div>
        </div>
    )
}

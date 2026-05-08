"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

import { FlipWords } from "@/components/ui/flip-words"
import { ServicesMarquee } from "./services-marquee"

export function HeroSection() {
    return (
        <section className="relative w-full overflow-hidden bg-[#FAFAF9]">

            {/* Sophisticated Off-White/White Gradient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-[#F5F4F0] to-[#EAE8E3] opacity-80" />

            {/* Subtle background grid pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

            {/* Subtle warm glow at top center */}
            <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-[100%] opacity-30 pointer-events-none blur-[80px]"
                style={{ background: "radial-gradient(circle, rgba(224,123,57,0.15) 0%, transparent 60%)" }}
            />

            <div className="relative z-10 max-w-6xl mx-auto text-center pt-32 pb-20 sm:pb-32 px-5 sm:px-6">

                {/* Premium Beta announcement pill */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="flex justify-center mb-8 sm:mb-10"
                >
                    <div className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-full border border-stone-200/50 bg-white/60 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[var(--landing-amber)]/0 via-[var(--landing-amber)]/5 to-[var(--landing-amber)]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer" />
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--landing-amber)] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--landing-amber)]"></span>
                        </span>
                        <span className="text-[13px] font-medium text-[var(--landing-text-dark)]">
                            <span className="font-bold text-[var(--landing-amber)] mr-1">BETA</span>
                            We&apos;re live — try it free and share your feedback
                        </span>
                        <ArrowRight size={14} className="text-[var(--landing-text-muted)] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                </motion.div>

                {/* Main heading */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="font-display text-[3.25rem] sm:text-6xl md:text-7xl lg:text-[7.5rem] font-semibold tracking-tighter leading-[1.1] text-[#1C1A17] mb-6 sm:mb-8"
                >
                    <span className="sr-only">Clorefy — AI Invoice, Contract &amp; Proposal Generator. </span>
                    Create
                    <FlipWords 
                        words={["invoices", "contracts", "proposals", "quotations"]} 
                        className="font-sans font-medium text-[var(--landing-amber)] px-2 mx-0 tracking-tight" 
                    /> <br />
                    in seconds
                </motion.div>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="text-lg sm:text-xl md:text-2xl text-[#86807B] max-w-2xl mx-auto mb-10 sm:mb-14 leading-relaxed font-light px-2"
                >
                    Your business profile, tax IDs, payment terms, and client details — saved once, auto-filled forever. Compliant documents across 11 countries in seconds.
                </motion.p>

                {/* CTA buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5"
                >
                    <Link
                        href="/auth/signup"
                        className="group relative inline-flex items-center gap-2.5 px-8 py-4 sm:px-10 sm:py-5 rounded-full bg-[var(--landing-dark)] text-white font-bold text-base sm:text-xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 w-full sm:w-auto justify-center overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                        <span className="relative z-10">Get Started Free</span>
                        <ArrowRight size={18} className="sm:w-5 sm:h-5 transition-transform group-hover:translate-x-1 relative z-10" />
                    </Link>
                    <a
                        href="https://www.youtube.com/@Clorefy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-8 py-4 sm:px-10 sm:py-5 rounded-full border border-stone-200 bg-white text-[var(--landing-dark)] font-bold text-base sm:text-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-1 w-full sm:w-auto justify-center"
                    >
                        See How it Works
                    </a>
                </motion.div>
            </div>

            {/* Services Marquee - Full width dark band */}
            <div className="relative z-20 mt-10">
                <ServicesMarquee />
            </div>
        </section>
    )
}

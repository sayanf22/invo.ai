"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

import { FlipWords } from "@/components/ui/flip-words"
import { ServicesMarquee } from "./services-marquee"
import { HeroMockup } from "./hero-mockup"

export function HeroSection() {
    return (
        <>
            <section className="relative w-full overflow-hidden bg-[#FAFAF9] pt-24 sm:pt-32 md:pt-36 lg:pt-40 pb-0">

                {/* Sophisticated Off-White/White Gradient Background */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-[#F5F4F0] to-[#EAE8E3] opacity-90" />

                {/* Subtle background grid pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none" />

                {/* Subtle warm glow at top center */}
                <div
                    className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[500px] rounded-[100%] opacity-40 pointer-events-none blur-[100px]"
                    style={{ background: "radial-gradient(circle, rgba(224,123,57,0.12) 0%, transparent 60%)" }}
                />

                <div className="relative z-10 max-w-6xl mx-auto text-center px-4 sm:px-6">

                    {/* Premium Beta announcement pill */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="flex justify-center mb-6 sm:mb-10"
                    >
                        <div className="group relative inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-stone-200/50 bg-white/60 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300 max-w-[92vw]">
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[var(--landing-amber)]/0 via-[var(--landing-amber)]/5 to-[var(--landing-amber)]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer" />
                            <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--landing-amber)] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-[var(--landing-amber)]"></span>
                            </span>
                            <span className="text-[11.5px] sm:text-[13px] font-medium text-[var(--landing-text-dark)] whitespace-nowrap">
                                <span className="font-bold text-[var(--landing-amber)] mr-1">BETA</span>
                                <span className="sm:hidden">Try it free — share feedback</span>
                                <span className="hidden sm:inline">We&apos;re live — try it free and share your feedback</span>
                            </span>
                            <ArrowRight size={12} className="sm:w-[14px] sm:h-[14px] text-[var(--landing-text-muted)] group-hover:translate-x-0.5 transition-transform shrink-0" />
                        </div>
                    </motion.div>

                    {/* Main heading */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                        className="font-display text-[2.5rem] xs:text-[2.75rem] sm:text-5xl md:text-6xl lg:text-[6.5rem] font-semibold tracking-tighter leading-[1.02] text-[#1C1A17] mb-5 sm:mb-8"
                    >
                        <span className="sr-only">Clorefy — AI Invoice, Contract &amp; Proposal Generator.</span>

                        {/* "Create" with subtle text shadow */}
                        <span
                            className="block"
                            aria-hidden
                            style={{ textShadow: "3px 3px 0px rgba(26,26,26,0.08), 0 8px 24px rgba(26,26,26,0.06)" }}
                        >
                            Create
                        </span>

                        {/* Fixed-height row — prevents layout shift during word swap */}
                        <span className="block relative" style={{ minHeight: "1.15em" }} aria-hidden>
                            <FlipWords
                                words={["invoices", "contracts", "proposals", "NDAs", "SOWs"]}
                                gradients={[
                                    // Invoices — warm amber → terracotta (matches brand)
                                    "linear-gradient(120deg, #d97757 0%, #e07b39 45%, #b8421c 100%)",
                                    // Contracts — deep indigo → slate (professional, high contrast)
                                    "linear-gradient(120deg, #1e3a8a 0%, #3730a3 50%, #0f172a 100%)",
                                    // Proposals — forest emerald → deep teal (rich, editorial)
                                    "linear-gradient(120deg, #065f46 0%, #047857 50%, #134e4a 100%)",
                                    // NDAs — burgundy → warm rose (elegant, warm)
                                    "linear-gradient(120deg, #881337 0%, #9f1239 50%, #6b0f2a 100%)",
                                    // SOWs — deep slate → charcoal (professional, structured)
                                    "linear-gradient(120deg, #334155 0%, #475569 50%, #1e293b 100%)",
                                ]}
                                className="italic font-serif tracking-tight"
                            />
                        </span>

                        {/* "in seconds" with animated underline */}
                        <span
                            className="block relative inline-block"
                            aria-hidden
                            style={{ textShadow: "3px 3px 0px rgba(26,26,26,0.08), 0 8px 24px rgba(26,26,26,0.06)" }}
                        >
                            in seconds
                            <motion.span
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ duration: 0.8, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute -bottom-2 left-0 right-0 h-[4px] sm:h-[6px] rounded-full origin-left"
                                style={{ background: "linear-gradient(90deg, #1C1A17 0%, #1C1A1700 100%)" }}
                            />
                        </span>
                    </motion.div>

                    {/* Subtitle — plain English: what it is + what you get */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="text-[15px] sm:text-lg md:text-xl text-[#5B5550] max-w-2xl mx-auto mb-8 sm:mb-12 leading-relaxed font-medium px-2"
                    >
                        Describe your document in plain English. Clorefy generates it with your business details, country-compliant tax rules for 11 countries, and a payment link — ready to send in under 30 seconds.
                    </motion.p>

                    {/* CTA buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 w-full px-2 sm:px-0"
                    >
                        <Link
                            href="/auth/signup"
                            className="group relative inline-flex items-center gap-2 px-6 py-3.5 sm:px-10 sm:py-5 rounded-xl sm:rounded-[1rem] bg-[var(--landing-dark)] text-white font-bold text-[15px] sm:text-xl transition-all border-[2px] sm:border-[2.5px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] sm:shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[5px_5px_0px_0px_rgba(26,26,26,1)] sm:hover:shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] w-full sm:w-auto justify-center overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                            <span className="relative z-10">Get Started Free</span>
                            <ArrowRight size={16} className="sm:w-5 sm:h-5 transition-transform group-hover:translate-x-1 relative z-10" />
                        </Link>
                        <a
                            href="https://www.youtube.com/@Clorefy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3.5 sm:px-10 sm:py-5 rounded-xl sm:rounded-[1rem] border-[2px] sm:border-[2.5px] border-[var(--landing-dark)] bg-white text-[var(--landing-dark)] font-bold text-[15px] sm:text-xl transition-all shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] sm:shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[5px_5px_0px_0px_rgba(26,26,26,1)] sm:hover:shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] w-full sm:w-auto justify-center"
                        >
                            See How it Works
                        </a>
                    </motion.div>

                    {/* Product Dashboard Visual */}
                    <HeroMockup />

                </div>

            </section>

            {/* Services Marquee — lives OUTSIDE the overflow-hidden section so all 4 rounded corners show */}
            <div className="bg-[#FAFAF9] px-4 sm:px-6 lg:px-10 pb-10 pt-2">
                <ServicesMarquee />
            </div>
        </>
    )
}

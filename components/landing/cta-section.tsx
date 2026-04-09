"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function CTASection() {
    return (
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-10">
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="max-w-[1400px] mx-auto bg-[var(--landing-dark)] rounded-[2rem] sm:rounded-[3.5rem] lg:rounded-[4.5rem] p-8 sm:p-12 lg:p-24 text-center relative overflow-hidden"
            >
                {/* Background effects */}
                <div className="absolute inset-0 bg-mesh-dark opacity-40 pointer-events-none" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-[radial-gradient(circle,rgba(198,122,60,0.15)_0%,transparent_70%)] pointer-events-none" />

                <div className="relative z-10 max-w-4xl mx-auto">
                    <h2 className="font-display text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold text-[var(--landing-cream)] mb-6 sm:mb-8 tracking-tight leading-[0.95]">
                        Ready to <br />
                        <span className="text-[var(--landing-amber)] italic font-serif">transform</span> your workflow?
                    </h2>

                    <p className="text-base sm:text-xl md:text-2xl text-[var(--landing-text-dim)] mb-8 sm:mb-14 max-w-2xl mx-auto font-light">
                        Join 10,000+ professionals generating documents with Clorefy. No credit card required.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                        <Link
                            href="/auth/signup"
                            className="group relative inline-flex items-center gap-2.5 px-7 py-4 sm:px-10 sm:py-5 rounded-full bg-[var(--landing-cream)] text-[var(--landing-dark)] font-bold text-base sm:text-xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(0,0,0,0.2)] hover:shadow-[0_25px_50px_rgba(0,0,0,0.3)] w-full sm:w-auto justify-center"
                        >
                            Get Started Free
                            <ArrowRight className="transition-transform group-hover:translate-x-1" size={20} />
                        </Link>

                        <Link
                            href="/contact-sales"
                            className="inline-flex items-center gap-2 px-7 py-4 sm:px-8 sm:py-5 rounded-full border border-white/20 text-white font-semibold text-base sm:text-lg hover:bg-white/5 transition-colors w-full sm:w-auto justify-center"
                        >
                            Contact Sales
                        </Link>
                    </div>

                    <div className="mt-12 text-[var(--landing-text-dim)] text-sm font-medium opacity-60">
                        No credit card required
                    </div>
                </div>
            </motion.div>
        </section>
    )
}

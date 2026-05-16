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
                className="max-w-[1400px] mx-auto bg-white rounded-[2.5rem] sm:rounded-[4rem] border-[3px] border-[var(--landing-dark)] shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] p-8 sm:p-12 lg:p-24 text-center relative overflow-hidden"
            >
                {/* Background effects */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-[radial-gradient(circle,rgba(224,123,57,0.05)_0%,transparent_70%)] pointer-events-none" />

                <div className="relative z-10 max-w-4xl mx-auto">
                    <h2 className="font-display text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold text-[var(--landing-dark)] mb-6 sm:mb-8 tracking-tight leading-[0.95]">
                        Ready to stop doing <br />
                        <span className="text-[var(--landing-amber)] italic font-serif">documents</span> manually?
                    </h2>

                    <p className="text-base sm:text-xl md:text-2xl text-[var(--landing-text-muted)] mb-8 sm:mb-14 max-w-2xl mx-auto font-medium">
                        Generate compliant invoices, contracts, and proposals in under 30 seconds. Free plan available — no credit card required.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                        <Link
                            href="/auth/signup"
                            className="group relative inline-flex items-center gap-2.5 px-7 py-4 sm:px-10 sm:py-5 rounded-full bg-[var(--landing-dark)] text-white font-bold text-base sm:text-xl transition-all border-[2px] border-[var(--landing-dark)] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] w-full sm:w-auto justify-center"
                        >
                            Get Started Free
                            <ArrowRight className="transition-transform group-hover:translate-x-1" size={20} />
                        </Link>

                        <Link
                            href="/contact-sales"
                            className="inline-flex items-center gap-2 px-7 py-4 sm:px-8 sm:py-5 rounded-full border-[2px] border-[var(--landing-dark)] bg-white text-[var(--landing-dark)] font-bold text-base sm:text-xl transition-all shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] w-full sm:w-auto justify-center"
                        >
                            Contact Sales
                        </Link>
                    </div>

                    <div className="mt-12 text-[var(--landing-text-muted)] text-sm font-medium">
                        No credit card required
                    </div>
                </div>
            </motion.div>
        </section>
    )
}

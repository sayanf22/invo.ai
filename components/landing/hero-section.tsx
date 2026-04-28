"use client"

import Link from "next/link"
import { ArrowRight, FileText } from "lucide-react"

import { ServicesMarquee } from "./services-marquee"

export function HeroSection() {
    return (
        <section className="relative w-full p-3 sm:p-6 lg:p-8 bg-[#F2F0E9]">

            {/* Main Hero Capsule */}
            <div className="relative min-h-[85vh] sm:min-h-[90vh] w-full rounded-[2rem] sm:rounded-[3.5rem] lg:rounded-[4.5rem] overflow-hidden flex items-center justify-center bg-[var(--landing-cream)] shadow-2xl border border-white/50"
                style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F9F5EF 100%)" }}>

                {/* Subtle radial glow inside capsule */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[800px] h-[500px] sm:h-[800px] rounded-full opacity-25"
                        style={{ background: "radial-gradient(circle, rgba(198,122,60,0.2) 0%, transparent 70%)" }}
                    />
                </div>

                <div className="relative z-10 max-w-6xl mx-auto text-center pt-24 sm:pt-20 pb-20 sm:pb-32 px-5 sm:px-6">

                    {/* Beta announcement pill */}
                    <div className="animate-fade-in-up flex justify-center mb-6 sm:mb-8" style={{ animationDelay: "0.05s" }}>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--landing-amber)]/30 bg-[var(--landing-amber)]/8 text-sm font-medium text-[var(--landing-text-dark)]">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--landing-amber)] text-white text-[11px] font-bold uppercase tracking-wider leading-none">
                                Beta
                            </span>
                            <span className="text-[var(--landing-text-muted)]">We&apos;re live — try it free and share your feedback</span>
                        </div>
                    </div>

                    {/* Main heading — brand name in H1 for SEO, visual copy for humans */}
                    <h1 className="animate-fade-in-up font-display text-[2.75rem] sm:text-7xl md:text-8xl lg:text-9xl font-semibold tracking-tighter leading-[0.92] text-[var(--landing-text-dark)] mb-6 sm:mb-10" style={{ animationDelay: "0.15s" }}>
                        {/* Hidden brand + description for crawlers — visible copy below */}
                        <span className="sr-only">Clorefy — AI Invoice, Contract &amp; Proposal Generator. </span>
                        It remembers,
                        <br />
                        so you <span className="italic gradient-text sm:pr-4">don&apos;t</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="animate-fade-in-up text-base sm:text-xl md:text-2xl text-[var(--landing-text-muted)] max-w-2xl mx-auto mb-8 sm:mb-14 leading-relaxed font-light px-2" style={{ animationDelay: "0.3s" }}>
                        Your business profile, tax IDs, payment terms, and client details — saved once, auto-filled forever. Compliant documents across 11 countries in seconds.
                    </p>

                    {/* CTA buttons */}
                    <div className="animate-fade-in-up flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5" style={{ animationDelay: "0.45s" }}>
                        <Link
                            href="/auth/signup"
                            className="group inline-flex items-center gap-2.5 px-7 py-4 sm:px-10 sm:py-5 rounded-full bg-[var(--landing-dark)] text-[var(--landing-cream)] font-semibold text-base sm:text-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] w-full sm:w-auto justify-center"
                        >
                            <FileText size={20} className="sm:w-[22px] sm:h-[22px]" />
                            Get Started Free
                            <ArrowRight size={18} className="sm:w-5 sm:h-5 transition-transform group-hover:translate-x-1" />
                        </Link>
                        <a
                            href="https://www.youtube.com/@Clorefy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-7 py-4 sm:px-10 sm:py-5 rounded-full border border-[var(--landing-text-dark)]/10 bg-white text-[var(--landing-text-dark)] font-semibold text-base sm:text-xl hover:border-[var(--landing-text-dark)]/30 transition-all duration-300 shadow-sm hover:shadow w-full sm:w-auto justify-center"
                        >
                            See How it Works
                        </a>
                    </div>
                </div>

            </div>

            {/* Services Marquee - Full width dark band below capsule */}
            <div className="relative z-20 -mt-6">
                <ServicesMarquee />
            </div>
        </section>
    )
}

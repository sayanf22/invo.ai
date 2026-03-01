"use client"

import Link from "next/link"
import { ArrowRight, FileText } from "lucide-react"

import { ServicesMarquee } from "./services-marquee"

export function HeroSection() {
    return (
        <section className="relative w-full p-4 sm:p-6 lg:p-8 bg-[#F2F0E9]"> {/* Outer background matching body */}

            {/* Main Hero Capsule */}
            <div className="relative min-h-[90vh] w-full rounded-[3.5rem] sm:rounded-[4.5rem] overflow-hidden flex items-center justify-center bg-[var(--landing-cream)] shadow-2xl border border-white/50"
                style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F9F5EF 100%)" }}>

                {/* Subtle radial glow inside capsule */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-25"
                        style={{ background: "radial-gradient(circle, rgba(198,122,60,0.2) 0%, transparent 70%)" }}
                    />
                </div>

                <div className="relative z-10 max-w-6xl mx-auto text-center pt-20 pb-32 px-4">
                    {/* Badge */}
                    <div className="animate-fade-in-up inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-[var(--landing-text-dark)]/5 shadow-sm mb-12" style={{ animationDelay: "0.1s" }}>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm font-medium text-[var(--landing-text-muted)] tracking-wide uppercase">
                            Now available in 11 countries
                        </span>
                    </div>

                    {/* Main heading — Massive & Modern */}
                    <h1 className="animate-fade-in-up font-display text-7xl sm:text-8xl md:text-9xl font-semibold tracking-tighter leading-[0.9] text-[var(--landing-text-dark)] mb-10" style={{ animationDelay: "0.2s" }}>
                        Don&apos;t draft,
                        <br />
                        just <span className="italic gradient-text pr-4">describe</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="animate-fade-in-up text-xl sm:text-2xl text-[var(--landing-text-muted)] max-w-2xl mx-auto mb-14 leading-relaxed font-light" style={{ animationDelay: "0.35s" }}>
                        AI-powered invoices, contracts, and proposals — compliant across borders, generated in seconds.
                    </p>

                    {/* CTA buttons */}
                    <div className="animate-fade-in-up flex flex-col sm:flex-row items-center justify-center gap-5" style={{ animationDelay: "0.5s" }}>
                        <Link
                            href="/auth/login"
                            className="group inline-flex items-center gap-3 px-10 py-5 rounded-full bg-[var(--landing-dark)] text-[var(--landing-cream)] font-semibold text-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                        >
                            <FileText size={22} />
                            Get Started Free
                            <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                        </Link>
                        <Link
                            href="#how-it-works"
                            className="inline-flex items-center gap-2 px-10 py-5 rounded-full border border-[var(--landing-text-dark)]/10 bg-white text-[var(--landing-text-dark)] font-semibold text-xl hover:border-[var(--landing-text-dark)]/30 transition-all duration-300 shadow-sm hover:shadow"
                        >
                            See How it Works
                        </Link>
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

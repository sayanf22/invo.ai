"use client"

import { useScrollReveal } from "@/hooks/use-scroll-reveal"

const companies = [
    "Stripe", "Shopify", "Notion", "Figma", "Linear", "Vercel",
    "Intercom", "Loom", "Mercury", "Brex", "Ramp", "Deel",
]

export function TrustedBy() {
    const { ref, revealed } = useScrollReveal()

    return (
        <section ref={ref} className="py-12 px-4 sm:px-6">
            <div
                className={`max-w-[1400px] mx-auto bg-[var(--landing-green)] rounded-[2.5rem] sm:rounded-[3.5rem] py-20 sm:py-32 px-6 relative overflow-hidden transition-all duration-1000 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                    }`}
            >
                {/* Background texture for depth */}
                <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />

                {/* Subtle radial gradient */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[var(--landing-green-light)]/20 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 text-center">
                    <p className="text-base sm:text-lg font-medium text-emerald-100/40 mb-16 tracking-[0.2em] uppercase">
                        Trusted by forward-thinking teams
                    </p>

                    <div className="max-w-7xl mx-auto overflow-hidden relative">
                        {/* Edge fades - wider and smoother */}
                        <div className="absolute left-0 top-0 bottom-0 w-32 sm:w-48 bg-gradient-to-r from-[var(--landing-green)] to-transparent z-10" />
                        <div className="absolute right-0 top-0 bottom-0 w-32 sm:w-48 bg-gradient-to-l from-[var(--landing-green)] to-transparent z-10" />

                        <div className="animate-marquee flex gap-24 sm:gap-32 items-center whitespace-nowrap py-4">
                            {[...companies, ...companies].map((name, i) => (
                                <span
                                    key={i}
                                    className="text-3xl sm:text-4xl md:text-5xl font-bold text-emerald-100/20 tracking-tight select-none hover:text-emerald-100/40 transition-colors duration-500 cursor-default"
                                >
                                    {name}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

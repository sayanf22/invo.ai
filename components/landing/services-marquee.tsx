"use client"

import { motion } from "framer-motion"

interface ServicesMarqueeProps {
    className?: string
}

export function ServicesMarquee({ className }: ServicesMarqueeProps) {
    const services = [
        "Invoices", "Contracts", "Proposals", "Quotations",
        "NDAs", "SOWs", "Change Orders",
        "Onboarding Forms", "Payment Reminders",
    ]

    // Duplicate 4x for seamless loop
    const items = [...services, ...services, ...services, ...services]

    return (
        <div className={`w-full bg-[#0f3d2e] overflow-hidden rounded-2xl sm:rounded-3xl border-[2.5px] border-[var(--landing-dark)] shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] ${className}`}>
            {/* Tagline */}
            <p className="text-center text-xs sm:text-sm text-white/70 font-semibold tracking-widest uppercase pt-8 sm:pt-10 pb-4 px-4">
                9 document types, one platform — works wherever you do
            </p>

            {/* Scrolling strip */}
            <div className="relative py-4 sm:py-6 overflow-hidden">
                {/* Left fade */}
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 sm:w-36 z-10"
                    style={{ background: "linear-gradient(to right, #0f3d2e, transparent)" }} />
                {/* Right fade */}
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 sm:w-36 z-10"
                    style={{ background: "linear-gradient(to left, #0f3d2e, transparent)" }} />

                <motion.div
                    initial={{ x: 0 }}
                    animate={{ x: "-50%" }}
                    transition={{
                        repeat: Infinity,
                        ease: "linear",
                        duration: 35,
                    }}
                    className="inline-flex items-center whitespace-nowrap"
                >
                    {items.map((service, i) => (
                        <span key={i} className="inline-flex items-center gap-5 sm:gap-8 px-4 sm:px-6">
                            <span className={`text-xl sm:text-3xl font-bold tracking-tight ${
                                i % 3 === 0
                                    ? "text-white"
                                    : i % 3 === 1
                                    ? "text-[#3dba84] italic font-serif"
                                    : "text-white/70"
                            }`}>
                                {service}
                            </span>
                            {/* Dot separator */}
                            <span className="w-2 h-2 rounded-full bg-[#3dba84]/60 shrink-0" />
                        </span>
                    ))}
                </motion.div>
            </div>

            <div className="pb-8 sm:pb-10" />
        </div>
    )
}

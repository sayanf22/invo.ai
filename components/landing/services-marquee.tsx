"use client"

import { motion } from "framer-motion"

interface ServicesMarqueeProps {
    className?: string
}

export function ServicesMarquee({ className }: ServicesMarqueeProps) {
    const services = [
        "Invoices", "Contracts", "Quotations", "Proposals",
        "Quotes", "Receipts", "Memos", "Reports", "Briefs"
    ]

    return (
        <div className={`overflow-hidden pointer-events-none w-full ${className}`}>
            <div className="whitespace-nowrap py-5 sm:py-6 bg-[#111111] text-[var(--landing-cream)] shadow-2xl">
                <motion.div
                    initial={{ x: 0 }}
                    animate={{ x: "-50%" }}
                    transition={{
                        repeat: Infinity,
                        ease: "linear",
                        duration: 40
                    }}
                    className="inline-flex gap-16 items-center pr-16"
                >
                    {[...services, ...services, ...services, ...services].map((service, i) => (
                        <div key={i} className="flex items-center gap-16">
                            <span className={`font-serif text-3xl sm:text-4xl tracking-tight ${i % 2 === 0 ? 'text-[var(--landing-amber)] italic' : 'text-[var(--landing-cream)]'}`}>
                                {service}
                            </span>
                            <div className="w-2 h-2 rounded-full bg-[var(--landing-amber)] animate-pulse" />
                        </div>
                    ))}
                </motion.div>
            </div>
        </div>
    )
}

"use client"

import { motion } from "framer-motion"
import { useEffect, useState, useRef } from "react"
import { useInView } from "framer-motion"

const stats = [
    {
        label: "Hours saved weekly",
        detail: "Per user on average",
        value: 12,
        suffix: "+",
        duration: 2.5,
        bg: "bg-[#8B9A6B]",
        icon: (
            <svg viewBox="0 0 64 64" fill="none" className="w-10 h-10 sm:w-12 sm:h-12">
                <circle cx="32" cy="32" r="18" stroke="#1a1a1a" strokeWidth="2.5" />
                <line x1="32" y1="18" x2="32" y2="32" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="32" y1="32" x2="42" y2="38" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="32" cy="32" r="2" fill="#1a1a1a" />
            </svg>
        ),
    },
    {
        label: "Faster than manual",
        detail: "Document creation speed",
        value: 10,
        suffix: "×",
        duration: 2,
        bg: "bg-[#C4A0B0]",
        icon: (
            <svg viewBox="0 0 64 64" fill="none" className="w-10 h-10 sm:w-12 sm:h-12">
                <path d="M20 44L32 16L44 44" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="24" y1="36" x2="40" y2="36" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M32 16L36 24" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            </svg>
        ),
    },
    {
        label: "Accuracy rate",
        detail: "AI-generated documents",
        value: 99,
        suffix: "%",
        duration: 2,
        bg: "bg-[#B5C8BA]",
        icon: (
            <svg viewBox="0 0 64 64" fill="none" className="w-10 h-10 sm:w-12 sm:h-12">
                <circle cx="32" cy="32" r="18" stroke="#1a1a1a" strokeWidth="2.5" />
                <path d="M24 32L30 38L42 26" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    {
        label: "Documents generated",
        detail: "Across all users",
        value: 10,
        suffix: "k+",
        duration: 1.5,
        bg: "bg-[#C9BDA8]",
        icon: (
            <svg viewBox="0 0 64 64" fill="none" className="w-10 h-10 sm:w-12 sm:h-12">
                <rect x="18" y="14" width="22" height="30" rx="2" stroke="#1a1a1a" strokeWidth="2.5" />
                <path d="M24 22H34" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
                <path d="M24 28H32" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
                <path d="M24 34H30" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
                <rect x="26" y="20" width="20" height="28" rx="2" stroke="#1a1a1a" strokeWidth="2" opacity="0.3" />
            </svg>
        ),
    },
]

function Counter({ from, to, duration, suffix }: { from: number; to: number; duration: number; suffix: string }) {
    const nodeRef = useRef<HTMLSpanElement>(null)
    const inView = useInView(nodeRef, { once: true, margin: "-50px" })
    const [hasAnimated, setHasAnimated] = useState(false)

    useEffect(() => {
        if (!inView || hasAnimated) return
        const node = nodeRef.current
        let startTime: number | null = null
        let raf: number
        const step = (ts: number) => {
            if (!startTime) startTime = ts
            const progress = Math.min((ts - startTime) / (duration * 1000), 1)
            const eased = 1 - Math.pow(1 - progress, 4)
            const current = Math.floor(from + (to - from) * eased)
            if (node) node.textContent = current.toLocaleString() + suffix
            if (progress < 1) raf = requestAnimationFrame(step)
            else setHasAnimated(true)
        }
        raf = requestAnimationFrame(step)
        return () => cancelAnimationFrame(raf)
    }, [inView, from, to, duration, suffix, hasAnimated])

    return (
        <span
            ref={nodeRef}
            className="font-display font-bold text-[1.75rem] sm:text-3xl md:text-4xl text-[var(--landing-text-dark)] tabular-nums tracking-tight leading-none"
        >
            0{suffix}
        </span>
    )
}

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    }),
}

export function StatsSection() {
    return (
        <section className="py-14 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)]">
            <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={i}
                            custom={i}
                            variants={cardVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-40px" }}
                            className="rounded-2xl sm:rounded-3xl bg-white border border-stone-100/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
                        >
                            {/* Colored icon area — like Claude's course card headers */}
                            <div className={`${stat.bg} flex items-center justify-center py-6 sm:py-8`}>
                                {stat.icon}
                            </div>

                            {/* Content area */}
                            <div className="p-3.5 sm:p-5">
                                <Counter from={0} to={stat.value} duration={stat.duration} suffix={stat.suffix} />
                                <p className="mt-1 text-[13px] sm:text-sm font-semibold text-[var(--landing-text-dark)]">
                                    {stat.label}
                                </p>
                                <p className="mt-0.5 text-[11px] sm:text-xs text-[var(--landing-text-muted)]">
                                    {stat.detail}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

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
        bg: "#8B9A6B",
        icon: (
            <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
                <circle cx="24" cy="24" r="14" stroke="#1a1a1a" strokeWidth="2" />
                <line x1="24" y1="13" x2="24" y2="24" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
                <line x1="24" y1="24" x2="32" y2="29" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
                <circle cx="24" cy="24" r="1.5" fill="#1a1a1a" />
            </svg>
        ),
    },
    {
        label: "Faster than manual",
        detail: "Document creation speed",
        value: 10,
        suffix: "×",
        duration: 2,
        bg: "#C4A0B0",
        icon: (
            <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
                <path d="M14 34L24 12L34 34" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="18" y1="28" x2="30" y2="28" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        label: "Accuracy rate",
        detail: "AI-generated documents",
        value: 99,
        suffix: "%",
        duration: 2,
        bg: "#B5C8BA",
        icon: (
            <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
                <circle cx="24" cy="24" r="14" stroke="#1a1a1a" strokeWidth="2" />
                <path d="M17 24L22 29L32 19" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    {
        label: "Documents generated",
        detail: "Across all users",
        value: 10,
        suffix: "k+",
        duration: 1.5,
        bg: "#C9BDA8",
        icon: (
            <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
                <rect x="12" y="8" width="18" height="26" rx="2" stroke="#1a1a1a" strokeWidth="2" />
                <path d="M17 16H25" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M17 21H23" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M17 26H21" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="18" y="14" width="18" height="26" rx="2" stroke="#1a1a1a" strokeWidth="1.5" opacity="0.25" />
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
            className="font-display font-bold text-4xl sm:text-5xl text-[var(--landing-text-dark)] tabular-nums tracking-tight leading-none"
        >
            0{suffix}
        </span>
    )
}

const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    }),
}

export function StatsSection() {
    return (
        <section className="py-14 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)]">
            <div className="max-w-4xl mx-auto">
                {/* Single column on mobile, 2x2 grid on tablet+  */}
                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 sm:gap-5">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={i}
                            custom={i}
                            variants={cardVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-40px" }}
                            className="rounded-3xl bg-white border border-stone-100/80 overflow-hidden shadow-sm"
                        >
                            {/* Colored icon banner */}
                            <div
                                className="flex items-center justify-center py-10 sm:py-12"
                                style={{ backgroundColor: stat.bg }}
                            >
                                {stat.icon}
                            </div>

                            {/* Content */}
                            <div className="px-5 py-5 sm:px-6 sm:py-6">
                                <Counter from={0} to={stat.value} duration={stat.duration} suffix={stat.suffix} />
                                <p className="mt-2 text-[15px] font-semibold text-[var(--landing-text-dark)] leading-snug">
                                    {stat.label}
                                </p>
                                <p className="mt-0.5 text-[13px] text-[var(--landing-text-muted)]">
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

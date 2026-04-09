"use client"

import { motion } from "framer-motion"
import { useEffect, useState, useRef } from "react"
import { useInView } from "framer-motion"
import { Clock, Zap, ShieldCheck, FileText } from "lucide-react"

const stats = [
    {
        label: "Hours saved weekly",
        detail: "Per user on average",
        value: 12,
        suffix: "+",
        duration: 2.5,
        bg: "bg-[#8B9A6B]",
        Icon: Clock,
    },
    {
        label: "Faster than manual",
        detail: "Document creation speed",
        value: 10,
        suffix: "×",
        duration: 2,
        bg: "bg-[#C4A0B0]",
        Icon: Zap,
    },
    {
        label: "Accuracy rate",
        detail: "AI-generated documents",
        value: 99,
        suffix: "%",
        duration: 2,
        bg: "bg-[#B5C8BA]",
        Icon: ShieldCheck,
    },
    {
        label: "Documents generated",
        detail: "Across all users",
        value: 10,
        suffix: "k+",
        duration: 1.5,
        bg: "bg-[#C9BDA8]",
        Icon: FileText,
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
        <span ref={nodeRef} className="font-display font-bold text-5xl sm:text-6xl text-[var(--landing-text-dark)] tabular-nums tracking-tight leading-none">
            0{suffix}
        </span>
    )
}

const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    }),
}

export function StatsSection() {
    return (
        <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)]">
            <div className="max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-4 sm:gap-5">
                {stats.map((stat, i) => {
                    const Icon = stat.Icon
                    return (
                        <motion.div
                            key={i}
                            custom={i}
                            variants={cardVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-40px" }}
                            className="flex items-center gap-5 sm:gap-6 rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-7 shadow-[0_2px_20px_-4px_rgba(0,0,0,0.08)] border border-stone-100/60"
                        >
                            {/* Rounded icon badge */}
                            <div className={`${stat.bg} shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-md`}>
                                <Icon className="w-7 h-7 sm:w-9 sm:h-9 text-white" strokeWidth={1.8} />
                            </div>

                            {/* Text content */}
                            <div className="flex-1 min-w-0">
                                <Counter from={0} to={stat.value} duration={stat.duration} suffix={stat.suffix} />
                                <p className="mt-1 text-base sm:text-lg font-semibold text-[var(--landing-text-dark)] leading-snug">
                                    {stat.label}
                                </p>
                                <p className="mt-0.5 text-sm text-[var(--landing-text-muted)]">
                                    {stat.detail}
                                </p>
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </section>
    )
}

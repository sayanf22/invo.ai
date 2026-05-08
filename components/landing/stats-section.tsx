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
            if (node) node.textContent = current.toLocaleString()
            if (progress < 1) raf = requestAnimationFrame(step)
            else setHasAnimated(true)
        }
        raf = requestAnimationFrame(step)
        return () => cancelAnimationFrame(raf)
    }, [inView, from, to, duration, hasAnimated])

    return (
        <div className="flex items-baseline font-serif text-[4rem] sm:text-[5.5rem] text-[#1C1A17] tracking-tight leading-[1.1]">
            <span ref={nodeRef} className="font-bold tabular-nums">0</span>
            <span className="font-light ml-1 opacity-60 text-[#1C1A17]">{suffix}</span>
        </div>
    )
}

const cardVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.97 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
    },
}

export function StatsSection() {
    return (
        <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)] relative overflow-hidden">
            <div className="max-w-4xl mx-auto flex flex-col gap-6 sm:gap-10 relative z-10">
                
                <div className="text-center mb-4 sm:mb-8">
                    <h2 className="font-serif text-4xl sm:text-5xl font-bold text-[#1C1A17] tracking-tight">
                        The impact of automation
                    </h2>
                </div>

                {stats.map((stat, i) => {
                    const Icon = stat.Icon
                    return (
                        <motion.div
                            key={i}
                            variants={cardVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.4 }}
                            className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10 rounded-[2rem] sm:rounded-[3rem] bg-white p-8 sm:p-12 shadow-[0_20px_60px_-15px_rgba(28,26,23,0.08)] border border-stone-200/60 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-500"
                        >
                            {/* Subtle hover glow on light mode */}
                            <div className={`absolute top-1/2 left-12 -translate-y-1/2 w-32 h-32 ${stat.bg} rounded-full blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none`} />

                            {/* Rounded icon badge */}
                            <div className={`${stat.bg} shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-[1.5rem] sm:rounded-[2.5rem] flex items-center justify-center shadow-md z-10`}>
                                <Icon className="w-12 h-12 sm:w-14 sm:h-14 text-white" strokeWidth={1.5} />
                            </div>

                            {/* Text content */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center z-10">
                                <Counter from={0} to={stat.value} duration={stat.duration} suffix={stat.suffix} />
                                <p className="mt-2 text-lg sm:text-xl font-bold text-[#1C1A17] leading-tight">
                                    {stat.label}
                                </p>
                                <p className="mt-1 text-sm sm:text-base text-[#5B5550] font-medium">
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

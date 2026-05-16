"use client"

import { motion } from "framer-motion"
import { useEffect, useState, useRef } from "react"
import { useInView } from "framer-motion"
import { Clock, Zap, ShieldCheck, FileText } from "lucide-react"

const stats = [
    {
        label: "Hours lost monthly",
        detail: "Average for freelancers on manual invoicing",
        value: 5,
        suffix: "+",
        duration: 2.5,
        bg: "bg-[#8B9A6B]",
        Icon: Clock,
    },
    {
        label: "Higher cash-flow risk",
        detail: "For businesses with late or incorrect invoices",
        value: 3,
        suffix: "×",
        duration: 2,
        bg: "bg-[#C4A0B0]",
        Icon: Zap,
    },
    {
        label: "Compliance error rate",
        detail: "When tax rules are applied manually",
        value: 22,
        suffix: "%",
        duration: 2,
        bg: "bg-[#B5C8BA]",
        Icon: ShieldCheck,
    },
    {
        label: "Document types supported",
        detail: "All your business needs, one platform",
        value: 9,
        suffix: "",
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
                        The cost of manual documents
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
                            className="flex flex-row sm:flex-row items-center gap-5 sm:gap-10 rounded-2xl sm:rounded-[3rem] bg-white p-5 sm:p-12 border-[2.5px] border-[var(--landing-dark)] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] relative overflow-hidden group hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] transition-[transform,box-shadow] duration-500 cursor-default"
                        >
                            {/* Subtle hover glow on light mode */}
                            <div className={`absolute top-1/2 left-12 -translate-y-1/2 w-32 h-32 ${stat.bg} rounded-full blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none`} />

                            {/* Rounded icon badge */}
                            <div className={`${stat.bg} shrink-0 w-16 h-16 sm:w-32 sm:h-32 rounded-xl sm:rounded-[2.5rem] flex items-center justify-center shadow-md z-10`}>
                                <Icon className="w-8 h-8 sm:w-14 sm:h-14 text-white" strokeWidth={1.5} />
                            </div>

                            {/* Text content */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center z-10">
                                <Counter from={0} to={stat.value} duration={stat.duration} suffix={stat.suffix} />
                                <p className="mt-1 text-base sm:text-xl font-bold text-[#1C1A17] leading-tight">
                                    {stat.label}
                                </p>
                                <p className="mt-0.5 text-xs sm:text-base text-[#5B5550] font-medium">
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

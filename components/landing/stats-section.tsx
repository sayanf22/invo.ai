"use client"

import { motion } from "framer-motion"
import { useEffect, useState, useRef } from "react"
import { useInView } from "framer-motion"
import { Clock, Zap, Target, FileText } from "lucide-react"

const stats = [
    {
        label: "Hours saved weekly",
        value: 12,
        suffix: "+",
        duration: 2.5,
        icon: Clock,
        color: "bg-orange-50 text-[#e07b39]",
    },
    {
        label: "Faster than manual",
        value: 10,
        suffix: "×",
        duration: 2,
        icon: Zap,
        color: "bg-emerald-50 text-emerald-600",
    },
    {
        label: "Accuracy rate",
        value: 99,
        suffix: "%",
        duration: 2,
        icon: Target,
        color: "bg-blue-50 text-blue-600",
    },
    {
        label: "Documents generated",
        value: 10,
        suffix: "k+",
        duration: 1.5,
        icon: FileText,
        color: "bg-purple-50 text-purple-600",
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

    return <span ref={nodeRef} className="font-display font-bold text-[2rem] sm:text-4xl md:text-5xl text-[var(--landing-text-dark)] tabular-nums tracking-tight leading-none">0{suffix}</span>
}

const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    }),
}

export function StatsSection() {
    return (
        <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)]">
            <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                    {stats.map((stat, i) => {
                        const Icon = stat.icon
                        return (
                            <motion.div
                                key={i}
                                custom={i}
                                variants={cardVariants}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true, margin: "-40px" }}
                                className="relative rounded-2xl sm:rounded-3xl bg-white border border-stone-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                            >
                                <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-3 sm:mb-4 ${stat.color}`}>
                                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <Counter from={0} to={stat.value} duration={stat.duration} suffix={stat.suffix} />
                                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium text-[var(--landing-text-muted)] leading-snug">
                                    {stat.label}
                                </p>
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

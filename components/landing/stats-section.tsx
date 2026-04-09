"use client"

import { motion } from "framer-motion"
import { useEffect, useState, useRef } from "react"
import { useInView } from "framer-motion"

// Revised stats: Higher impact, time-focused, no "customer base" or "countries"
const stats = [
    { label: "Hours Saved Weekly", value: 12, suffix: "+", duration: 2.5 },
    { label: "Faster Documentation", value: 10, suffix: "x", duration: 2 },
    { label: "Accuracy Rate", value: 99, suffix: "%", duration: 2 },
    { label: "Documents Generated", value: 10, suffix: "k+", duration: 1.5 },
]

function Counter({ from, to, duration, suffix }: { from: number; to: number; duration: number; suffix: string }) {
    const nodeRef = useRef<HTMLSpanElement>(null)
    const inView = useInView(nodeRef, { once: true, margin: "-50px" })
    const [hasAnimated, setHasAnimated] = useState(false)

    useEffect(() => {
        if (!inView || hasAnimated) return

        const node = nodeRef.current
        let startTime: number | null = null
        let animationFrameId: number

        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)

            // Smoother easing: easeOutQuart
            const easeProgress = 1 - Math.pow(1 - progress, 4)

            const current = Math.floor(from + (to - from) * easeProgress)

            if (node) {
                node.textContent = current.toLocaleString() + suffix
            }

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(step)
            } else {
                setHasAnimated(true)
            }
        }

        animationFrameId = requestAnimationFrame(step)
        return () => cancelAnimationFrame(animationFrameId)
    }, [inView, from, to, duration, suffix, hasAnimated])

    return <span ref={nodeRef} className="font-display font-bold text-3xl sm:text-5xl md:text-6xl lg:text-7xl text-[var(--landing-text-dark)] tabular-nums tracking-tight">0{suffix}</span>
}

export function StatsSection() {
    return (
        <section className="py-24 px-6 sm:px-10 bg-white border-b border-stone-100">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 sm:gap-12">
                    {stats.map((stat, i) => (
                        <div key={i} className="text-center group">
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <Counter from={0} to={stat.value} duration={stat.duration} suffix={stat.suffix} />
                                <p className="mt-3 text-sm sm:text-base font-bold text-[var(--landing-text-muted)] uppercase tracking-widest">
                                    {stat.label}
                                </p>
                            </motion.div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

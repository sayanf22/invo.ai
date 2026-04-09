"use client"

import { motion } from "framer-motion"
import { Star, ArrowLeft, ArrowRight } from "lucide-react"
import { useState } from "react"

// Using placeholder avatars for now
const testimonials = [
    {
        name: "Sarah Chen",
        role: "Product Manager at TechFlow",
        content: "I used to spend hours drafting PRDs and release notes. with Clorefy, I just talk through my ideas during my commute, and by the time I'm at my desk, the documents are ready.",
        rating: 5,
        avatar: "https://i.pravatar.cc/150?u=sarah"
    },
    {
        name: "James Wilson",
        role: "Legal Consultant",
        content: "The accuracy is astounding. It handles legal terminology perfectly and formats contracts exactly how I need them. It's like having a paralegal in my pocket.",
        rating: 5,
        avatar: "https://i.pravatar.cc/150?u=james"
    },
    {
        name: "Maria Garcia",
        role: "Freelance Designer",
        content: "Invoicing was the bane of my existence. Now I just say 'Invoice client X for 5 hours of design work at $100/hr', and it's sent. Changed my life.",
        rating: 5,
        avatar: "https://i.pravatar.cc/150?u=maria"
    },
    {
        name: "David Kim",
        role: "Startup Founder",
        content: "We use Clorefy for everything — meeting minutes, investor updates, hiring contracts. It's the operating system for our documentation.",
        rating: 5,
        avatar: "https://i.pravatar.cc/150?u=david"
    }
]

export function TestimonialsSection() {
    const [currentIndex, setCurrentIndex] = useState(0)

    const next = () => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }

    const prev = () => {
        setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
    }

    return (
        <section className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-10 bg-white overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-end justify-between gap-8 mb-20">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="font-display text-3xl sm:text-4xl lg:text-6xl font-bold mb-4">
                            Loved by <span className="text-[var(--landing-amber)] italic font-serif">builders</span>
                        </h2>
                        <p className="text-xl text-[var(--landing-text-muted)]">
                            Join thousands of professionals who improved their workflow.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="flex gap-4"
                    >
                        <button
                            onClick={prev}
                            className="w-14 h-14 rounded-full border border-stone-200 flex items-center justify-center hover:bg-[var(--landing-dark)] hover:text-white hover:border-[var(--landing-dark)] transition-all duration-300"
                            aria-label="Previous testimonial"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <button
                            onClick={next}
                            className="w-14 h-14 rounded-full border border-stone-200 flex items-center justify-center hover:bg-[var(--landing-dark)] hover:text-white hover:border-[var(--landing-dark)] transition-all duration-300"
                            aria-label="Next testimonial"
                        >
                            <ArrowRight size={24} />
                        </button>
                    </motion.div>
                </div>

                <div className="relative">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-8"
                    >
                        {[0, 1].map((offset) => {
                            const index = (currentIndex + offset) % testimonials.length
                            const t = testimonials[index]
                            return (
                                <motion.div
                                    key={`${currentIndex}-${offset}`}
                                    initial={{ opacity: 0, x: 50 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.5, delay: offset * 0.1 }}
                                    className="p-10 rounded-[3rem] bg-[var(--landing-cream)] border border-stone-100 flex flex-col justify-between min-h-[400px]"
                                >
                                    <div>
                                        <div className="flex gap-1 mb-8 text-[var(--landing-amber)]">
                                            {[...Array(t.rating)].map((_, i) => (
                                                <Star key={i} size={20} fill="currentColor" />
                                            ))}
                                        </div>
                                        <p className="font-display text-2xl sm:text-3xl leading-snug font-medium mb-8">
                                            &ldquo;{t.content}&rdquo;
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-stone-200 overflow-hidden relative">
                                            {/* In a real app, use next/image here */}
                                            <div className="absolute inset-0 bg-stone-300 flex items-center justify-center text-stone-500 font-bold">
                                                {t.name[0]}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="font-bold text-lg">{t.name}</div>
                                            <div className="text-[var(--landing-text-muted)]">{t.role}</div>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </motion.div>
                </div>
            </div>
        </section>
    )
}

"use client"

import { motion } from "framer-motion"

const testimonials = [
    {
        name: "Priya Sharma",
        role: "Freelance Designer",
        content: "I used to spend 5 hours every month on invoicing alone. Now I describe what I need and Clorefy handles the GST calculation, formatting, and payment link. My clients pay faster too.",
    },
    {
        name: "Michael Torres",
        role: "Agency Founder",
        content: "We switched from HoneyBook because it only works in the US. Clorefy handles our UK and Singapore clients with the right tax rules automatically. One tool for everything.",
    },
    {
        name: "Elena Rodriguez",
        role: "Freelance Developer",
        content: "Writing SOWs was the bane of my existence. Now I type 'SOW for Finova, Next.js + Supabase, $18k, 3 milestones' and get a complete document with IP clauses and payment terms.",
    },
    {
        name: "Aisha Patel",
        role: "Consultant",
        content: "The compliance engine is what sold me. I work with clients in India, UAE, and the UK — Clorefy auto-applies the right tax rules for each country without me looking anything up.",
    },
    {
        name: "David Kim",
        role: "Startup Founder",
        content: "We used to need FreshBooks for invoices, PandaDoc for proposals, and a separate tool for contracts. Clorefy replaced all three — and it's faster because it remembers our business details.",
    },
    {
        name: "Sarah Chen",
        role: "Sales Consultant",
        content: "Sending a proposal 10 minutes after a discovery call while the lead is hot — that's what Clorefy gives us. Our close rate improved because we're faster than competitors.",
    }
]

export function TestimonialsSection() {
    return (
        <section className="py-24 sm:py-32 bg-[#1C1A17] overflow-hidden relative">
            <div className="absolute inset-0 bg-mesh-dark opacity-30 pointer-events-none" />
            
            <div className="text-center mb-16 sm:mb-24 relative z-10 px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative inline-block"
                >
                    <h2 className="font-serif text-5xl sm:text-7xl lg:text-[7.5rem] font-medium text-[#F4F0EB] tracking-tight leading-[0.95]">
                        Trusted by <br /> service businesses
                    </h2>
                </motion.div>
            </div>

            {/* Scrolling Marquee Row */}
            <div className="relative w-full flex overflow-x-hidden group pb-10 z-10">
                <div className="flex animate-marquee gap-5 px-2.5">
                    {[...testimonials, ...testimonials].map((t, i) => (
                        <div 
                            key={i} 
                            className="w-[300px] sm:w-[350px] shrink-0 bg-[#FBF9F6] rounded-[2rem] p-8 flex flex-col justify-center shadow-xl text-center min-h-[250px]"
                        >
                            <p className="text-[#1C1A17] text-sm sm:text-base font-medium leading-relaxed mb-8 px-2 flex-1 flex items-center justify-center">
                                &ldquo;{t.content}&rdquo;
                            </p>
                            
                            <div className="mt-auto">
                                <h4 className="font-bold text-[#1C1A17] text-xs sm:text-sm">{t.name}</h4>
                                <p className="text-[#86807B] text-[11px] sm:text-xs font-semibold mt-0.5 uppercase tracking-wide">{t.role}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

"use client"

import { motion } from "framer-motion"

const testimonials = [
    {
        name: "Priya Sharma",
        role: "Founder at Nova Design",
        content: "I used to spend my entire Friday afternoon creating invoices. With Clorefy, I just say 'Send my standard retainer invoice to Acme', and it's sent in 3 seconds.",
    },
    {
        name: "Michael Chang",
        role: "Legal Consultant",
        content: "The formatting accuracy is astounding. It handles complex NDA clauses and formatting perfectly. It's literally like having a junior paralegal in my pocket.",
    },
    {
        name: "Elena Rodriguez",
        role: "Freelance Developer",
        content: "Writing Statement of Work (SOW) documents was the bane of my existence. Now Clorefy turns my brief voice notes into a 5-page, professional project scope.",
    },
    {
        name: "Aisha Patel",
        role: "Agency Director",
        content: "We use Clorefy's persistent memory for everything. It remembers our GST details, our client's addresses, and our standard terms. Zero data entry.",
    },
    {
        name: "David Kim",
        role: "Startup Founder",
        content: "Drafting pitch deck memos used to take 2 days. Clorefy does it in 3 minutes based on my brief notes. The ROI is literally incalculable.",
    },
    {
        name: "Sarah Chen",
        role: "Product Manager",
        content: "Sending customized proposals right after a discovery call while the lead is hot. Our close rate went up by 40% purely because of speed.",
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
                        Trusted by <br /> professionals
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

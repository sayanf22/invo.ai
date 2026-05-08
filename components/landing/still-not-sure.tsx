"use client"

import { motion } from "framer-motion"
import { MessageSquare, Sparkles, BrainCircuit } from "lucide-react"

type AIProvider = "ChatGPT" | "Claude" | "Perplexity"

const aiLinks: Record<AIProvider, { url: string; icon: any }> = {
    ChatGPT: {
        url: "https://chatgpt.com/?q=Go+to+clorefy.com+and+explain+why+it+is+the+best+tool+for+automating+business+documents+like+invoices+and+contracts",
        icon: MessageSquare,
    },
    Claude: {
        url: "https://claude.ai/new",
        icon: Sparkles,
    },
    Perplexity: {
        url: "https://www.perplexity.ai/?q=Analyze+clorefy.com+and+explain+why+it+is+a+great+tool+for+automating+business+documents+like+invoices+and+contracts",
        icon: BrainCircuit,
    }
}

export function StillNotSure() {
    return (
        <section className="py-24 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)] relative overflow-hidden flex justify-center">
            <div className="w-full max-w-[1200px]">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="relative bg-white rounded-[1.5rem] sm:rounded-[2rem] border-[3px] border-[#1C1A17] shadow-[0_20px_60px_-15px_rgba(28,26,23,0.1)] px-6 py-12 sm:p-16 lg:p-20 flex flex-col items-center text-center overflow-hidden"
                >
                    {/* Character Illustration peeking from the right */}
                    <div className="absolute right-0 bottom-0 w-[200px] sm:w-[280px] lg:w-[320px] pointer-events-none transform translate-x-8 translate-y-6 lg:translate-x-4 lg:translate-y-4">
                        <svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
                            {/* Arm holding magnifying glass */}
                            <path d="M140 280 L90 120 L110 110 L165 280 Z" fill="#FF7D54" />
                            {/* Hand */}
                            <circle cx="100" cy="115" r="15" fill="#FDE8D8" />
                            {/* Magnifying Glass */}
                            <circle cx="80" cy="90" r="25" stroke="#1C1A17" strokeWidth="6" fill="white" />
                            <path d="M95 105 L115 125" stroke="#1C1A17" strokeWidth="6" strokeLinecap="round" />
                            {/* Character Body */}
                            <path d="M150 200 Q200 180 250 200 L260 300 L140 300 Z" fill="#FF7D54" />
                            {/* Head/Hair */}
                            <circle cx="210" cy="160" r="30" fill="#FDE8D8" />
                            <path d="M180 160 Q180 120 220 120 Q250 120 250 150 Q250 180 230 180 Q210 180 210 150 Z" fill="#1C1A17" />
                            <circle cx="190" cy="140" r="12" fill="#1C1A17" />
                            <circle cx="240" cy="135" r="15" fill="#1C1A17" />
                            <circle cx="230" cy="170" r="14" fill="#1C1A17" />
                        </svg>
                    </div>

                    <div className="relative z-10 max-w-2xl flex flex-col items-center">
                        <h2 className="font-display text-2xl sm:text-3xl lg:text-[2.5rem] font-bold uppercase tracking-tight text-[#1C1A17] mb-4 sm:mb-6 leading-tight">
                            STILL NOT SURE THAT CLOREFY IS RIGHT FOR YOU?
                        </h2>
                        
                        <p className="text-base sm:text-lg text-[#5B5550] font-medium mb-10 max-w-[600px] leading-relaxed">
                            Let ChatGPT, Claude, or Perplexity do the thinking for you.<br className="hidden sm:block" />
                            Click a button and see what your favorite AI says about Clorefy.
                        </p>

                        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 sm:gap-6 w-full sm:w-auto">
                            {(["ChatGPT", "Claude", "Perplexity"] as AIProvider[]).map((ai) => {
                                const Icon = aiLinks[ai].icon;
                                return (
                                    <a
                                        key={ai}
                                        href={aiLinks[ai].url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border-[2px] border-[#1C1A17] bg-[#F3E8FF] hover:bg-[#EADDFF] transition-colors font-bold text-sm sm:text-base text-[#1C1A17] w-full sm:w-auto shadow-sm"
                                    >
                                        <Icon size={18} strokeWidth={2.5} />
                                        Ask {ai}
                                    </a>
                                )
                            })}
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

"use client"

import Link from "next/link"
import { FileText, Mic, Paperclip, ArrowUp, CheckCircle2 } from "lucide-react"
import { motion } from "framer-motion"

export function WhyNotChatGPT() {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-10 bg-[#FAFAF9]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

          {/* Left: UI Mockup Card — High Contrast SaaS UI */}
          <div className="w-full lg:w-1/2 flex justify-center perspective-[2000px]">
            <motion.div 
                initial={{ opacity: 0, rotateY: -10, x: -30 }}
                whileInView={{ opacity: 1, rotateY: 0, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[500px] relative"
            >
              
              {/* Document Popout Preview (Sliding out from behind) */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: -60, opacity: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-0 right-0 left-12 h-64 bg-white rounded-xl border-[2.5px] border-[var(--landing-dark)] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] -z-10 p-6 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[#1C1A17] flex items-center justify-center text-white">
                    <FileText size={14} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1C1A17]">Invoice_AcmeCorp.pdf</h4>
                    <p className="text-xs text-[#86807B]">Generated • Ready to send</p>
                  </div>
                </div>
                <div className="flex-1 bg-[#FAFAF9] rounded-lg border border-black/5 p-4 relative overflow-hidden">
                  <div className="w-1/3 h-2 bg-black/10 rounded mb-4" />
                  <div className="w-full h-1 bg-black/5 rounded mb-2" />
                  <div className="w-5/6 h-1 bg-black/5 rounded mb-2" />
                  <div className="w-4/6 h-1 bg-black/5 rounded mb-6" />
                  
                  <div className="w-full h-12 bg-white rounded border border-black/5 mb-2" />
                  <div className="w-full h-12 bg-white rounded border border-black/5" />
                  
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#FAFAF9] to-transparent" />
                </div>
              </motion.div>

              {/* Main AI Chat Interface */}
              <div className="bg-white rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] overflow-hidden border-[3px] border-[var(--landing-dark)] relative z-10">

                {/* Card top bar */}
                <div className="px-6 pt-6 pb-5 border-b border-stone-100 bg-[#FAFAF9]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--landing-amber)] absolute -left-1 -top-1 animate-ping opacity-75" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--landing-amber)] shadow-[0_0_10px_rgba(198,122,60,0.4)]" />
                    </div>
                    <p className="text-[12px] font-bold text-[#1C1A17] uppercase tracking-widest flex-1">
                      Clorefy Copilot
                    </p>
                  </div>
                  <p className="text-[15px] leading-[1.75] text-[#5B5550] font-medium">
                    Generating document for{" "}
                    <span className="text-[#1C1A17] font-bold bg-stone-200/50 px-1.5 py-0.5 rounded">Acme Corp</span>. Found matching
                    client in CRM. Extracting{" "}
                    <span className="text-[var(--landing-amber)] font-semibold">billing address</span> and
                    tax rules. Adding $5,000 line item. Formatting as PDF.
                  </p>
                </div>

                {/* Auto-applied context pills — Animated row */}
                <div className="px-6 py-5 flex flex-wrap gap-2.5 border-b border-stone-100 bg-white">
                  {[
                    { text: "Auto-filled GSTIN", delay: 0.5 },
                    { text: "Calculated 18% Tax", delay: 0.7 },
                    { text: "Applied Net-30 Terms", delay: 0.9 }
                  ].map((pill, idx) => (
                    <motion.span 
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      whileInView={{ opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: pill.delay, duration: 0.4, type: "spring" }}
                      className="inline-flex items-center gap-1.5 bg-[var(--landing-amber)]/10 text-[var(--landing-amber)] text-xs font-bold px-3 py-1.5 rounded-full border border-[var(--landing-amber)]/20 shadow-sm"
                    >
                      <CheckCircle2 size={12} className="text-[var(--landing-amber)]" />
                      {pill.text}
                    </motion.span>
                  ))}
                </div>

                {/* Input area */}
                <div className="p-4 bg-white">
                  <div className="bg-[#FAFAF9] border border-stone-200 rounded-2xl p-2 relative shadow-inner">
                    <p className="text-[15px] text-[#1C1A17] pl-3 pt-2 pb-6 font-medium">
                      &ldquo;Invoice Acme 5k for web design.&rdquo;
                    </p>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex gap-1">
                        <button className="p-2 text-stone-400 hover:text-[#1C1A17] transition-colors rounded-lg hover:bg-stone-200/50">
                          <Mic size={18} />
                        </button>
                        <button className="p-2 text-stone-400 hover:text-[#1C1A17] transition-colors rounded-lg hover:bg-stone-200/50">
                          <Paperclip size={18} />
                        </button>
                      </div>
                      <button className="w-9 h-9 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-white shadow-sm hover:bg-black transition-all hover:scale-105 active:scale-95">
                        <ArrowUp size={18} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>

          {/* Right: Copy */}
          <div className="w-full lg:w-1/2 flex flex-col items-start z-10">

            <h2 className="font-serif text-5xl sm:text-6xl lg:text-[4.5rem] font-medium text-[#1C1A17] mb-6 tracking-tight leading-[1.05]">
              Why not just <br />
              <span className="italic">ChatGPT?</span>
            </h2>

            <p className="text-[#5B5550] text-lg leading-relaxed mb-4 max-w-md font-medium">
              ChatGPT writes text. It hallucinates tax rates, ignores country-specific compliance
              rules, can&apos;t format a real invoice, and has no memory of your business details.
              You&apos;d still need 5 other tools that don&apos;t talk to each other — and uploading
              contracts to consumer AI risks confidentiality breaches with zero professional accountability.
            </p>

            <p className="text-[#5B5550] text-lg leading-relaxed mb-10 max-w-md">
              Clorefy generates compliant invoices, contracts, proposals, NDAs, SOWs, and more
              — with country-specific tax rules auto-applied for your location, your
              business details pre-filled, payment links attached, and professional formatting
              guaranteed. One platform, purpose-built for service businesses.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-[1rem] bg-[var(--landing-dark)] text-white font-bold text-base transition-all border-[2.5px] border-[var(--landing-dark)] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] w-full sm:w-auto overflow-hidden relative group"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center gap-2">
                  <FileText size={18} />
                  Try Clorefy Free
                </span>
              </Link>
              <a
                href="https://www.youtube.com/@Clorefy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-4 rounded-[1rem] bg-white text-[var(--landing-dark)] font-bold text-base border-[2.5px] border-[var(--landing-dark)] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] transition-all w-full sm:w-auto"
              >
                Watch Demo
              </a>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}

"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight, FileText } from "lucide-react"

export function WhyNotChatGPT() {

  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)] overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col-reverse lg:flex-row items-center gap-16 lg:gap-24">
          
          {/* Left Visual: The Magic Card */}
          <div className="w-full lg:w-1/2 relative flex justify-center">
            <div className="bg-gradient-to-br from-white via-[#FDFBF9] to-[#F2EAE1] rounded-[2.5rem] p-8 sm:p-10 w-full max-w-[550px] flex flex-col justify-between relative overflow-hidden shadow-[0_20px_60px_-15px_rgba(224,123,57,0.15)] border border-stone-200/50 min-h-[500px]">
              
              {/* Floating Pills representing Clorefy's automated context */}
              <motion.div 
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-12 left-8 bg-[#e07b39] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg rotate-[-5deg] z-20"
              >
                Auto-filled GSTIN
              </motion.div>

              <motion.div 
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute top-36 right-6 bg-[#e07b39] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg rotate-[4deg] z-20"
              >
                Calculated 18% Tax
              </motion.div>

              <motion.div 
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute bottom-40 left-6 sm:left-12 bg-[#e07b39] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg rotate-[-2deg] z-20"
              >
                Applied Net-30 Terms
              </motion.div>

              {/* Central Text Abstraction (The invisible work) */}
              <div className="mt-40 mb-8 relative z-10 text-[#86807B] text-[15px] leading-[1.8] font-medium pr-4 sm:pr-10">
                Generating document for <span className="text-[#1C1A17] font-bold">Acme Corp</span>. 
                Found matching client in CRM. Extracting <span className="text-[#e07b39] font-semibold">billing address</span> and tax rules. 
                Adding $5,000 line item for web design. Automatically formatting as a production-ready, localized PDF.
              </div>

              {/* Bottom Input Box */}
              <div className="relative z-10 mt-auto">
                <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xl">
                  <p className="text-[#1C1A17] text-sm font-semibold mb-8 ml-2">
                    "Invoice Acme 5k for web design."
                  </p>
                  <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                    <div className="flex gap-4 text-[#A39D98] ml-2">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#e07b39] flex items-center justify-center text-white shadow-md hover:bg-[#d46d2f] transition-colors cursor-pointer">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right Copy: Typography and Explanations */}
          <div className="w-full lg:w-1/2 flex flex-col items-start lg:pl-10">
            
            {/* Sunburst Decorative SVG */}
            <motion.div 
              initial={{ rotate: -45, opacity: 0 }}
              whileInView={{ rotate: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mb-8 flex items-center gap-3 text-[#1C1A17]"
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e07b39" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
              </svg>
            </motion.div>

            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-serif text-5xl sm:text-6xl lg:text-[4.5rem] font-medium text-[#1C1A17] mb-8 tracking-tight leading-[1.05]"
            >
              Why not just <br /> <span className="italic">ChatGPT?</span>
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-[#5B5550] text-lg sm:text-xl leading-relaxed mb-10 max-w-lg"
            >
              General AI doesn't know your business. Every time you need a document, you have to re-explain your company, your tax IDs, your client's details, and then spend 15 minutes formatting the text output into a PDF.
              <br /><br />
              Speak naturally and Clorefy instantly extracts the context. Rambled thoughts become clear, perfectly formatted, tax-compliant documents.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
            >
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white border border-stone-200 text-[#1C1A17] font-bold text-sm transition-all hover:bg-stone-50 shadow-sm"
              >
                <FileText size={16} className="text-[#1C1A17]" />
                Try Clorefy
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#EBE7DF] text-[#1C1A17] font-bold text-sm transition-all hover:bg-[#E0DBD0]"
              >
                Start for free
              </Link>
            </motion.div>

          </div>

        </div>
      </div>
    </section>
  )
}

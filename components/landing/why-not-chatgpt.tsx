"use client"

import Link from "next/link"
import { FileText } from "lucide-react"

export function WhyNotChatGPT() {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

          {/* Left: UI Mockup Card — static, clean, no overlapping */}
          <div className="w-full lg:w-1/2 flex justify-center">
            <div className="w-full max-w-[500px] bg-white rounded-[2rem] shadow-[0_24px_80px_-20px_rgba(28,26,23,0.12)] overflow-hidden">

              {/* Card top bar — log line */}
              <div className="px-6 pt-6 pb-4 border-b border-stone-100">
                <p className="text-[13px] font-semibold text-[#A39D98] uppercase tracking-widest mb-3">
                  Clorefy is working…
                </p>
                <p className="text-[15px] leading-[1.75] text-[#86807B] font-medium">
                  Generating document for{" "}
                  <span className="text-[#1C1A17] font-bold">Acme Corp</span>. Found matching
                  client in CRM. Extracting{" "}
                  <span className="text-[#e07b39] font-semibold">billing address</span> and
                  tax rules. Adding $5,000 line item for web design. Formatting as a
                  production-ready, localized PDF.
                </p>
              </div>

              {/* Auto-applied context pills — static row, no overlap */}
              <div className="px-6 py-4 flex flex-wrap gap-2 border-b border-stone-100">
                <span className="inline-flex items-center gap-1.5 bg-[#FFF4ED] text-[#e07b39] text-xs font-bold px-3.5 py-1.5 rounded-full border border-[#FDDCC6]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e07b39] inline-block" />
                  Auto-filled GSTIN
                </span>
                <span className="inline-flex items-center gap-1.5 bg-[#FFF4ED] text-[#e07b39] text-xs font-bold px-3.5 py-1.5 rounded-full border border-[#FDDCC6]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e07b39] inline-block" />
                  Calculated 18% Tax
                </span>
                <span className="inline-flex items-center gap-1.5 bg-[#FFF4ED] text-[#e07b39] text-xs font-bold px-3.5 py-1.5 rounded-full border border-[#FDDCC6]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e07b39] inline-block" />
                  Applied Net-30 Terms
                </span>
              </div>

              {/* Input area */}
              <div className="px-6 py-5">
                <p className="text-[15px] font-semibold text-[#1C1A17] mb-5">
                  &ldquo;Invoice Acme 5k for web design.&rdquo;
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                  <div className="flex gap-3.5 text-[#C4BEBC]">
                    {/* Microphone */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="22"/>
                    </svg>
                    {/* Paperclip */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                  </div>
                  <button className="w-8 h-8 rounded-full bg-[#e07b39] flex items-center justify-center text-white shadow-sm hover:bg-[#d46d2f] transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Right: Copy */}
          <div className="w-full lg:w-1/2 flex flex-col items-start">

            {/* Sunburst icon */}
            <div className="mb-7 text-[#e07b39]">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2"/><path d="M12 20v2"/>
                <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
                <path d="M2 12h2"/><path d="M20 12h2"/>
                <path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
              </svg>
            </div>

            <h2 className="font-serif text-5xl sm:text-6xl lg:text-[4.5rem] font-medium text-[#1C1A17] mb-6 tracking-tight leading-[1.05]">
              Why not just <br />
              <span className="italic">ChatGPT?</span>
            </h2>

            <p className="text-[#5B5550] text-lg leading-relaxed mb-4 max-w-md">
              General AI doesn&apos;t know your business. Every time you need a document, you have to
              re-explain your company, your tax IDs, your client&apos;s details — and then spend 15
              minutes formatting the output into a PDF.
            </p>

            <p className="text-[#5B5550] text-lg leading-relaxed mb-10 max-w-md">
              Speak naturally and Clorefy instantly extracts the context. Rambled thoughts become
              clear, perfectly formatted, tax-compliant documents.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[#1C1A17] text-white font-semibold text-sm transition-all hover:bg-[#2E2A24] shadow-sm"
              >
                <FileText size={15} />
                Try Clorefy
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-full bg-white text-[#1C1A17] font-semibold text-sm border border-stone-200 transition-all hover:bg-stone-50 shadow-sm"
              >
                Start for free
              </Link>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}

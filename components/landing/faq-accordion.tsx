"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"

export interface FaqItem {
  question: string
  answer: string
}

interface FaqAccordionProps {
  items: FaqItem[]
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {items.map((faq, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden bg-white"
          style={{ border: "1px solid #ebe8e3" }}
        >
          <h3>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between px-6 py-5 text-left font-semibold text-sm hover:bg-stone-50/80 transition-colors"
              style={{ color: "#1a1a1a" }}
              aria-expanded={openIndex === i}
            >
              <span>{faq.question}</span>
              <ChevronDown
                size={16}
                className={`transition-transform duration-300 shrink-0 ml-4 text-stone-400 ${openIndex === i ? "rotate-180" : ""}`}
              />
            </button>
          </h3>
          <motion.div
            initial={false}
            animate={{
              height: openIndex === i ? "auto" : 0,
              opacity: openIndex === i ? 1 : 0,
            }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 text-stone-500 text-sm leading-relaxed">
              {faq.answer}
            </p>
          </motion.div>
        </div>
      ))}
    </div>
  )
}

"use client"

import { Card } from "@/components/ui/card"
import { Loader } from "@/components/ui/loader"
import { useEffect, useRef, useState } from "react"

const THINKING_CONTENT = `Analyzing the request to understand the document type and requirements. I need to identify whether this is an invoice, contract, quotation, or proposal based on the user's description.

Checking the business profile data to pull in the correct sender information — company name, address, tax registration numbers, and contact details. This ensures the document header is accurate and professional.

Now I need to determine the recipient details from the prompt. The user mentioned a client name, so I'll structure the "Bill To" or "Prepared For" section accordingly. If any details are missing, I'll use reasonable defaults.

Looking up country-specific compliance requirements. Each country has different mandatory fields — for example, India requires GSTIN and HSN/SAC codes, while Germany needs USt-IdNr. I need to make sure all required tax fields are included.

Calculating line items based on the description. I need to parse quantities, rates, and descriptions for each service or product mentioned. Let me also check if there are any discounts or special pricing mentioned.

Computing tax calculations now. The tax rate depends on the country and document type. I need to apply the correct GST, VAT, or sales tax rate and calculate subtotals, tax amounts, and grand totals accurately.

Reviewing payment terms and conditions. Standard payment terms vary by country and industry — Net 30 is common in the US, while other regions may use different conventions. I'll include appropriate payment instructions.

Structuring the document sections — header with branding, recipient block, line items table, totals summary, terms and conditions, and footer with legal notices. Each section needs to follow the template structure for the selected style.

Running compliance validation checks. I need to verify that all mandatory fields are present, tax calculations are correct, and the document meets the regulatory requirements for the specified country.

Formatting currency values according to the locale. Different countries use different decimal separators and currency symbols — USD uses commas and periods, while EUR in Germany uses periods and commas.

Generating the final document structure with all fields populated. The JSON output needs to include every field the preview renderer expects — from basic info like document number and date to detailed line items and calculated totals.

Performing a final review of the generated document. Checking for consistency in naming, accurate math, proper formatting, and completeness of all required sections before sending the response.

Double-checking that payment method fields are only included if the user specifically requested them. I don't want to add bank details or payment instructions that weren't asked for.

Stripping any markdown formatting from text fields since the PDF renderer displays raw text. Asterisks, headers, and bullet points need to be converted to clean plain text.

Ensuring all line items have unique identifiers for the frontend to track them properly. Each item gets a generated ID if one wasn't provided.

Final validation pass — confirming the document type label is properly capitalized, all numeric fields are actual numbers not strings, and the response structure matches what the client expects.`

interface AIThinkingBlockProps {
  /** Label text shown next to the spinner */
  label?: string
}

export default function AIThinkingBlock({ label = "Clorefy is thinking" }: AIThinkingBlockProps) {
  const [scrollPosition, setScrollPosition] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [timer, setTimer] = useState(0)

  useEffect(() => {
    const timerInterval = setInterval(() => {
      setTimer((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timerInterval)
  }, [])

  useEffect(() => {
    if (contentRef.current) {
      const scrollHeight = contentRef.current.scrollHeight
      const clientHeight = contentRef.current.clientHeight
      const maxScroll = scrollHeight - clientHeight

      scrollIntervalRef.current = setInterval(() => {
        setScrollPosition((prev) => {
          const newPosition = prev + 1
          if (newPosition >= maxScroll) return 0
          return newPosition
        })
      }, 5)

      return () => {
        if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = scrollPosition
    }
  }, [scrollPosition])

  return (
    <div className="flex flex-col p-3 max-w-xl">
      <div className="flex items-center justify-start gap-2 mb-3">
        <Loader size="sm" variant="muted" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          {label}
        </p>
        <span className="text-xs text-muted-foreground/60 tabular-nums">{timer}s</span>
      </div>

      <Card className="relative h-[130px] overflow-hidden !p-0 border-border shadow-md">
        {/* Top fade */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-card from-20% to-transparent z-10 pointer-events-none h-[50px]" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card from-20% to-transparent z-10 pointer-events-none h-[50px]" />
        {/* Scrolling content */}
        <div
          ref={contentRef}
          className="h-full overflow-hidden px-4 py-3 text-muted-foreground/70"
          style={{ scrollBehavior: "auto" }}
        >
          <p className="text-xs leading-relaxed whitespace-pre-wrap">{THINKING_CONTENT}</p>
        </div>
      </Card>
    </div>
  )
}

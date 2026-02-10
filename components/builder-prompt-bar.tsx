"use client"

import React, { useState, useRef, useEffect } from "react"
import { ArrowUp, Sparkles, Loader2, Zap } from "lucide-react"
import type { InvoiceData } from "@/lib/invoice-types"
import { useBusiness } from "@/hooks/use-business"
import { cn } from "@/lib/utils"
import { TemplateSelector } from "@/components/template-selector"

interface BuilderPromptBarProps {
  data: InvoiceData
  onChange: (updates: Partial<InvoiceData>) => void
}

export function BuilderPromptBar({ data, onChange }: BuilderPromptBarProps) {
  const [value, setValue] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [lastCommand, setLastCommand] = useState("")
  const [useAI, setUseAI] = useState(true) // Toggle for AI vs simple parsing
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { business } = useBusiness()
  const canSubmit = value.trim().length > 0 && !isGenerating

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [value])

  // Simple client-side parsing (fallback)
  function parsePromptSimple(prompt: string): Partial<InvoiceData> {
    const lower = prompt.toLowerCase().trim()
    const updates: Partial<InvoiceData> = {}

    // Document type detection
    if (lower.includes("invoice")) updates.documentType = "Invoice"
    else if (lower.includes("contract")) updates.documentType = "Contract"
    else if (lower.includes("nda") || lower.includes("non-disclosure"))
      updates.documentType = "NDA"
    else if (lower.includes("agreement")) updates.documentType = "Agreement"

    // Currency detection
    const currencyPatterns: Record<string, string> = {
      usd: "USD", dollar: "USD", "$": "USD",
      eur: "EUR", euro: "EUR",
      gbp: "GBP", pound: "GBP", "£": "GBP",
      inr: "INR", rupee: "INR", "₹": "INR",
    }
    for (const [pattern, code] of Object.entries(currencyPatterns)) {
      if (lower.includes(pattern)) {
        updates.currency = code
        break
      }
    }

    // Amount detection
    const amountMatch = prompt.match(
      /(?:for|of|worth|total|amount)\s*[\$\€\£\₹]?\s*([\d,]+(?:\.\d{1,2})?)/i
    )
    if (amountMatch) {
      const amount = Number.parseFloat(amountMatch[1].replace(/,/g, ""))
      if (amount > 0) {
        updates.items = [
          {
            id: String(Date.now()),
            description: "Service",
            quantity: 1,
            rate: amount,
          },
        ]
      }
    }

    // Tax detection
    const taxMatch = lower.match(/(?:tax|vat|gst)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*%?/)
    if (taxMatch) {
      updates.taxRate = Number.parseFloat(taxMatch[1])
    }

    // Payment terms
    if (lower.includes("net 15")) updates.paymentTerms = "Net 15"
    else if (lower.includes("net 30")) updates.paymentTerms = "Net 30"
    else if (lower.includes("net 60")) updates.paymentTerms = "Net 60"
    else if (lower.includes("due on receipt")) updates.paymentTerms = "Due on Receipt"

    // If nothing matched, use as description
    if (Object.keys(updates).length === 0) {
      updates.description = prompt
    }

    return updates
  }

  // AI-powered generation with streaming
  async function generateWithAI(prompt: string) {
    setIsGenerating(true)
    setStreamingText("")

    try {
      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          documentType: data.documentType?.toLowerCase() || "invoice",
          businessContext: business
            ? {
              name: business.name,
              address: business.address,
              currency: business.default_currency,
              paymentTerms: business.default_payment_terms,
              signatory: business.primary_signatory,
            }
            : undefined,
          currentData: data,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ""

      if (!reader) {
        throw new Error("No response body")
      }

      while (true) {
        const { done, value: chunk } = await reader.read()
        if (done) break

        const text = decoder.decode(chunk, { stream: true })
        const lines = text.split("\n").filter((line) => line.startsWith("data: "))

        for (const line of lines) {
          const jsonStr = line.slice(6)
          try {
            const parsed = JSON.parse(jsonStr)
            if (parsed.type === "chunk") {
              fullContent += parsed.data
              setStreamingText((prev) => prev + parsed.data)
            } else if (parsed.type === "complete") {
              // Parse the complete JSON and apply updates
              try {
                const docData = JSON.parse(fullContent)
                onChange(docData)
              } catch {
                // If JSON parsing fails, try simple parsing
                const updates = parsePromptSimple(prompt)
                onChange(updates)
              }
            } else if (parsed.type === "error") {
              console.error("AI error:", parsed.data)
              // Fall back to simple parsing
              const updates = parsePromptSimple(prompt)
              onChange(updates)
            }
          } catch {
            // Skip invalid JSON chunks
          }
        }
      }
    } catch (error) {
      console.error("AI generation failed:", error)
      // Fall back to simple parsing
      const updates = parsePromptSimple(prompt)
      onChange(updates)
    } finally {
      setIsGenerating(false)
      setStreamingText("")
    }
  }

  function handleSubmit() {
    if (!canSubmit) return
    const prompt = value.trim()
    setLastCommand(prompt)
    setValue("")

    if (useAI) {
      generateWithAI(prompt)
    } else {
      const updates = parsePromptSimple(prompt)
      onChange(updates)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-border bg-card px-4 py-3 shrink-0">
      {/* AI Toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUseAI(!useAI)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
              useAI
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Zap className="w-3 h-3" />
            {useAI ? "AI Mode" : "Simple Mode"}
          </button>

          <TemplateSelector
            onSelect={onChange}
            trigger={
              <button
                type="button"
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Templates
              </button>
            }
          />
        </div>
        {lastCommand && !isGenerating && (
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-primary shrink-0" />
            <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
              <span className="font-medium text-foreground">Last:</span> {lastCommand}
            </p>
          </div>
        )}
      </div>

      {/* Streaming indicator */}
      {isGenerating && (
        <div className="flex items-center gap-2 mb-2 px-1 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
          <p className="text-xs text-primary font-medium">
            Generating document...
          </p>
          {streamingText && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {streamingText.slice(-50)}...
            </span>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 rounded-xl border border-border bg-background focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              useAI
                ? "Describe your document... e.g. \"Create an invoice for web development services, $4,500 total\""
                : "Quick update... e.g. \"Add tax 18%\""
            }
            rows={1}
            disabled={isGenerating}
            className="w-full px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 bg-transparent outline-none resize-none leading-relaxed disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-all",
            canSubmit
              ? "bg-foreground text-background hover:opacity-90 shadow-sm"
              : "bg-secondary text-muted-foreground/40 cursor-not-allowed"
          )}
          aria-label="Send command"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        {useAI
          ? "AI will generate complete documents from natural language"
          : "Quick commands: \"Set tax 18%\", \"Net 30 terms\""}
      </p>
    </div>
  )
}

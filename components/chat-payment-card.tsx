"use client"

/**
 * ChatPaymentCard — Inline card in chat when user asks about payment methods
 * but has no gateway connected. Mirrors the ChatSendCard pattern.
 */

import { useState, useEffect } from "react"
import {
  CreditCard, X, ExternalLink, CheckCircle2, Settings,
  Zap, ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatPaymentCardProps {
  onDismiss: () => void
  onConfigure: () => void
}

const GATEWAY_HIGHLIGHTS = [
  {
    name: "Razorpay",
    desc: "UPI, cards, netbanking",
    region: "India",
    color: "#2563EB",
    letter: "R",
  },
  {
    name: "Stripe",
    desc: "Cards, 135+ currencies",
    region: "Global",
    color: "#635BFF",
    letter: "S",
  },
  {
    name: "Cashfree",
    desc: "Fast settlements",
    region: "India",
    color: "#00A550",
    letter: "C",
  },
]

export function ChatPaymentCard({ onDismiss, onConfigure }: ChatPaymentCardProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  return (
    <div className={cn(
      "flex justify-start w-full transition-all",
      mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-[0.96]",
      "duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
    )}>
      <div
        className="w-full max-w-[88%] rounded-2xl bg-card border border-border/40 overflow-hidden"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/8 dark:bg-primary/15">
              <CreditCard className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                Connect a Payment Gateway
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                Accept online payments on your invoices
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Gateway options */}
        <div className="px-5 pb-2 space-y-2">
          {GATEWAY_HIGHLIGHTS.map((gw) => (
            <div
              key={gw.name}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30 border border-border/30"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: gw.color }}
              >
                {gw.letter}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{gw.name}</p>
                <p className="text-[11px] text-muted-foreground">{gw.desc} · {gw.region}</p>
              </div>
              <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
            </div>
          ))}
        </div>

        {/* Info note */}
        <div className="px-5 pb-3">
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
            <Zap className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
              Once connected, a payment link will be automatically added to your invoices so clients can pay online.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onConfigure}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-150 shadow-sm shadow-primary/20"
          >
            <Settings className="w-4 h-4" />
            Configure
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDismiss}
            className="px-4 h-10 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}

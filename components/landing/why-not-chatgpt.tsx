"use client"

import { useEffect, useState } from "react"
import {
  Globe2,
  ArrowUp,
  MessageSquare,
  Eye,
  Mail,
  MessageCircle,
  Copy,
  User,
  CreditCard,
  Bell,
  Send,
  Mic,
  Paperclip,
  Database,
  Search,
  Brain,
  PenLine,
  ScanText,
  Layers,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Cycling AI competitor names — keeps headline relatable & SEO-friendly
const AI_NAMES = ["ChatGPT", "Claude", "Gemini", "Perplexity"] as const

// One full prompt → response cycle (mirrors the real Clorefy flow:
// user types → AI thinks via agentic block → document appears on right)
type Scene = {
  id: string
  prompt: string
  activities: { icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>; label: string; detail: string }[]
  doc: {
    type: string
    number: string
    fromName: string
    fromMeta: string
    toName: string
    toMeta: string
    items: { desc: string; amount: string }[]
    subtotal: string
    taxLabel: string
    taxAmount: string
    total: string
    currency: string
    footer: string
  }
}

const scenes: Scene[] = [
  {
    id: "invoice",
    prompt: "Invoice Acme Corp $5,000 for web design, net-30",
    activities: [
      { icon: Database, label: "Reading profile", detail: "Studio Noir, EIN 98-7654321" },
      { icon: Search, label: "Looking up tax", detail: "US sales tax — services exempt" },
      { icon: Brain, label: "Composing", detail: "INV-0042 · Net-30" },
      { icon: PenLine, label: "Formatting PDF", detail: "Modern template" },
    ],
    doc: {
      type: "INVOICE",
      number: "INV-0042",
      fromName: "Studio Noir",
      fromMeta: "Brooklyn, NY · EIN 98-7654321",
      toName: "Acme Corp",
      toMeta: "Marketing · contact@acme.co",
      items: [
        { desc: "Web design — landing page", amount: "3,500.00" },
        { desc: "Brand assets package", amount: "1,500.00" },
      ],
      subtotal: "5,000.00",
      taxLabel: "Tax —",
      taxAmount: "0.00",
      total: "$ 5,000.00",
      currency: "USD",
      footer: "Net-30 · Stripe link attached",
    },
  },
  {
    id: "contract",
    prompt: "Service contract for Nexus, 3 months, £4,500/month",
    activities: [
      { icon: Database, label: "Reading profile", detail: "Priya Mehta Consulting" },
      { icon: ScanText, label: "Pulling clauses", detail: "UK service agreement" },
      { icon: Brain, label: "Composing", detail: "3-month retainer terms" },
      { icon: PenLine, label: "Adding signature block", detail: "Both parties · UK law" },
    ],
    doc: {
      type: "SERVICE AGREEMENT",
      number: "CTR-2026-014",
      fromName: "Priya Mehta Consulting",
      fromMeta: "London, UK · VAT GB123456789",
      toName: "Nexus Group",
      toMeta: "Strategy team",
      items: [
        { desc: "1. Scope — brand strategy retainer", amount: "—" },
        { desc: "2. Term — 3 months rolling", amount: "—" },
        { desc: "3. Fees — £4,500/month, Net-30", amount: "—" },
      ],
      subtotal: "",
      taxLabel: "",
      taxAmount: "",
      total: "Ready to sign",
      currency: "",
      footer: "E-signature enabled · 14 days to sign",
    },
  },
  {
    id: "quotation",
    prompt: "Quote 50 enterprise seats for Pinnacle Retail, annual",
    activities: [
      { icon: Database, label: "Reading profile", detail: "Northwind Software" },
      { icon: Layers, label: "Pricing tiers", detail: "Enterprise · 50 seats" },
      { icon: Brain, label: "Composing", detail: "Annual plan + add-ons" },
      { icon: PenLine, label: "Validity terms", detail: "30 days · Net-30" },
    ],
    doc: {
      type: "QUOTATION",
      number: "QT-2026-214",
      fromName: "Northwind Software",
      fromMeta: "Enterprise Sales · GSTIN 07AAACN1234D1Z2",
      toName: "Pinnacle Retail Ltd.",
      toMeta: "Procurement · ops@pinnacle.co",
      items: [
        { desc: "Enterprise plan — 50 seats", amount: "30,000.00" },
        { desc: "SSO + SAML add-on", amount: "3,600.00" },
        { desc: "Priority support — 12 months", amount: "2,400.00" },
      ],
      subtotal: "36,000.00",
      taxLabel: "Sales Tax —",
      taxAmount: "0.00",
      total: "$ 36,000.00",
      currency: "USD",
      footer: "Net-30 · Valid 30 days",
    },
  },
] as const

const SCENE_DURATION = 18000 // ms per full cycle
const EASE = [0.16, 1, 0.3, 1] as const

function docLabel(scene: Scene) {
  return scene.doc.type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function DemoShareOptionsCard({ scene }: { scene: Scene }) {
  const label = docLabel(scene)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex justify-center w-full"
    >
      <div
        className="w-full rounded-2xl bg-card border border-border/50 overflow-hidden"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Share {label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{scene.doc.number}</p>
          </div>
        </div>
        <div className="px-3 pb-3 space-y-1.5">
          {[
            { Icon: Mail, title: "Send via Email", detail: "Send with payment link", active: true },
            { Icon: MessageCircle, title: "Share on WhatsApp", detail: "Pre-filled message" },
            { Icon: Copy, title: "Copy Link", detail: "Share a direct link" },
          ].map(({ Icon, title, detail, active }) => (
            <div
              key={title}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all ${active ? "bg-muted/50" : ""}`}
            >
              <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-foreground/60" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{detail}</p>
              </div>
              <ArrowUp className="w-3.5 h-3.5 rotate-90 text-muted-foreground/40" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function DemoSendEmailCard({ scene, step }: { scene: Scene; step: number }) {
  const isPreview = step === 4
  const label = docLabel(scene)
  const clientEmail = scene.doc.toMeta.includes("@") ? scene.doc.toMeta.split(" ").find((part) => part.includes("@"))?.replace(/[,\s]+$/g, "") : "client@example.com"

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex justify-center w-full"
    >
      <div
        className="w-full rounded-2xl bg-card border border-border/40 overflow-hidden"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/8 shrink-0">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">Send {label}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{scene.doc.number}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-4 pb-3">
          <div className={`h-1 rounded-full transition-all duration-300 ${isPreview ? "w-3 bg-primary/30" : "w-6 bg-primary"}`} />
          <div className={`h-1 rounded-full transition-all duration-300 ${isPreview ? "w-6 bg-primary" : "w-3 bg-muted"}`} />
        </div>

        {!isPreview ? (
          <div className="px-4 pb-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Recipient</span>
              </div>
              <div className="w-full h-10 px-3.5 rounded-xl border border-border/60 text-sm bg-background text-foreground flex items-center">
                {clientEmail}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 text-xs text-muted-foreground border border-border/30">
                <User className="w-3 h-3" />{scene.doc.toName}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 text-xs font-medium text-foreground border border-border/30">
                {scene.doc.total}
              </span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Include payment link</span>
              </div>
              <div className="relative w-9 h-5 rounded-full bg-primary">
                <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow translate-x-4" />
              </div>
            </div>
            <div className="w-full h-10 rounded-xl bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2">
              Next <ArrowUp className="w-4 h-4 rotate-90" />
            </div>
          </div>
        ) : (
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/30 border border-border/30">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground font-medium truncate">{clientEmail}</span>
              <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[10px] font-semibold text-muted-foreground shrink-0">
                <CreditCard className="w-3 h-3" /> Pay link
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Email message</span>
              </div>
              <div className="w-full px-3.5 py-2.5 rounded-xl border border-border/50 bg-background text-sm text-foreground leading-relaxed">
                Hi {scene.doc.toName},<br />Please find your {label.toLowerCase()} attached. The payment link is included for convenience.
              </div>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-primary" />
                <div>
                  <span className="text-xs font-medium text-foreground block">Auto follow-up reminders</span>
                  <span className="text-[11px] text-muted-foreground">Stops when paid</span>
                </div>
              </div>
              <div className="relative w-9 h-5 rounded-full bg-primary shrink-0">
                <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow translate-x-4" />
              </div>
            </div>
            <div className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-primary/20">
              <Send className="w-4 h-4" /> Send {label}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function SendDemoFlow({ scene, sendStep }: { scene: Scene; sendStep: number }) {
  const label = docLabel(scene).toLowerCase()

  return (
    <div className="space-y-3 pb-1">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="text-[11.5px] text-[#5B5550] leading-relaxed font-medium pl-1"
      >
        Done - <span className="text-[#1C1A17] font-bold">{scene.doc.number}</span> is ready.
        Payment link attached and saved.
      </motion.div>

      {sendStep >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="flex justify-end"
        >
          <div className="max-w-[78%] min-w-0 px-4 py-2.5 rounded-2xl rounded-br-sm bg-primary text-primary-foreground text-sm leading-relaxed shadow-[0_2px_8px_hsl(var(--primary)/0.25)]">
            send it
          </div>
        </motion.div>
      )}

      {sendStep >= 3 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="max-w-[85%] min-w-0 px-4 py-3 rounded-2xl rounded-bl-sm bg-card border border-border/50 text-sm leading-relaxed text-foreground"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
        >
          How would you like to send your {label}?
        </motion.div>
      )}

      {sendStep === 3 && <DemoShareOptionsCard scene={scene} />}
      {(sendStep === 4 || sendStep >= 5) && <DemoSendEmailCard scene={scene} step={sendStep >= 5 ? 4 : 3} />}
    </div>
  )
}

function MobileSceneMockup({ scene, hasTable, sendStep }: { scene: Scene; hasTable: boolean; sendStep: number }) {
  const showingPreview = sendStep === 1
  const showingSendFlow = sendStep >= 2

  return (
    <div className="md:hidden h-[560px] bg-background flex flex-col overflow-hidden">
      {/* Mobile app header mirrors the authenticated prompt screen. */}
      <div
        className="flex items-center px-3 py-2.5 border-b border-border bg-card shrink-0 gap-2"
        style={{ boxShadow: "0 1px 0 0 rgba(0,0,0,0.06), 0 4px 16px -4px rgba(0,0,0,0.1)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-[#1C1A17] flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-[var(--landing-amber)]">C</span>
          </div>
          <span className="text-[12px] font-bold text-[#1C1A17] truncate">Clorefy</span>
        </div>
        <div className="ml-auto flex items-center bg-secondary/60 border border-border/50 rounded-2xl p-[3px] shadow-sm">
          <span className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold ${showingPreview ? "text-muted-foreground" : "bg-background text-foreground shadow-sm"}`}>
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </span>
          <span className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold ${showingPreview ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
            <Eye className="w-3.5 h-3.5" />
            View
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col bg-background">
        <div className="flex-1 min-h-0 overflow-hidden px-4 py-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`mobile-${scene.id}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="h-full flex flex-col"
            >
              {showingPreview ? (
                <div className="h-full flex flex-col bg-[#F5F2EC] -mx-4 -my-5">
                  <div className="px-4 py-2.5 border-b border-stone-200 bg-white flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#86807B]">Document</span>
                    <span className="text-stone-300 text-[10px]">·</span>
                    <span className="text-[10.5px] font-mono text-[#5B5550] truncate">{scene.doc.number}</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-[var(--landing-amber)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-amber)]" />
                      Live
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden px-5 py-4 flex items-start justify-center">
                    <DocumentPaper scene={scene} hasTable={hasTable} compact />
                  </div>
                </div>
              ) : showingSendFlow ? (
                <div className="h-full flex flex-col">
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
                    <SendDemoFlow scene={scene} sendStep={sendStep} />
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex-1 overflow-hidden space-y-4">
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
                      className="flex justify-end"
                    >
                      <div className="max-w-[78%] min-w-0 px-4 py-2.5 rounded-2xl rounded-br-sm bg-primary text-primary-foreground text-sm leading-relaxed shadow-[0_2px_8px_hsl(var(--primary)/0.25)]">
                        {scene.prompt}
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.45, ease: EASE }}
                      className="w-full rounded-xl border border-border/30 bg-card/50 overflow-hidden"
                    >
                      <div className="px-3 py-2 flex items-center gap-2 border-b border-border/30">
                        <div className="w-4 h-4 rounded-md bg-[var(--landing-amber)]/15 flex items-center justify-center">
                          <Brain size={10} className="text-[var(--landing-amber)]" strokeWidth={2.5} />
                        </div>
                        <span className="text-[10.5px] font-bold text-[#1C1A17] uppercase tracking-wider">Working</span>
                        <span className="ml-auto flex gap-1">
                          <span className="w-1 h-1 rounded-full bg-[var(--landing-amber)] animate-pulse" />
                          <span className="w-1 h-1 rounded-full bg-[var(--landing-amber)] animate-pulse" style={{ animationDelay: "160ms" }} />
                          <span className="w-1 h-1 rounded-full bg-[var(--landing-amber)] animate-pulse" style={{ animationDelay: "320ms" }} />
                        </span>
                      </div>
                      <div className="divide-y divide-border/30">
                        {scene.activities.slice(0, 4).map((act, i) => {
                          const Icon = act.icon
                          return (
                            <motion.div
                              key={act.label}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.35, delay: 0.8 + i * 0.35, ease: EASE }}
                              className="flex items-center gap-2.5 px-3 py-2.5"
                            >
                              <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 text-muted-foreground">
                                <Icon size={14} strokeWidth={2.2} />
                              </div>
                              <span className="text-[12px] font-medium text-foreground truncate shrink-0 max-w-[42%]">{act.label}</span>
                              <span className="text-muted-foreground/40 text-[11px]">|</span>
                              <span className="text-[11px] text-muted-foreground truncate">{act.detail}</span>
                            </motion.div>
                          )
                        })}
                      </div>
                    </motion.div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {sendStep === 0 && (
          <div
            className="border-t border-border/40 shrink-0 bg-card/95 px-4 pt-2.5 pb-3 backdrop-blur-sm"
            style={{ boxShadow: "0 -1px 0 0 rgba(0,0,0,0.04), 0 -4px 16px -4px rgba(0,0,0,0.06)" }}
          >
            <div className="relative rounded-2xl border border-border bg-card shadow-[0_1px_8px_-1px_rgba(0,0,0,0.08)]">
              <button className="absolute left-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground/50" aria-label="Attach">
                <Paperclip className="w-4 h-4" />
              </button>
              <div className="min-h-[52px] pl-12 pr-14 py-4 text-[14px] text-muted-foreground/45 truncate">
                Ask Clorefy anything...
              </div>
              <button className="absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-foreground text-background" aria-label="Send">
                <ArrowUp size={14} strokeWidth={3} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DocumentPaper({ scene, hasTable, compact = false }: { scene: Scene; hasTable: boolean; compact?: boolean }) {
  return (
    <motion.div
      key={scene.id}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.55, ease: EASE }}
      className={`${compact ? "max-w-[250px] p-4" : "max-w-[420px] p-5 sm:p-6"} w-full origin-top rounded-lg border border-stone-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]`}
    >
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
        <div className="min-w-0">
          <div className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-[0.16em] text-stone-400 mb-1">
            CLOREFY
          </div>
          <div className="font-serif text-[14px] sm:text-[16px] font-bold text-[#1C1A17] tracking-tight leading-tight">
            {scene.doc.type}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[8px] uppercase tracking-wider text-stone-400">Ref</div>
          <div className="text-[9.5px] font-mono font-semibold text-stone-700">{scene.doc.number}</div>
          <div className="text-[8.5px] text-stone-400 mt-0.5">12 May 2026</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="min-w-0">
          <div className="text-[8px] uppercase tracking-wider text-stone-400 mb-0.5">From</div>
          <div className="text-[10.5px] font-semibold text-[#1C1A17] truncate">{scene.doc.fromName}</div>
          <div className="text-[9px] text-stone-500 leading-snug truncate">{scene.doc.fromMeta}</div>
        </div>
        <div className="min-w-0">
          <div className="text-[8px] uppercase tracking-wider text-stone-400 mb-0.5">To</div>
          <div className="text-[10.5px] font-semibold text-[#1C1A17] truncate">{scene.doc.toName}</div>
          <div className="text-[9px] text-stone-500 leading-snug truncate">{scene.doc.toMeta}</div>
        </div>
      </div>

      <div className="mt-3">
        {hasTable ? (
          <>
            <div className="grid grid-cols-[1fr_70px] gap-2 px-2 py-1.5 rounded-md bg-stone-50 border border-stone-200">
              <div className="text-[8.5px] font-bold uppercase tracking-wider text-stone-500">Description</div>
              <div className="text-[8.5px] font-bold uppercase tracking-wider text-stone-500 text-right">Amount</div>
            </div>
            <div className="divide-y divide-stone-100">
              {scene.doc.items.map((it, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 + idx * 0.08 }}
                  className="grid grid-cols-[1fr_70px] gap-2 px-2 py-2 items-start"
                >
                  <div className="text-[10px] text-stone-700 leading-snug">{it.desc}</div>
                  <div className="text-[10px] text-stone-800 text-right tabular-nums font-medium">{it.amount}</div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2 px-0.5">
            {scene.doc.items.map((it, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.2 + idx * 0.08 }}
                className="text-[10.5px] text-stone-700 leading-snug"
              >
                {it.desc}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-stone-200 flex justify-end">
        <div className="w-full max-w-[200px] space-y-1">
          {hasTable && (
            <>
              <div className="flex justify-between text-[10px] text-stone-500">
                <span>Subtotal</span>
                <span className="tabular-nums">{scene.doc.subtotal}</span>
              </div>
              <div className="flex justify-between text-[10px] text-stone-500">
                <span>{scene.doc.taxLabel}</span>
                <span className="tabular-nums">{scene.doc.taxAmount}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-baseline pt-1.5 border-t border-stone-200">
            <span className="text-[8.5px] uppercase tracking-wider text-stone-400 font-semibold">
              {hasTable ? "Total" : "Status"}
            </span>
            <span className="font-serif text-[13px] font-bold text-[#1C1A17] tabular-nums">{scene.doc.total}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-[9px] text-stone-400 text-center leading-relaxed">{scene.doc.footer}</div>
    </motion.div>
  )
}

export function WhyNotChatGPT() {
  const [aiIndex, setAiIndex] = useState(0)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [sendStep, setSendStep] = useState(0)

  // Cycle headline AI names
  useEffect(() => {
    const id = setInterval(() => setAiIndex((i) => (i + 1) % AI_NAMES.length), 2600)
    return () => clearInterval(id)
  }, [])

  // Cycle scenes (full prompt → doc loop)
  useEffect(() => {
    const id = setInterval(() => {
      setSendStep(0)
      setSceneIndex((i) => (i + 1) % scenes.length)
    }, SCENE_DURATION)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (sceneIndex !== 2) return

    const timers = [
      setTimeout(() => setSendStep(1), 5200),
      setTimeout(() => setSendStep(2), 8500),
      setTimeout(() => setSendStep(3), 10800),
      setTimeout(() => setSendStep(4), 13200),
      setTimeout(() => setSendStep(5), 15600),
    ]
    return () => timers.forEach(clearTimeout)
  }, [sceneIndex])

  const scene = scenes[sceneIndex]
  const hasTable = scene.doc.subtotal !== ""

  return (
    <section className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-10 bg-[#FAFAF9] relative overflow-hidden">
      {/* Subtle grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      {/* Soft amber glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[600px] rounded-[100%] opacity-30 pointer-events-none blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(224,123,57,0.18) 0%, transparent 60%)" }}
      />

      <div className="max-w-6xl mx-auto relative">

        {/* HEADER */}
        <div className="text-center mb-10 sm:mb-14 lg:mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
            className="font-display text-[2.25rem] xs:text-4xl sm:text-5xl md:text-6xl lg:text-[5.5rem] font-semibold text-[#1C1A17] tracking-tighter leading-[1.02]"
          >
            <span className="block" style={{ textShadow: "3px 3px 0px rgba(26,26,26,0.06), 0 8px 24px rgba(26,26,26,0.04)" }}>
              Why not just
            </span>
            <span className="block relative font-serif italic" style={{ minHeight: "1.15em" }} aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={AI_NAMES[aiIndex]}
                  initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -14, filter: "blur(8px)" }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="inline-block whitespace-nowrap"
                  style={{
                    backgroundImage: "linear-gradient(120deg, #d97757 0%, #e07b39 45%, #b8421c 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {AI_NAMES[aiIndex]}?
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
            className="mt-5 sm:mt-6 text-[15px] sm:text-lg md:text-xl text-[#5B5550] max-w-2xl mx-auto leading-relaxed font-medium"
          >
            AI chatbots draft text. Clorefy reads your business profile, applies the right tax rules,
            formats a real document, and attaches a payment link.
          </motion.p>
        </div>

        {/* MACBOOK MOCKUP */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: EASE }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="relative bg-white rounded-2xl sm:rounded-[2rem] border-[3px] sm:border-[4px] border-[var(--landing-dark)] shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] sm:shadow-[12px_12px_0px_0px_rgba(26,26,26,1)] overflow-hidden">

            {/* Window chrome */}
            <div className="h-9 sm:h-11 bg-[#F5F2EC] border-b-[2px] border-[var(--landing-dark)] flex items-center px-3 sm:px-5 gap-2 sm:gap-3">
              <div className="flex gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f57] border border-black/10" />
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#febc2e] border border-black/10" />
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#28c840] border border-black/10" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-white/70 border border-stone-200 text-[11px] font-mono text-stone-500 max-w-[280px]">
                  <Globe2 size={11} className="text-stone-400" />
                  <span className="truncate">clorefy.com / generate</span>
                </div>
                <div className="sm:hidden text-[10px] font-mono text-stone-500 truncate">clorefy.com</div>
              </div>
              <div className="w-[42px] sm:w-[58px] shrink-0" />
            </div>

            <MobileSceneMockup scene={scene} hasTable={hasTable} sendStep={sendStep} />

            {/* Split: chat (40%) + document preview (60%) - like the real desktop app */}
            <div className="hidden md:grid md:grid-cols-[40%_60%] min-h-[560px]">

              {/* ─────── LEFT: chat panel — mirrors invoice-chat.tsx ─────── */}
              <div className="bg-[#fbfbfa] border-b-2 md:border-b-0 md:border-r-2 border-stone-200 flex flex-col">
                {/* Header */}
                <div className="px-4 sm:px-5 py-3 border-b border-stone-200 flex items-center gap-2.5 shrink-0">
                  <div className="w-6 h-6 rounded-full bg-[#1C1A17] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[var(--landing-amber)]">C</span>
                  </div>
                  <span className="text-[11.5px] font-bold text-[#1C1A17]">Clorefy</span>
                  <span className="ml-auto text-[10px] font-mono text-stone-400 tabular-nums">
                    {sceneIndex + 1} / {scenes.length}
                  </span>
                </div>

                {/* Messages — keyed on scene so each loop replays */}
                <div className="flex-1 px-4 sm:px-5 py-4 space-y-3 overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={scene.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className="space-y-3"
                    >
                      {/* User prompt bubble */}
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
                        className="flex justify-end"
                      >
                        <div className="max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[#1C1A17] text-white text-[12.5px] leading-snug font-medium shadow-md">
                          {scene.prompt}
                        </div>
                      </motion.div>

                      {/* Agentic activity block — looks like the real one */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.5, ease: EASE }}
                        className="rounded-xl border border-stone-200 bg-white overflow-hidden"
                      >
                        {/* Header */}
                        <div className="px-3 py-2 flex items-center gap-2 border-b border-stone-100">
                          <div className="w-4 h-4 rounded-md bg-[var(--landing-amber)]/15 flex items-center justify-center">
                            <Brain size={10} className="text-[var(--landing-amber)]" strokeWidth={2.5} />
                          </div>
                          <span className="text-[10.5px] font-bold text-[#1C1A17] uppercase tracking-wider">
                            Working
                          </span>
                          <span className="ml-auto flex gap-0.5">
                            <span className="w-1 h-1 rounded-full bg-[var(--landing-amber)] animate-pulse" />
                            <span className="w-1 h-1 rounded-full bg-[var(--landing-amber)] animate-pulse" style={{ animationDelay: "200ms" }} />
                            <span className="w-1 h-1 rounded-full bg-[var(--landing-amber)] animate-pulse" style={{ animationDelay: "400ms" }} />
                          </span>
                        </div>

                        {/* Activity rows */}
                        <div className="divide-y divide-stone-100">
                          {scene.activities.map((act, i) => {
                            const Icon = act.icon
                            return (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.35, delay: 0.9 + i * 0.5, ease: EASE }}
                                className="flex items-center gap-2.5 px-3 py-2"
                              >
                                <div className="w-6 h-6 rounded-md bg-stone-100 flex items-center justify-center shrink-0">
                                  <Icon size={11} className="text-[#5B5550]" strokeWidth={2.2} />
                                </div>
                                <span className="text-[11px] font-semibold text-[#1C1A17] shrink-0">
                                  {act.label}
                                </span>
                                <span className="text-stone-300 text-[10px]">|</span>
                                <span className="text-[10.5px] text-[#86807B] truncate">
                                  {act.detail}
                                </span>
                              </motion.div>
                            )
                          })}
                        </div>
                      </motion.div>

                      {/* Final reply */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.9 + scene.activities.length * 0.5 + 0.2, ease: EASE }}
                        className="text-[11.5px] text-[#5B5550] leading-relaxed font-medium pl-1"
                      >
                        Done — <span className="text-[#1C1A17] font-bold">{scene.doc.number}</span> ready.
                        Payment link attached and saved.
                      </motion.div>
                      {sendStep >= 2 && (
                        <SendDemoFlow scene={scene} sendStep={sendStep} />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Input bar */}
                <div className="px-4 pb-4 pt-2 shrink-0">
                  <div className="bg-white border border-stone-200 rounded-xl px-2.5 py-2 flex items-center gap-1.5 shadow-sm">
                    <button className="p-1 text-stone-400 rounded-md" aria-label="Voice">
                      <Mic size={14} />
                    </button>
                    <button className="p-1 text-stone-400 rounded-md" aria-label="Attach">
                      <Paperclip size={14} />
                    </button>
                    <span className="text-[11.5px] text-stone-400 flex-1 truncate">
                      {sendStep === 2 ? "send it" : "Ask Clorefy anything…"}
                    </span>
                    <button className="w-6 h-6 rounded-md bg-[#1C1A17] flex items-center justify-center" aria-label="Send">
                      <ArrowUp size={12} className="text-white" strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ─────── RIGHT: document preview — mirrors document-preview.tsx ─────── */}
              <div className="bg-[#F5F2EC] flex flex-col">
                {/* Toolbar */}
                <div className="px-4 sm:px-5 py-2.5 border-b border-stone-200 bg-white flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#86807B]">
                    Document
                  </span>
                  <span className="text-stone-300 text-[10px]">·</span>
                  <span className="text-[10.5px] font-mono text-[#5B5550]">{scene.doc.number}</span>
                  <div className="ml-auto flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-amber)]" />
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--landing-amber)]">
                      Live
                    </span>
                  </div>
                </div>

                {/* Document — animated paper that swaps with each scene */}
                <div className="flex-1 p-4 sm:p-6 overflow-hidden flex items-start justify-center">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={scene.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.55, ease: EASE }}
                      className="w-full max-w-[420px] bg-white rounded-lg border border-stone-200 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-5 sm:p-6 origin-top"
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
                        <div className="min-w-0">
                          <div className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-[0.16em] text-stone-400 mb-1">
                            CLOREFY
                          </div>
                          <div className="font-serif text-[14px] sm:text-[16px] font-bold text-[#1C1A17] tracking-tight leading-tight">
                            {scene.doc.type}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[8px] uppercase tracking-wider text-stone-400">Ref</div>
                          <div className="text-[9.5px] font-mono font-semibold text-stone-700">
                            {scene.doc.number}
                          </div>
                          <div className="text-[8.5px] text-stone-400 mt-0.5">12 May 2026</div>
                        </div>
                      </div>

                      {/* From / To */}
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="min-w-0">
                          <div className="text-[8px] uppercase tracking-wider text-stone-400 mb-0.5">From</div>
                          <div className="text-[10.5px] font-semibold text-[#1C1A17] truncate">
                            {scene.doc.fromName}
                          </div>
                          <div className="text-[9px] text-stone-500 leading-snug truncate">
                            {scene.doc.fromMeta}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[8px] uppercase tracking-wider text-stone-400 mb-0.5">To</div>
                          <div className="text-[10.5px] font-semibold text-[#1C1A17] truncate">
                            {scene.doc.toName}
                          </div>
                          <div className="text-[9px] text-stone-500 leading-snug truncate">
                            {scene.doc.toMeta}
                          </div>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="mt-3">
                        {hasTable ? (
                          <>
                            <div className="grid grid-cols-[1fr_70px] gap-2 px-2 py-1.5 rounded-md bg-stone-50 border border-stone-200">
                              <div className="text-[8.5px] font-bold uppercase tracking-wider text-stone-500">
                                Description
                              </div>
                              <div className="text-[8.5px] font-bold uppercase tracking-wider text-stone-500 text-right">
                                Amount
                              </div>
                            </div>
                            <div className="divide-y divide-stone-100">
                              {scene.doc.items.map((it, idx) => (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.35, delay: 0.2 + idx * 0.08 }}
                                  className="grid grid-cols-[1fr_70px] gap-2 px-2 py-2 items-start"
                                >
                                  <div className="text-[10px] text-stone-700 leading-snug">{it.desc}</div>
                                  <div className="text-[10px] text-stone-800 text-right tabular-nums font-medium">
                                    {it.amount}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="space-y-2 px-0.5">
                            {scene.doc.items.map((it, idx) => (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.35, delay: 0.2 + idx * 0.08 }}
                                className="text-[10.5px] text-stone-700 leading-snug"
                              >
                                {it.desc}
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Totals / status */}
                      <div className="mt-3 pt-3 border-t border-stone-200 flex justify-end">
                        <div className="w-full max-w-[200px] space-y-1">
                          {hasTable && (
                            <>
                              <div className="flex justify-between text-[10px] text-stone-500">
                                <span>Subtotal</span>
                                <span className="tabular-nums">{scene.doc.subtotal}</span>
                              </div>
                              <div className="flex justify-between text-[10px] text-stone-500">
                                <span>{scene.doc.taxLabel}</span>
                                <span className="tabular-nums">{scene.doc.taxAmount}</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between items-baseline pt-1.5 border-t border-stone-200">
                            <span className="text-[8.5px] uppercase tracking-wider text-stone-400 font-semibold">
                              {hasTable ? "Total" : "Status"}
                            </span>
                            <span className="font-serif text-[13px] font-bold text-[#1C1A17] tabular-nums">
                              {scene.doc.total}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-3 text-[9px] text-stone-400 text-center leading-relaxed">
                        {scene.doc.footer}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Scene indicator dots */}
                <div className="px-5 py-3 border-t border-stone-200 bg-white flex items-center justify-center gap-2 shrink-0">
                  {scenes.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => setSceneIndex(i)}
                      className="group relative h-1.5 rounded-full transition-all"
                      style={{ width: i === sceneIndex ? "24px" : "6px" }}
                      aria-label={`Show scene ${i + 1}`}
                    >
                      <span
                        className={`absolute inset-0 rounded-full transition-colors ${
                          i === sceneIndex ? "bg-[var(--landing-amber)]" : "bg-stone-300 group-hover:bg-stone-400"
                        }`}
                      />
                      {/* Progress fill on active */}
                      {i === sceneIndex && (
                        <motion.span
                          key={`progress-${sceneIndex}`}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: SCENE_DURATION / 1000, ease: "linear" }}
                          className="absolute inset-0 rounded-full bg-[var(--landing-dark)] origin-left"
                          style={{ mixBlendMode: "multiply" }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* MacBook stand */}
          <div className="hidden sm:block absolute -bottom-3 left-1/2 -translate-x-1/2 w-[60%] h-3 rounded-b-[1.5rem] bg-gradient-to-b from-[#1C1A17] to-[#2a2724] shadow-[0_8px_20px_rgba(26,26,26,0.25)]" />
        </motion.div>

      </div>
    </section>
  )
}

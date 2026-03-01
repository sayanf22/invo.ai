"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { InvoLogo } from "@/components/invo-logo"
import { PromptInput } from "@/components/prompt-input"
import { CategoryPills } from "@/components/category-pills"
import { PromptScreen } from "@/components/prompt-screen"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { Loader2, Sparkles, Globe, FileDown, ShieldCheck, ArrowRight, FileText, ScrollText, ClipboardList, Lightbulb, MessageSquare } from "lucide-react"

type View = "start" | "prompt"

export function AppShell() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { supabase, user, isLoading: authLoading } = useAuth()
  const [view, setView] = useState<View>("start")
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined)
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined)
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined)
  const [promptKey, setPromptKey] = useState(0)
  const [checkingOnboarding, setCheckingOnboarding] = useState(true)

  useEffect(() => {
    const sessionId = searchParams.get("sessionId")
    if (sessionId) {
      setSelectedSessionId(sessionId)
      setView("prompt")
      loadSessionType(sessionId)
    }
  }, [searchParams])

  const loadSessionType = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from("document_sessions")
        .select("document_type")
        .eq("id", sessionId)
        .single()
      if (!error && data) {
        const t = data.document_type
        setSelectedCategory(t.charAt(0).toUpperCase() + t.slice(1))
      }
    } catch (error) {
      console.error("Error loading session type:", error)
    }
  }

  useEffect(() => {
    async function checkOnboarding() {
      if (authLoading || !user) { setCheckingOnboarding(false); return }
      try {
        const { data: profile, error } = await supabase
          .from("profiles").select("onboarding_complete").eq("id", user.id).single()
        if (!error && profile && (profile as any).onboarding_complete === false) {
          router.push("/onboarding"); return
        }
      } catch (error) {
        console.error("Error checking onboarding:", error)
      } finally { setCheckingOnboarding(false) }
    }
    checkOnboarding()
  }, [authLoading, user, supabase, router])

  const handlePromptSubmit = useCallback(async (prompt: string) => {
    setSelectedSessionId(undefined)
    try {
      let category = selectedCategory
      if (!category) {
        const response = await fetch("/api/ai/detect-type", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        })
        if (!response.ok) throw new Error("Failed to detect document type")
        const detection = await response.json()
        const t = detection.type as string
        category = t.charAt(0).toUpperCase() + t.slice(1)
        setSelectedCategory(category)
      }
      setInitialPrompt(prompt)
      setPromptKey(prev => prev + 1)
      setView("prompt")
    } catch (error) {
      console.error("Detection error:", error)
      setSelectedCategory("Invoice")
      setInitialPrompt(prompt)
      setPromptKey(prev => prev + 1)
      setView("prompt")
    }
  }, [selectedCategory])

  const handleExampleClick = useCallback((text: string) => {
    setSelectedSessionId(undefined)
    setSelectedCategory(undefined)
    handlePromptSubmit(text)
  }, [handlePromptSubmit])

  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory(category)
  }, [])

  const handleBack = useCallback(() => {
    setView("start")
    setSelectedCategory(undefined)
    setInitialPrompt(undefined)
    setPromptKey(0)
  }, [])

  if (authLoading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (view === "prompt") {
    return (
      <div key={promptKey} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <PromptScreen
          onBack={handleBack}
          initialCategory={selectedCategory}
          initialPrompt={initialPrompt}
          selectedSessionId={selectedSessionId}
        />
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-300 min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0">
        <InvoLogo size={36} />
        <HamburgerMenu />
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* ── Hero: Centered prompt ──────────────────────── */}
        <section className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-12">
          <div className="flex flex-col items-center gap-6 w-full max-w-[720px]">
            <InvoLogo size={80} />
            <h1 className="text-[40px] md:text-[48px] font-light tracking-tight text-foreground text-center text-balance leading-tight">
              {selectedCategory ? (
                <>{"Describe your "}<span className="font-medium relative">{selectedCategory.toLowerCase()}<span className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-primary" /></span></>
              ) : (
                <>{"What do you want to "}<span className="font-medium relative">{"create"}<span className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-primary" /></span>{"?"}</>
              )}
            </h1>
            <div className="w-full mt-2">
              <PromptInput
                onSubmit={handlePromptSubmit}
                placeholder={
                  selectedCategory
                    ? `Describe your ${selectedCategory.toLowerCase()}... e.g., "${
                        selectedCategory === "Invoice" ? "Invoice for $1,500 web design work"
                        : selectedCategory === "Contract" ? "Service agreement for 6-month consulting"
                        : selectedCategory === "Quotation" ? "Price quote for 50 custom t-shirts"
                        : "Web development project proposal"
                      }"`
                    : undefined
                }
              />
            </div>
            <div className="mt-2">
              <CategoryPills onSelect={handleCategorySelect} selectedCategory={selectedCategory} />
            </div>
          </div>
        </section>

        {/* ── How It Works — 3 Steps ─────────────────────── */}
        <section className="px-4 sm:px-8 pb-24">
          <div className="max-w-[1060px] mx-auto">
            <h2 className="text-[30px] md:text-[36px] font-bold tracking-tight text-foreground text-center mb-3">
              Three steps to any document
            </h2>
            <p className="text-[16px] text-muted-foreground text-center mb-14 max-w-lg mx-auto leading-relaxed">
              From description to compliant, export-ready document in seconds.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
              {([
                {
                  num: "01", icon: MessageSquare, title: "Describe",
                  desc: "Type what you need naturally. Our AI understands your intent and context.",
                  bg: "bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20",
                  iconBg: "bg-blue-500 shadow-blue-500/30",
                  border: "border-blue-200/60 dark:border-blue-800/40",
                },
                {
                  num: "02", icon: Sparkles, title: "Generate",
                  desc: "AI creates a fully compliant document using your business profile and local rules.",
                  bg: "bg-gradient-to-br from-amber-50 to-orange-100/50 dark:from-amber-950/40 dark:to-orange-900/20",
                  iconBg: "bg-primary shadow-primary/30",
                  border: "border-amber-200/60 dark:border-amber-800/40",
                },
                {
                  num: "03", icon: FileDown, title: "Export",
                  desc: "Review in the live editor, make changes, then export as PDF, DOCX, or image.",
                  bg: "bg-gradient-to-br from-emerald-50 to-green-100/50 dark:from-emerald-950/40 dark:to-green-900/20",
                  iconBg: "bg-emerald-500 shadow-emerald-500/30",
                  border: "border-emerald-200/60 dark:border-emerald-800/40",
                },
              ] as const).map((step) => (
                <div
                  key={step.num}
                  className={`relative group p-9 md:p-11 rounded-[2.5rem] ${step.bg} border ${step.border} shadow-[0_4px_24px_-6px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_48px_-10px_rgba(0,0,0,0.15)] hover:-translate-y-2 transition-all duration-500 overflow-hidden`}
                >
                  <span className="absolute -top-4 -right-2 text-[9rem] font-black text-foreground/[0.03] leading-none select-none pointer-events-none">
                    {step.num}
                  </span>
                  <div className={`relative z-10 inline-flex items-center justify-center w-14 h-14 rounded-2xl ${step.iconBg} text-white shadow-lg mb-7 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                    <step.icon className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="relative z-10 text-[22px] font-bold text-foreground mb-3 tracking-tight">{step.title}</h3>
                  <p className="relative z-10 text-[15px] text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Feature Cards — Bento Grid ──────────────────── */}
        <section className="px-4 sm:px-8 pb-24">
          <div className="max-w-[1060px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Large — AI Powered (dark) */}
            <div className="md:col-span-2 relative p-11 rounded-[2.5rem] bg-gradient-to-br from-[#1a1a18] to-[#2a2a26] text-white shadow-[0_8px_40px_-8px_rgba(0,0,0,0.4)] overflow-hidden group hover:shadow-[0_20px_60px_-12px_rgba(0,0,0,0.5)] hover:-translate-y-1 transition-all duration-500">
              <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(198,122,60,0.12) 0%, transparent 60%)" }} />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-7 shadow-lg shadow-white/5">
                  <Sparkles className="w-7 h-7 text-amber-300" />
                </div>
                <h3 className="text-[26px] font-bold mb-3 tracking-tight">AI-Powered Generation</h3>
                <p className="text-[16px] text-white/60 leading-relaxed max-w-md">
                  Describe what you need in plain language. Our AI writes complete, professional documents from scratch.
                </p>
              </div>
              <div className="absolute bottom-9 right-9 flex gap-2 opacity-15">
                <div className="h-2 w-14 bg-white rounded-full animate-pulse" />
                <div className="h-2 w-9 bg-white rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-[4.5rem] bg-white rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
              </div>
            </div>

            {/* Small — 11 Countries (warm) */}
            <div className="p-9 rounded-[2.5rem] bg-gradient-to-br from-orange-50 to-amber-100/60 dark:from-orange-950/30 dark:to-amber-900/20 border border-orange-200/50 dark:border-orange-800/30 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_48px_-10px_rgba(0,0,0,0.15)] hover:-translate-y-2 transition-all duration-500 group">
              <div className="w-14 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/25 flex items-center justify-center mb-7 group-hover:scale-110 transition-transform duration-500">
                <Globe className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-[22px] font-bold text-foreground mb-3 tracking-tight">11 Countries</h3>
              <p className="text-[15px] text-muted-foreground leading-relaxed">Tax-compliant templates for India, US, UK, Germany, and 7 more.</p>
            </div>

            {/* Small — Compliance (green) */}
            <div className="p-9 rounded-[2.5rem] bg-gradient-to-br from-emerald-50 to-green-100/60 dark:from-emerald-950/30 dark:to-green-900/20 border border-emerald-200/50 dark:border-emerald-800/30 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_48px_-10px_rgba(0,0,0,0.15)] hover:-translate-y-2 transition-all duration-500 group">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/25 flex items-center justify-center mb-7 group-hover:scale-110 transition-transform duration-500">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-[22px] font-bold text-foreground mb-3 tracking-tight">Compliance Built-in</h3>
              <p className="text-[15px] text-muted-foreground leading-relaxed">Multi-layer legal and tax validation before every document.</p>
            </div>

            {/* Large — Multi-Format Export (warm gradient) */}
            <div className="md:col-span-2 p-11 rounded-[2.5rem] bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-rose-50/30 dark:from-amber-950/20 dark:via-orange-950/10 dark:to-rose-950/10 border border-amber-200/40 dark:border-amber-800/20 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_48px_-10px_rgba(0,0,0,0.15)] hover:-translate-y-1 transition-all duration-500 group">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-rose-500 shadow-lg shadow-primary/25 flex items-center justify-center mb-7 group-hover:scale-110 transition-transform duration-500">
                <FileDown className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-[26px] font-bold text-foreground mb-3 tracking-tight">Multi-Format Export</h3>
              <p className="text-[16px] text-muted-foreground leading-relaxed max-w-md">Export as PDF, DOCX, PNG, or JPG. Five professional styles — Modern, Classic, Bold, Minimal, and Elegant.</p>
            </div>
          </div>
        </section>

        {/* ── Example Prompts ────────────────────────────── */}
        <section className="px-4 sm:px-8 pb-24">
          <div className="max-w-[1060px] mx-auto">
            <h2 className="text-[30px] md:text-[36px] font-bold tracking-tight text-foreground text-center mb-3">
              Try a prompt
            </h2>
            <p className="text-[16px] text-muted-foreground text-center mb-12 max-w-lg mx-auto leading-relaxed">
              Click any example below to generate a new document instantly.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {([
                { icon: FileText, text: "Create an invoice for $2,500 web development work for a US client", gradient: "from-blue-50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20", iconBg: "bg-blue-500 shadow-blue-500/25", border: "border-blue-200/50 dark:border-blue-800/30" },
                { icon: ScrollText, text: "Draft a 6-month freelance consulting contract with NDA clause", gradient: "from-purple-50 to-violet-50/50 dark:from-purple-950/30 dark:to-violet-950/20", iconBg: "bg-purple-500 shadow-purple-500/25", border: "border-purple-200/50 dark:border-purple-800/30" },
                { icon: ClipboardList, text: "Generate a quotation for 100 custom branded t-shirts with bulk pricing", gradient: "from-amber-50 to-yellow-50/50 dark:from-amber-950/30 dark:to-yellow-950/20", iconBg: "bg-amber-500 shadow-amber-500/25", border: "border-amber-200/50 dark:border-amber-800/30" },
                { icon: Lightbulb, text: "Write a project proposal for a mobile app redesign with timeline", gradient: "from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20", iconBg: "bg-emerald-500 shadow-emerald-500/25", border: "border-emerald-200/50 dark:border-emerald-800/30" },
              ] as const).map((example) => (
                <button
                  key={example.text}
                  type="button"
                  onClick={() => handleExampleClick(example.text)}
                  className={`group flex items-start gap-4 text-left p-6 rounded-[1.8rem] bg-gradient-to-br ${example.gradient} border ${example.border} shadow-[0_4px_24px_-6px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_48px_-10px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-400`}
                >
                  <div className={`shrink-0 w-11 h-11 rounded-xl ${example.iconBg} shadow-lg text-white flex items-center justify-center mt-0.5`}>
                    <example.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[15px] text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed flex-1">
                    {example.text}
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary shrink-0 mt-1.5 group-hover:translate-x-1 transition-all duration-300" />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom Stats Bar ────────────────────────────── */}
        <section className="px-4 sm:px-8 pb-16">
          <div className="max-w-[1060px] mx-auto">
            <div className="rounded-[2.5rem] bg-gradient-to-br from-[#1a1a18] to-[#2a2a26] text-white p-12 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.4)] relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 70% 30%, rgba(198,122,60,0.08) 0%, transparent 60%)" }} />
              <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                {[
                  { value: "4", label: "Document Types" },
                  { value: "11", label: "Countries" },
                  { value: "5", label: "Export Styles" },
                  { value: "<30s", label: "Generation Time" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-[36px] md:text-[44px] font-bold tracking-tight">{stat.value}</p>
                    <p className="text-[13px] font-semibold uppercase tracking-widest text-white/40 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

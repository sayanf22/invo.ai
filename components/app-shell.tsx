"use client"

import React from "react"
import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { PromptInput } from "@/components/prompt-input"
import { CategoryPills } from "@/components/category-pills"
import { PromptScreen } from "@/components/prompt-screen"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { authFetch } from "@/lib/auth-fetch"
import { useTier } from "@/hooks/use-tier"
import { toast } from "sonner"
import { ChatOnlyScreen } from "@/components/chat-only-screen"
import { cn } from "@/lib/utils"
import type { IntentSuggestion } from "@/lib/intent-router"

type View = "start" | "chat-only" | "prompt"

// ── Shimmer helper ──────────────────────────────────────────────────────────
// A single shimmer bar. Uses a CSS gradient animation for a more polished look
// than Tailwind's flat animate-pulse.
function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted/60",
        className
      )}
      style={style}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, hsl(var(--muted-foreground)/0.06) 50%, transparent 100%)",
        }}
      />
    </div>
  )
}

// ── Home screen loading: shown while checking auth/onboarding on login or
// when navigating back to the start screen. A minimal, text-free brand-logo
// pulse — the logo sits dead-center, exactly where the real home screen paints
// its logo, so the swap to the real screen feels continuous instead of a jarring
// flash. A soft expanding ring underneath gives it gentle motion.
export function HomeScreenSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="relative flex items-center justify-center" aria-label="Loading" role="status">
        {/* Soft expanding ring behind the mark */}
        <span className="absolute w-20 h-20 rounded-2xl bg-amber-700/10 dark:bg-amber-500/10 animate-[home-loader-ring_1.8s_ease-out_infinite]" />
        {/* Brand mark with a gentle breathing pulse */}
        <span className="relative animate-[home-loader-pulse_1.8s_ease-in-out_infinite]">
          <ClorefyLogo size={56} />
        </span>
      </div>
    </div>
  )
}

// ── Skeleton: morphs from chat-only → split-screen when route is known ──────
// Phase 1 (route = null or "chat-only"): full-width chat panel, no preview
// Phase 2 (route = "direct-create"):     chat panel shrinks, preview slides in
export function StartScreenSkeleton({ route }: { route: "chat-only" | "direct-create" | null }) {
  const isSplit = route === "direct-create"

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* ── Header ── */}
      <div
        className="flex items-center px-3 py-2.5 border-b border-border bg-card shrink-0 gap-2"
        style={{ boxShadow: "0 1px 0 0 rgba(0,0,0,0.06), 0 4px 16px -4px rgba(0,0,0,0.08)" }}
      >
        {/* Back button */}
        <div className="w-9 h-9 rounded-2xl bg-muted/60 border border-border/50 shrink-0" />
        {/* Logo */}
        <div className="flex items-center gap-1.5 ml-0.5">
          <Shimmer className="w-6 h-6 rounded-lg" />
          <Shimmer className="w-16 h-4 rounded-md" />
        </div>
        {/* Chat badge */}
        <Shimmer className="w-10 h-4 rounded-full hidden sm:block" />
        <div className="flex-1" />
        {/* Menu */}
        <div className="w-10 h-10 rounded-2xl bg-muted/60 border border-border/50 shrink-0" />
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Chat panel ── */}
        <div
          className="flex flex-col bg-card shrink-0 transition-all duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            width: isSplit ? "420px" : "100%",
            borderRight: isSplit ? "1px solid hsl(var(--border) / 0.5)" : "none",
            boxShadow: isSplit ? "2px 0 20px -4px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {/* Messages */}
          <div className="flex-1 overflow-hidden px-4 lg:px-6 py-5 space-y-5">

            {/* AI bubble 1 — greeting */}
            <div className="flex items-end gap-2.5 max-w-[78%]">
              <div className="w-7 h-7 rounded-full bg-muted/80 border border-border/40 shrink-0 mb-0.5" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm space-y-2">
                  <Shimmer className="h-3.5 w-[88%]" />
                  <Shimmer className="h-3.5 w-[72%]" />
                  <Shimmer className="h-3.5 w-[55%]" />
                </div>
              </div>
            </div>

            {/* User bubble */}
            <div className="flex justify-end">
              <div className="bg-foreground/90 rounded-2xl rounded-br-sm px-4 py-3 shadow-sm max-w-[60%] space-y-2">
                <Shimmer className="h-3.5 w-[90%] bg-background/20" />
                <Shimmer className="h-3.5 w-[65%] bg-background/20" />
              </div>
            </div>

            {/* AI bubble 2 — response */}
            <div className="flex items-end gap-2.5 max-w-[82%]">
              <div className="w-7 h-7 rounded-full bg-muted/80 border border-border/40 shrink-0 mb-0.5" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm space-y-2">
                  <Shimmer className="h-3.5 w-[92%]" />
                  <Shimmer className="h-3.5 w-[78%]" />
                </div>
              </div>
            </div>

            {/* Typing indicator */}
            <div className="flex items-end gap-2.5">
              <div className="w-7 h-7 rounded-full bg-muted/80 border border-border/40 shrink-0 mb-0.5" />
              <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
              </div>
            </div>
          </div>

          {/* Status label */}
          <div className="px-4 lg:px-6 pb-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
            <span className="text-[11px] text-muted-foreground/60 font-medium">
              {isSplit ? "Preparing your document…" : "Analyzing your request…"}
            </span>
          </div>

          {/* Input skeleton */}
          <div className="shrink-0 border-t border-border/50 px-4 lg:px-6 py-3">
            <div className="relative">
              <Shimmer className="h-12 w-full rounded-2xl" />
              {/* Paperclip icon placeholder */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-lg bg-muted/80" />
              {/* Send button placeholder */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-muted/80" />
            </div>
          </div>
        </div>

        {/* ── Preview panel — slides in when direct-create, desktop only ── */}
        <div
          className="hidden md:flex flex-1 flex-col bg-background overflow-hidden transition-all duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            opacity: isSplit ? 1 : 0,
            transform: isSplit ? "translateX(0)" : "translateX(48px)",
          }}
        >
          {/* Paper document card */}
          <div className="flex-1 flex items-start justify-center px-8 py-8 overflow-hidden">
            <div
              className="w-full max-w-[520px] bg-card rounded-2xl border border-border/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.1)] overflow-hidden"
            >
              {/* Document top bar */}
              <div className="px-6 pt-6 pb-4 border-b border-border/40 flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Shimmer className="h-5 w-28 rounded-md" />
                  <Shimmer className="h-3.5 w-20 rounded-md" />
                </div>
                <Shimmer className="h-14 w-14 rounded-xl shrink-0" />
              </div>

              {/* From / To section */}
              <div className="px-6 py-4 grid grid-cols-2 gap-6 border-b border-border/40">
                <div className="space-y-2">
                  <Shimmer className="h-3 w-12 rounded-md" />
                  <Shimmer className="h-3.5 w-[80%] rounded-md" />
                  <Shimmer className="h-3 w-[60%] rounded-md" />
                  <Shimmer className="h-3 w-[70%] rounded-md" />
                </div>
                <div className="space-y-2">
                  <Shimmer className="h-3 w-10 rounded-md" />
                  <Shimmer className="h-3.5 w-[75%] rounded-md" />
                  <Shimmer className="h-3 w-[55%] rounded-md" />
                  <Shimmer className="h-3 w-[65%] rounded-md" />
                </div>
              </div>

              {/* Line items table */}
              <div className="px-6 py-4 space-y-3 border-b border-border/40">
                {/* Table header */}
                <div className="grid grid-cols-4 gap-3">
                  <Shimmer className="h-3 w-full col-span-2 rounded-md" />
                  <Shimmer className="h-3 w-full rounded-md" />
                  <Shimmer className="h-3 w-full rounded-md" />
                </div>
                {/* Rows */}
                {[0.9, 0.7, 0.8].map((w, i) => (
                  <div key={i} className="grid grid-cols-4 gap-3">
                    <Shimmer className="h-3 rounded-md col-span-2" style={{ width: `${w * 100}%` }} />
                    <Shimmer className="h-3 w-full rounded-md" />
                    <Shimmer className="h-3 w-full rounded-md" />
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="px-6 py-4 flex flex-col items-end gap-2">
                <div className="flex items-center gap-8">
                  <Shimmer className="h-3 w-16 rounded-md" />
                  <Shimmer className="h-3 w-20 rounded-md" />
                </div>
                <div className="flex items-center gap-8">
                  <Shimmer className="h-3 w-12 rounded-md" />
                  <Shimmer className="h-3 w-16 rounded-md" />
                </div>
                <div className="flex items-center gap-8 mt-1">
                  <Shimmer className="h-4 w-14 rounded-md" />
                  <Shimmer className="h-4 w-24 rounded-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const [setupIncomplete, setSetupIncomplete] = useState(false)
  const [detectingType, setDetectingType] = useState(false)
  const [detectedRoute, setDetectedRoute] = useState<"chat-only" | "direct-create" | null>(null)
  const [chatOnlyPrompt, setChatOnlyPrompt] = useState<string>("")
  const [chatOnlySessionId, setChatOnlySessionId] = useState<string | undefined>(undefined)
  const [chatOnlyMismatch, setChatOnlyMismatch] = useState<{
    requestedType: string
    suggestedType: string
    reason: string
    initialMessage: string
  } | undefined>(undefined)
  /** Disambiguation context when intent classifier returns 2+ candidates (Req 3.3a) */
  const [chatOnlyDisambiguation, setChatOnlyDisambiguation] = useState<{
    suggestions: IntentSuggestion[]
  } | undefined>(undefined)
  const [isAnimating, setIsAnimating] = useState(false)

  // Tier info — used to gate premium document types
  const { allowedDocTypes, loading: tierLoading } = useTier()

  useEffect(() => {
    const sessionId = searchParams.get("sessionId")
    if (sessionId) {
      setSelectedSessionId(sessionId)
      // loadSessionType will set the correct view (chat-only or prompt)
      loadSessionType(sessionId)
    }
    // NOTE: localStorage session restore is handled AFTER onboarding check completes
    // to prevent racing with the onboarding redirect. See the checkingOnboarding effect.
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
        // If the session is a chat-only session, route to chat-only view
        if (t === "chat") {
          setChatOnlySessionId(sessionId)
          setChatOnlyPrompt("")
          setChatOnlyMismatch(undefined)
          setChatOnlyDisambiguation(undefined)
          setView("chat-only")
          return
        }
        // Typed session — route to the split-screen with the correct category
        setSelectedCategory(t.charAt(0).toUpperCase() + t.slice(1))
        setView("prompt")
      }
    } catch (error) {
      console.error("Error loading session type:", error)
    }
  }

  useEffect(() => {
    async function checkOnboarding() {
      if (authLoading || !user) { setCheckingOnboarding(false); return }
      try {
        // Fire both queries in parallel — the business-profile check does NOT
        // depend on the onboarding_complete result, so there's no reason to
        // wait for the first round-trip before starting the second. This
        // roughly halves the DB wait time on every page load for this check.
        const [{ data: profile, error }, { data: business }] = await Promise.all([
          supabase.from("profiles").select("onboarding_complete").eq("id", user.id).single(),
          supabase.from("businesses").select("name, country, email").eq("user_id", user.id).single(),
        ])
        if (!error && profile && (profile as any).onboarding_complete === false) {
          // New user — clear any stale session from localStorage
          localStorage.removeItem("clorefy_active_session")
          router.push("/onboarding"); return
        }
        if (!business || !business.name || !business.country || !business.email) {
          setSetupIncomplete(true)
        } else {
          // Business is complete, clear any skip flags
          localStorage.removeItem("clorefy_onboarding_skipped")
        }

        // Only NOW (after onboarding check passes) attempt to restore a mid-session
        // This prevents the session restore from racing with the onboarding redirect
        // We only restore if there's a URL sessionId param — localStorage restore is intentionally
        // removed to prevent auto-jumping into the prompt screen on every login.
        // Users should always land on the start screen and choose what to do.
        const urlSessionId = new URLSearchParams(window.location.search).get("sessionId")
        if (!urlSessionId) {
          // Always clear stale localStorage session on fresh login — user should start fresh
          localStorage.removeItem("clorefy_active_session")
        }
      } catch (error) {
        console.error("Error checking onboarding:", error)
      } finally { setCheckingOnboarding(false) }
    }
    checkOnboarding()
  }, [authLoading, user, supabase, router])

  const handleGoToSetup = useCallback(() => {
    router.push("/onboarding")
  }, [router])

  const handlePromptSubmit = useCallback(async (prompt: string, file?: File) => {
    setSelectedSessionId(undefined)
    setDetectedRoute(null)

    // If category is already selected, check if the prompt mentions a DIFFERENT document type
    // e.g., user selected "Invoice" pill but typed "create a quotation for Airdrop"
    if (selectedCategory) {
      const promptLower = prompt.toLowerCase()
      const mentionsQuotation = /\b(quotation|quote|price quote|estimate)\b/.test(promptLower)
      const mentionsContract = /\b(contract|agreement|service agreement|work agreement)\b/.test(promptLower)
      const mentionsProposal = /\b(proposal|business proposal|project proposal|pitch)\b/.test(promptLower)
      const mentionsInvoice = /\b(invoice|bill|receipt)\b/.test(promptLower)

      // Override category if prompt explicitly mentions a different document type
      let effectiveCategory = selectedCategory
      if (mentionsQuotation && selectedCategory !== "Quote") effectiveCategory = "Quote"
      else if (mentionsContract && selectedCategory !== "Contract") effectiveCategory = "Contract"
      else if (mentionsProposal && selectedCategory !== "Proposal") effectiveCategory = "Proposal"
      else if (mentionsInvoice && selectedCategory !== "Invoice") effectiveCategory = "Invoice"

      if (effectiveCategory !== selectedCategory) {
        // Check tier gate for the new type
        const effectiveLower = effectiveCategory.toLowerCase()
        if (!tierLoading && !allowedDocTypes.includes(effectiveLower)) {
          toast.error(`${effectiveCategory}s require a paid plan`, {
            description: `Your Free plan includes invoices and contracts. Upgrade to Starter for all document types.`,
            action: { label: "See plans", onClick: () => router.push("/billing") },
            duration: 8000,
          })
          return
        }
        setSelectedCategory(effectiveCategory)
      }

      // Even with a category selected, check the route — questions/mismatches go to chat-only
      setDetectingType(true)
      try {
        let enrichedPrompt = prompt
        if (file) {
          enrichedPrompt = await handleFileEnrichment(file, prompt)
        }
        try {
          const response = await authFetch("/api/ai/detect-type", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: enrichedPrompt }),
          })
          if (response.ok) {
            const detection = await response.json()
            if (detection.route === "chat-only" || detection.mismatch) {
              // Skeleton stays as chat-only, then transition
              setDetectedRoute("chat-only")
              await new Promise(r => setTimeout(r, 200))
              setChatOnlyPrompt(enrichedPrompt)
              setChatOnlySessionId(undefined)
              setChatOnlyMismatch(detection.mismatch ? {
                requestedType: detection.mismatch.requestedType,
                suggestedType: detection.mismatch.suggestedType,
                reason: detection.mismatch.reason,
                initialMessage: enrichedPrompt,
              } : undefined)
              // Set disambiguation when 2+ suggestions and no mismatch (Req 3.3a)
              const suggestions: IntentSuggestion[] = detection.intent?.suggestions ?? []
              setChatOnlyDisambiguation(
                !detection.mismatch && suggestions.length >= 2
                  ? { suggestions }
                  : undefined
              )
              setDetectingType(false)
              setDetectedRoute(null)
              setView("chat-only")
              return
            }
          }
        } catch (error) {
          console.error("Detection error:", error)
        }
        // Direct create — morph skeleton to split-screen first
        setDetectedRoute("direct-create")
        await new Promise(r => setTimeout(r, 380))
        setInitialPrompt(enrichedPrompt)
        setPromptKey(prev => prev + 1)
        setDetectingType(false)
        setDetectedRoute(null)
        setView("prompt")
      } catch (error) {
        setDetectingType(false)
        setDetectedRoute(null)
      }
      return
    }

    // ── No category selected — detect type FIRST, then switch view ──
    setDetectingType(true)

    try {
      let enrichedPrompt = prompt

      if (file) {
        enrichedPrompt = await handleFileEnrichment(file, prompt)
      }

      // Detect document type from the user's prompt
      let detectedCategory = "Invoice" // safe default
      try {
        const response = await authFetch("/api/ai/detect-type", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: enrichedPrompt }),
        })
        if (response.ok) {
          const detection = await response.json()
          const t = detection.type as string
          detectedCategory = t.charAt(0).toUpperCase() + t.slice(1)

          // Route to chat-only if the detect-type endpoint says so
          if (detection.route === "chat-only" || detection.mismatch) {
            setDetectedRoute("chat-only")
            await new Promise(r => setTimeout(r, 200))
            setChatOnlyPrompt(enrichedPrompt)
            setChatOnlySessionId(undefined)
            setChatOnlyMismatch(detection.mismatch ? {
              requestedType: detection.mismatch.requestedType,
              suggestedType: detection.mismatch.suggestedType,
              reason: detection.mismatch.reason,
              initialMessage: enrichedPrompt,
            } : undefined)
            // Set disambiguation when 2+ suggestions and no mismatch (Req 3.3a)
            const suggestions2: IntentSuggestion[] = detection.intent?.suggestions ?? []
            setChatOnlyDisambiguation(
              !detection.mismatch && suggestions2.length >= 2
                ? { suggestions: suggestions2 }
                : undefined
            )
            setDetectingType(false)
            setDetectedRoute(null)
            setView("chat-only")
            return
          }
        }
      } catch (error) {
        console.error("Detection error:", error)
        // Fall back to Invoice — already set as default above
      }

      // ── Tier gate: block premium types for free users ──
      const detectedLower = detectedCategory.toLowerCase()
      if (!tierLoading && !allowedDocTypes.includes(detectedLower)) {
        setDetectingType(false)
        setDetectedRoute(null)
        toast.error(`${detectedCategory}s require a paid plan`, {
          description: `Your Free plan includes invoices and contracts. Upgrade to Starter for all document types.`,
          action: {
            label: "See plans",
            onClick: () => router.push("/billing"),
          },
          duration: 8000,
        })
        return // Stay on start screen
      }

      // Direct create — morph skeleton to split-screen, then mount real screen
      setDetectedRoute("direct-create")
      await new Promise(r => setTimeout(r, 380))
      setSelectedCategory(detectedCategory)
      setInitialPrompt(enrichedPrompt)
      setPromptKey(prev => prev + 1)
      setDetectingType(false)
      setDetectedRoute(null)
      setView("prompt")
    } catch (error) {
      console.error("Error in prompt submission:", error)
      // Fallback: just go with Invoice
      setSelectedCategory("Invoice")
      setInitialPrompt(prompt)
      setPromptKey(prev => prev + 1)
      setDetectingType(false)
      setDetectedRoute(null)
      setView("prompt")
    }
  }, [selectedCategory, allowedDocTypes, tierLoading, router])

  // Helper: enrich prompt with file data
  const handleFileEnrichment = useCallback(async (file: File, prompt: string): Promise<string> => {
    try {
      const formData = new FormData()
      formData.append("file", file)
      if (prompt) formData.append("message", prompt)

      const { createClient } = await import("@/lib/supabase")
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      const res = await fetch("/api/ai/analyze-file", {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body: formData,
      })

      if (res.ok) {
        const result = await res.json()
        const extracted = result.extracted
        if (extracted) {
          const parts: string[] = []
          if (extracted.businessName) parts.push(`Client: ${extracted.businessName}`)
          if (extracted.ownerName) parts.push(`Contact: ${extracted.ownerName}`)
          if (extracted.email) parts.push(`Email: ${extracted.email}`)
          if (extracted.phone) parts.push(`Phone: ${extracted.phone}`)
          if (extracted.address) {
            const a = extracted.address
            const addr = [a.street, a.city, a.state, a.postalCode].filter(Boolean).join(", ")
            if (addr) parts.push(`Address: ${addr}`)
          }
          if (extracted.taxId) parts.push(`Tax ID: ${extracted.taxId}`)
          if (extracted.services) {
            const svc = typeof extracted.services === "string" ? extracted.services : JSON.stringify(extracted.services)
            parts.push(`Services: ${svc}`)
          }
          if (extracted.projectDescription) parts.push(`Project: ${extracted.projectDescription}`)
          if (extracted.additionalContext) {
            const ctx = typeof extracted.additionalContext === "string" ? extracted.additionalContext : JSON.stringify(extracted.additionalContext)
            parts.push(`Context: ${ctx}`)
          }
          const clientDetails = parts.join("\n")
          return prompt
            ? `${prompt}\n\n[CLIENT DETAILS FROM ATTACHED FILE - use as Bill To recipient]\n${clientDetails}`
            : `Generate a document using the attached file details as the client.\n\n[CLIENT DETAILS FROM ATTACHED FILE - use as Bill To recipient]\n${clientDetails}`
        }
      }
    } catch (err) {
      console.error("File analysis error:", err)
    }
    return prompt
  }, [])

  // Example-prompt pills fill the input box (do NOT auto-send).
  // The user reviews/edits the prompt and presses Enter to submit.
  const [pillPrefill, setPillPrefill] = useState<string | undefined>(undefined)
  const [pillPrefillNonce, setPillPrefillNonce] = useState(0)

  const handlePillSelect = useCallback((prompt: string) => {
    setPillPrefill(prompt)
    setPillPrefillNonce(n => n + 1)
  }, [])

  // Persist active session to localStorage AND update URL so refresh restores the correct session
  useEffect(() => {
    if (view === "prompt" && selectedSessionId && user) {
      localStorage.setItem("clorefy_active_session", JSON.stringify({
        sessionId: selectedSessionId,
        category: selectedCategory,
        userId: user.id,
      }))
      // Keep URL in sync — replace so we don't pollute browser history
      const url = new URL(window.location.href)
      if (url.searchParams.get("sessionId") !== selectedSessionId) {
        url.searchParams.set("sessionId", selectedSessionId)
        router.replace(url.pathname + url.search)
      }
    }
  }, [view, selectedSessionId, selectedCategory, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Called by PromptScreen when the user navigates to a different session (history / chain)
  const handleSessionChange = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId)
  }, [])

  const handleBack = useCallback(() => {
    setView("start")
    setSelectedCategory(undefined)
    setInitialPrompt(undefined)
    setPromptKey(0)
    setChatOnlyPrompt("")
    setChatOnlySessionId(undefined)
    setChatOnlyMismatch(undefined)
    setChatOnlyDisambiguation(undefined)
    localStorage.removeItem("clorefy_active_session")
    // Clear sessionId from URL
    const url = new URL(window.location.href)
    url.searchParams.delete("sessionId")
    router.replace(url.pathname + (url.search || ""))
  }, [router])

  const handlePromote = useCallback(({ sessionId, documentType, initialPrompt: promptText }: {
    sessionId: string
    documentType: string
    initialPrompt: string
  }) => {
    const capitalized = documentType.charAt(0).toUpperCase() + documentType.slice(1)
    setSelectedSessionId(sessionId)
    setSelectedCategory(capitalized)
    setInitialPrompt(promptText)
    setPromptKey(prev => prev + 1)
    setIsAnimating(true)
    setView("prompt")
    // Clear animation flag after transition completes
    setTimeout(() => setIsAnimating(false), 500)
  }, [])

  if (authLoading || checkingOnboarding) {
    // Real static home screen (not a fake chat mockup) — this is the very
    // first screen most users see on every load/login, and none of its
    // content depends on data, so there's no reason to show a shimmer.
    return <HomeScreenSkeleton />
  }

  if (detectingType) {
    return <StartScreenSkeleton route={detectedRoute} />
  }

  if (view === "chat-only") {
    return (
      <div key={`chat-only-${chatOnlyPrompt}`} className="animate-in fade-in duration-250">
        {setupIncomplete && (
          <button
            type="button"
            onClick={handleGoToSetup}
            className="w-full px-4 sm:px-6 py-2.5 bg-muted/50 border-b border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2 group shrink-0 z-10"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>Complete your business profile for personalized documents</span>
            <span className="text-primary font-medium group-hover:underline">Set up →</span>
          </button>
        )}
        <ChatOnlyScreen
          initialPrompt={chatOnlyPrompt}
          resumeSessionId={chatOnlySessionId}
          mismatch={chatOnlyMismatch as any}
          disambiguation={chatOnlyDisambiguation}
          onBack={handleBack}
          onPromote={handlePromote}
        />
      </div>
    )
  }

  if (view === "prompt") {
    return (
      <div key={promptKey} className="animate-in fade-in duration-250">
        {setupIncomplete && (
          <button
            type="button"
            onClick={handleGoToSetup}
            className="w-full px-4 sm:px-6 py-2.5 bg-muted/50 border-b border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2 group shrink-0 z-10"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>Complete your business profile for personalized documents</span>
            <span className="text-primary font-medium group-hover:underline">Set up →</span>
          </button>
        )}
        <PromptScreen
          onBack={handleBack}
          onSessionChange={handleSessionChange}
          onChatSessionSelect={(sessionId) => {
            setChatOnlySessionId(sessionId)
            setChatOnlyPrompt("")
            setChatOnlyMismatch(undefined)
            setChatOnlyDisambiguation(undefined)
            setView("chat-only")
          }}
          initialCategory={selectedCategory}
          initialPrompt={initialPrompt}
          selectedSessionId={selectedSessionId}
          isAnimating={isAnimating}
        />
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-300 min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0">
        <ClorefyLogo size={36} />
        <HamburgerMenu />
      </header>

      {setupIncomplete && (
        <button
          type="button"
          onClick={handleGoToSetup}
          className="w-full px-4 sm:px-6 py-2.5 bg-muted/50 border-b border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2 group"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span>Complete your business profile for personalized documents</span>
          <span className="text-primary font-medium group-hover:underline">Set up →</span>
        </button>
      )}

      <main className="flex-1 overflow-y-auto">
        {/* ── Hero: Centered prompt ──────────────────────── */}
        <section className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-12">
          <div className="flex flex-col items-center gap-6 w-full max-w-[720px]">
            <ClorefyLogo size={80} />
            <h1 className="text-[40px] md:text-[48px] font-display font-medium tracking-tight text-foreground text-center text-balance leading-tight">
              {selectedCategory ? (
                <>{"Describe your "}<span className="font-medium relative text-amber-700 dark:text-amber-500">{selectedCategory.toLowerCase()}<span className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-amber-700/30 dark:bg-amber-500/30" /></span></>
              ) : (
                <>{"What do you want to "}<span className="font-medium relative text-amber-700 dark:text-amber-500">{"create"}<span className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-amber-700/30 dark:bg-amber-500/30" /></span>{"?"}</>
              )}
            </h1>
            <div className="w-full mt-2">
              <PromptInput
                onSubmit={handlePromptSubmit}
                prefillValue={pillPrefill}
                prefillNonce={pillPrefillNonce}
                placeholder={
                  selectedCategory
                    ? `Describe your ${selectedCategory.toLowerCase()}... e.g., "${
                        selectedCategory === "Invoice" ? "Invoice for $1,500 web design work"
                        : selectedCategory === "Contract" ? "Service agreement for 6-month consulting"
                        : selectedCategory === "Quote" ? "Price quote for 50 custom t-shirts"
                        : "Web development project proposal"
                      }"`
                    : undefined
                }
              />
            </div>
            <div className="mt-2">
              <CategoryPills onSelect={handlePillSelect} />
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}

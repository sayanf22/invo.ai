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
import { FileText } from "lucide-react"
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
      {/* Subtle, slow breathing brand mark — no ring, no text. Only shown for
          the brief auth bootstrap; everything else loads in the background. */}
      <span
        className="animate-[home-loader-pulse_2.4s_ease-in-out_infinite]"
        aria-label="Loading"
        role="status"
      >
        <ClorefyLogo size={52} />
      </span>
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

        {/* ── Chat panel — matches the real chat: a single AI bubble that's
             actively "typing", pinned to the bottom like a live conversation.
             No fake filler bubbles. ── */}
        <div
          className="flex flex-col bg-card shrink-0 transition-all duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            width: isSplit ? "420px" : "100%",
            borderRight: isSplit ? "1px solid hsl(var(--border) / 0.5)" : "none",
            boxShadow: isSplit ? "2px 0 20px -4px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {/* Messages — content sits at the bottom, matching the live chat */}
          <div className="flex-1 flex flex-col justify-end overflow-hidden px-4 lg:px-6 py-5">
            {/* AI typing bubble — identical styling to the real chat indicator */}
            <div className="flex items-end gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 shrink-0 mb-0.5 flex items-center justify-center overflow-hidden">
                <ClorefyLogo size={16} />
              </div>
              <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
              </div>
            </div>

            {/* Status label */}
            <div className="mt-3 pl-9 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
              <span className="text-[11px] text-muted-foreground/70 font-medium">
                {isSplit ? "Preparing your document…" : "Understanding your request…"}
              </span>
            </div>
          </div>

          {/* Input skeleton — same shape/rounding as the real composer */}
          <div className="shrink-0 border-t border-border/50 px-4 lg:px-6 py-3">
            <div className="relative">
              <div className="h-12 w-full rounded-2xl border border-border/60 bg-muted/30" />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-lg bg-muted/70" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-primary/20" />
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
          {/* Calm page silhouette — not a fake filled invoice */}
          <div className="flex-1 flex items-center justify-center px-8 py-8 overflow-hidden">
            <div className="w-full max-w-[520px] aspect-[1/1.294] bg-card rounded-2xl border border-border/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
                <FileText className="w-8 h-8 text-primary/50" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
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
  // Hidden reference context + chip label for a file attached on the home screen.
  // Passed to the split-screen so the file's analysis informs generation WITHOUT
  // dumping raw file text into the visible chat prompt.
  const [initialFileContext, setInitialFileContext] = useState<string | undefined>(undefined)
  const [initialFileName, setInitialFileName] = useState<string | undefined>(undefined)
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined)
  const [promptKey, setPromptKey] = useState(0)
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
    if (authLoading || !user) return
    let cancelled = false

    // Session housekeeping — clear any stale localStorage session on a fresh
    // landing (no ?sessionId) so the user always starts on the start screen.
    const urlSessionId = new URLSearchParams(window.location.search).get("sessionId")
    if (!urlSessionId) {
      localStorage.removeItem("clorefy_active_session")
    }

    // Background business-profile check — drives ONLY the "complete your profile"
    // banner. It never blocks render and never redirects: plan/onboarding
    // redirects are owned solely by HomeClient (avoids a double-redirect race).
    ;(async () => {
      try {
        const { data: business } = await supabase
          .from("businesses")
          .select("name, country, email")
          .eq("user_id", user.id)
          .single()
        if (cancelled) return
        if (!business || !business.name || !business.country || !business.email) {
          setSetupIncomplete(true)
        } else {
          localStorage.removeItem("clorefy_onboarding_skipped")
        }
      } catch (error) {
        console.error("Error checking business profile:", error)
      }
    })()

    return () => { cancelled = true }
  }, [authLoading, user, supabase])

  const handleGoToSetup = useCallback(() => {
    router.push("/onboarding")
  }, [router])

  // Helper: analyze an attached file with Kimi vision (images direct, PDFs
  // rasterized client-side). Returns the structured summary as HIDDEN reference
  // context — it is NEVER concatenated into the visible prompt. The chat shows
  // an attachment chip + the user's typed prompt instead of a raw text dump.
  const analyzeAttachedFile = useCallback(async (file: File, prompt: string): Promise<string | null> => {
    try {
      const { analyzeAttachment } = await import("@/lib/attachment-analysis")
      const result = await analyzeAttachment({ file, message: prompt, mode: "extract" })
      if (result.ok && result.summary) return result.summary
    } catch (err) {
      console.error("File analysis error:", err)
    }
    return null
  }, [])

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
            description: `Your Free plan includes invoices, contracts and quotes. Upgrade to Starter for all document types.`,
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
        // Analyze any attached file into HIDDEN reference context (Kimi vision).
        // The visible prompt stays exactly as the user typed it.
        let fileSummary: string | null = null
        if (file) {
          fileSummary = await analyzeAttachedFile(file, prompt)
          setInitialFileContext(fileSummary || undefined)
          setInitialFileName(file.name)
        } else {
          setInitialFileContext(undefined)
          setInitialFileName(undefined)
        }
        try {
          const response = await authFetch("/api/ai/detect-type", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, ...(fileSummary ? { fileSummary } : {}) }),
          })
          if (response.ok) {
            const detection = await response.json()
            if (detection.route === "chat-only" || detection.mismatch) {
              // Skeleton stays as chat-only, then transition
              setDetectedRoute("chat-only")
              await new Promise(r => setTimeout(r, 200))
              setChatOnlyPrompt(prompt)
              setChatOnlySessionId(undefined)
              setChatOnlyMismatch(detection.mismatch ? {
                requestedType: detection.mismatch.requestedType,
                suggestedType: detection.mismatch.suggestedType,
                reason: detection.mismatch.reason,
                initialMessage: prompt,
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
        setInitialPrompt(prompt)
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
      // Analyze any attached file into HIDDEN reference context (Kimi vision).
      // The visible prompt stays exactly as the user typed it; the file summary
      // is used only to (a) inform type detection and (b) travel to the builder
      // as hidden context — never dumped into the chat bubble.
      let fileSummary: string | null = null
      if (file) {
        fileSummary = await analyzeAttachedFile(file, prompt)
        setInitialFileContext(fileSummary || undefined)
        setInitialFileName(file.name)
      } else {
        setInitialFileContext(undefined)
        setInitialFileName(undefined)
      }

      // Detect document type from the user's prompt
      let detectedCategory = "Invoice" // safe default
      try {
        const response = await authFetch("/api/ai/detect-type", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, ...(fileSummary ? { fileSummary } : {}) }),
        })
        if (response.ok) {
          const detection = await response.json()
          const t = detection.type as string
          detectedCategory = t.charAt(0).toUpperCase() + t.slice(1)

          // Route to chat-only if the detect-type endpoint says so
          if (detection.route === "chat-only" || detection.mismatch) {
            setDetectedRoute("chat-only")
            await new Promise(r => setTimeout(r, 200))
            setChatOnlyPrompt(prompt)
            setChatOnlySessionId(undefined)
            setChatOnlyMismatch(detection.mismatch ? {
              requestedType: detection.mismatch.requestedType,
              suggestedType: detection.mismatch.suggestedType,
              reason: detection.mismatch.reason,
              initialMessage: prompt,
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
          description: `Your Free plan includes invoices, contracts and quotes. Upgrade to Starter for all document types.`,
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
      setInitialPrompt(prompt)
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
  }, [selectedCategory, allowedDocTypes, tierLoading, router, analyzeAttachedFile])

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
    setInitialFileContext(undefined)
    setInitialFileName(undefined)
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
    // Promotions from chat-only carry their own summary; no home-screen file.
    setInitialFileContext(undefined)
    setInitialFileName(undefined)
    setPromptKey(prev => prev + 1)
    setIsAnimating(true)
    setView("prompt")
    // Clear animation flag after transition completes
    setTimeout(() => setIsAnimating(false), 500)
  }, [])

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
          initialFileContext={initialFileContext}
          initialFileName={initialFileName}
          selectedSessionId={selectedSessionId}
          isAnimating={isAnimating}
        />
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-300 min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0">
        <ClorefyLogo size={34} />
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
            <ClorefyLogo size={68} />
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

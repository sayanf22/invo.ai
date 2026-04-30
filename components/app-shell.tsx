"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { InvoLogo } from "@/components/invo-logo"
import { PromptInput } from "@/components/prompt-input"
import { CategoryPills } from "@/components/category-pills"
import { PromptScreen } from "@/components/prompt-screen"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { Loader2 } from "lucide-react"
import { authFetch } from "@/lib/auth-fetch"
import { PageLoader } from "@/components/ui/page-loader"
import { useTier } from "@/hooks/use-tier"
import { toast } from "sonner"

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
  const [setupIncomplete, setSetupIncomplete] = useState(false)
  const [detectingType, setDetectingType] = useState(false)

  // Tier info — used to gate premium document types
  const { allowedDocTypes, loading: tierLoading } = useTier()

  useEffect(() => {
    const sessionId = searchParams.get("sessionId")
    if (sessionId) {
      setSelectedSessionId(sessionId)
      setView("prompt")
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
          // New user — clear any stale session from localStorage
          localStorage.removeItem("clorefy_active_session")
          router.push("/onboarding"); return
        }
        // Check if business profile is actually filled out
        const { data: business } = await supabase
          .from("businesses")
          .select("name, country, email")
          .eq("user_id", user.id)
          .single()
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

    // If category is already selected, switch to prompt screen IMMEDIATELY
    if (selectedCategory) {
      setInitialPrompt(prompt)
      setPromptKey(prev => prev + 1)
      setView("prompt")

      // Handle file in background if attached (enriched prompt will be sent via initialPrompt update)
      if (file) {
        handleFileEnrichment(file, prompt).then(enriched => {
          if (enriched !== prompt) {
            setInitialPrompt(enriched)
            setPromptKey(prev => prev + 1)
          }
        })
      }
      return
    }

    // ── No category selected — detect type FIRST, then switch view ──
    // The detect-type endpoint uses server-side regex (not AI), so it's fast (~100ms).
    // We wait for the result to avoid creating a session with the wrong document type.
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
        }
      } catch (error) {
        console.error("Detection error:", error)
        // Fall back to Invoice — already set as default above
      }

      // ── Tier gate: block premium types for free users ──
      const detectedLower = detectedCategory.toLowerCase()
      if (!tierLoading && !allowedDocTypes.includes(detectedLower)) {
        // User tried to create a premium doc type (quotation/proposal) on free tier
        setDetectingType(false)
        toast.error(`${detectedCategory}s are available on paid plans`, {
          description: "Upgrade to Starter to unlock Quotations and Proposals.",
          action: {
            label: "Upgrade",
            onClick: () => router.push("/billing"),
          },
          duration: 6000,
        })
        return // Stay on start screen
      }

      // Set the correct category and switch to prompt view
      setSelectedCategory(detectedCategory)
      setInitialPrompt(enrichedPrompt)
      setPromptKey(prev => prev + 1)
      setView("prompt")
    } catch (error) {
      console.error("Error in prompt submission:", error)
      // Fallback: just go with Invoice
      setSelectedCategory("Invoice")
      setInitialPrompt(prompt)
      setPromptKey(prev => prev + 1)
      setView("prompt")
    } finally {
      setDetectingType(false)
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

  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory(category)
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
    localStorage.removeItem("clorefy_active_session")
    // Clear sessionId from URL
    const url = new URL(window.location.href)
    url.searchParams.delete("sessionId")
    router.replace(url.pathname + (url.search || ""))
  }, [router])

  if (authLoading || checkingOnboarding) {
    return <PageLoader />
  }

  if (view === "prompt") {
    return (
      <div key={promptKey} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
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
          initialCategory={selectedCategory}
          initialPrompt={initialPrompt}
          selectedSessionId={selectedSessionId}
        />
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-300 min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0">
        <InvoLogo size={36} showBeta />
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
            <InvoLogo size={80} />
            <h1 className="text-[40px] md:text-[48px] font-display font-medium tracking-tight text-foreground text-center text-balance leading-tight">
              {selectedCategory ? (
                <>{"Describe your "}<span className="font-medium relative text-amber-700 dark:text-amber-500">{selectedCategory.toLowerCase()}<span className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-amber-700/30 dark:bg-amber-500/30" /></span></>
              ) : (
                <>{"What do you want to "}<span className="font-medium relative text-amber-700 dark:text-amber-500">{"create"}<span className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-amber-700/30 dark:bg-amber-500/30" /></span>{"?"}</>
              )}
            </h1>
            <div className="w-full mt-2 relative">
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
              {/* Brief loading overlay while detecting document type */}
              {detectingType && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl z-10">
                  <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-card border border-border/80 shadow-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">Detecting document type…</span>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-2">
              <CategoryPills onSelect={handleCategorySelect} selectedCategory={selectedCategory} />
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}

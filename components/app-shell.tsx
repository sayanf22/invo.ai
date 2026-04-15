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

  useEffect(() => {
    const sessionId = searchParams.get("sessionId")
    if (sessionId) {
      setSelectedSessionId(sessionId)
      setView("prompt")
      loadSessionType(sessionId)
    } else {
      // Check localStorage for last active session — but only restore if valid
      const lastSession = localStorage.getItem("clorefy_active_session")
      if (lastSession) {
        try {
          const { sessionId: savedId, category } = JSON.parse(lastSession)
          if (savedId) {
            // Validate the session still exists before restoring
            supabase
              .from("document_sessions")
              .select("id")
              .eq("id", savedId)
              .single()
              .then(({ data }) => {
                if (data) {
                  setSelectedSessionId(savedId)
                  setSelectedCategory(category || "Invoice")
                  setView("prompt")
                } else {
                  localStorage.removeItem("clorefy_active_session")
                }
              })
          }
        } catch {
          localStorage.removeItem("clorefy_active_session")
        }
      }
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

    // No category selected — detect type first, but show prompt screen immediately with "Invoice" as default
    // Switch view NOW so user sees the screen instantly
    const defaultCategory = "Invoice"
    setSelectedCategory(defaultCategory)
    setInitialPrompt(prompt)
    setPromptKey(prev => prev + 1)
    setView("prompt")

    // Detect type in background and update if different
    try {
      let enrichedPrompt = prompt

      if (file) {
        enrichedPrompt = await handleFileEnrichment(file, prompt)
      }

      const response = await authFetch("/api/ai/detect-type", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: enrichedPrompt }),
      })
      if (response.ok) {
        const detection = await response.json()
        const t = detection.type as string
        const detected = t.charAt(0).toUpperCase() + t.slice(1)
        if (detected !== defaultCategory) {
          setSelectedCategory(detected)
        }
      }

      if (enrichedPrompt !== prompt) {
        setInitialPrompt(enrichedPrompt)
        setPromptKey(prev => prev + 1)
      }
    } catch (error) {
      console.error("Detection error:", error)
      // Already showing Invoice as default — no action needed
    }
  }, [selectedCategory])

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

  // Persist active session to localStorage so it survives page refresh
  useEffect(() => {
    if (view === "prompt" && selectedSessionId) {
      localStorage.setItem("clorefy_active_session", JSON.stringify({
        sessionId: selectedSessionId,
        category: selectedCategory,
      }))
    }
  }, [view, selectedSessionId, selectedCategory])

  const handleBack = useCallback(() => {
    setView("start")
    setSelectedCategory(undefined)
    setInitialPrompt(undefined)
    setPromptKey(0)
    localStorage.removeItem("clorefy_active_session")
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

      </main>
    </div>
  )
}

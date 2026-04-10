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

  const handlePromptSubmit = useCallback(async (prompt: string, file?: File) => {
    setSelectedSessionId(undefined)

    let enrichedPrompt = prompt

    // If a file is attached, analyze it with GPT first, then include extracted data in the prompt
    if (file) {
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
            if (extracted.businessName) parts.push(`Client business name: ${extracted.businessName}`)
            if (extracted.ownerName) parts.push(`Client contact person: ${extracted.ownerName}`)
            if (extracted.email) parts.push(`Client email: ${extracted.email}`)
            if (extracted.phone) parts.push(`Client phone: ${extracted.phone}`)
            if (extracted.address) {
              const a = extracted.address
              const addr = [a.street, a.city, a.state, a.postalCode].filter(Boolean).join(", ")
              if (addr) parts.push(`Client address: ${addr}`)
            }
            if (extracted.taxId) parts.push(`Client tax ID: ${extracted.taxId}`)
            if (extracted.services) parts.push(`Services/items from document: ${extracted.services}`)
            if (extracted.projectDescription) parts.push(`Project description: ${extracted.projectDescription}`)
            if (extracted.additionalContext) parts.push(`Additional context from document: ${extracted.additionalContext}`)

            const clientDetails = parts.join("\n")

            enrichedPrompt = prompt
              ? `${prompt}\n\nUse the following as the CLIENT/RECIPIENT details (Bill To). My own business details should be used as the sender (Bill From):\n${clientDetails}`
              : `Generate a document for the following client. Use their details as the recipient (Bill To). My business profile should be the sender (Bill From). Include the services/items listed below as line items:\n${clientDetails}`
          }
        }
      } catch (err) {
        console.error("File analysis error:", err)
        // Continue with just the text prompt if file analysis fails
      }
    }

    try {
      let category = selectedCategory
      if (!category) {
        const response = await authFetch("/api/ai/detect-type", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: enrichedPrompt }),
        })
        if (!response.ok) throw new Error("Failed to detect document type")
        const detection = await response.json()
        const t = detection.type as string
        category = t.charAt(0).toUpperCase() + t.slice(1)
        setSelectedCategory(category)
      }
      setInitialPrompt(enrichedPrompt)
      setPromptKey(prev => prev + 1)
      setView("prompt")
    } catch (error) {
      console.error("Detection error:", error)
      setSelectedCategory("Invoice")
      setInitialPrompt(enrichedPrompt)
      setPromptKey(prev => prev + 1)
      setView("prompt")
    }
  }, [selectedCategory])

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

      </main>
    </div>
  )
}

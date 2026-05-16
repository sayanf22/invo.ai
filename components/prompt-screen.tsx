"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { ArrowLeft, Eye, PenLine, MessageSquare, History as HistoryIcon } from "lucide-react"
import { EditorPanel } from "@/components/editor-panel"
import { DocumentPreview } from "@/components/document-preview"
import { InvoiceChat } from "@/components/invoice-chat"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { InvoLogo } from "@/components/invo-logo"
import { SessionHistorySidebar } from "@/components/session-history-sidebar"
import { ShareButton } from "@/components/share-button"
import { PDFDownloadButton } from "@/components/pdf-download-button"
import type { InvoiceData } from "@/lib/invoice-types"
import { getInitialInvoiceData } from "@/lib/invoice-types"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useSupabase } from "@/components/auth-provider"

type MobileTab = "chat" | "edit" | "preview"
const TAB_INDEX: Record<MobileTab, number> = { chat: 0, edit: 1, preview: 2 }

interface PromptScreenProps {
  onBack: () => void
  onSessionChange?: (sessionId: string) => void
  /** Called when the user selects a chat-type session from history. */
  onChatSessionSelect?: (sessionId: string) => void
  initialCategory?: string
  initialPrompt?: string
  selectedSessionId?: string
  isAnimating?: boolean
}

export function PromptScreen({
  onBack,
  onSessionChange,
  onChatSessionSelect,
  initialCategory,
  initialPrompt,
  selectedSessionId: initialSessionId,
  isAnimating,
}: PromptScreenProps) {
  const [data, setData] = useState<InvoiceData>(() => {
    const init = getInitialInvoiceData()
    if (initialCategory) init.documentType = initialCategory
    return init
  })
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat")
  const [showEditor, setShowEditor] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(initialSessionId)
  const [messageCount, setMessageCount] = useState(0)
  // Lock invoice editing after payment link is created (anti-fraud)
  const [invoiceLocked, setInvoiceLocked] = useState(false)
  // Tracks the current document session status so DocumentPreview can react to
  // status changes (e.g., clear lock state when document is cancelled — Bug 5 fix)
  const [documentSessionStatus, setDocumentSessionStatus] = useState("")
  // ── Chat-unlock signal ───────────────────────────────────────────
  // Bumped when the user unlocks via chat. DocumentPreview reads it as
  // `externallyUnlocked` and overrides its internal lock calculation
  // (which is based on stale sentAt etc).
  const [chatUnlockNonce, setChatUnlockNonce] = useState(0)

  // ── Single InvoiceChat: render only for mobile OR desktop, never both ──
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const supabase = useSupabase()

  // Called when InvoiceChat starts a new session (new conversation button)
  const handleChatSessionChange = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId)
    onSessionChange?.(sessionId)
  }, [onSessionChange])
  const saveContextRef = useRef<((data: InvoiceData) => Promise<void>) | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSaveContextReady = useCallback((saveFn: (data: InvoiceData) => Promise<void>) => {
    saveContextRef.current = saveFn
  }, [])

  const handleChange = useCallback((updates: Partial<InvoiceData>) => {
    setData((prev) => {
      const next = { ...prev, ...updates }
      // Debounce-persist to DB so the public /pay page always shows current data
      if (saveContextRef.current) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
          saveContextRef.current?.(next)
        }, 800)
      }
      return next
    })
  }, [])

  const handleSessionSelect = useCallback(async (sessionId: string) => {
    // Check if this is a chat-only session — if so, route to ChatOnlyScreen
    // instead of loading it into the split-screen.
    if (onChatSessionSelect) {
      try {
        const { data } = await supabase
          .from("document_sessions")
          .select("document_type")
          .eq("id", sessionId)
          .single()
        if (data?.document_type === "chat") {
          onChatSessionSelect(sessionId)
          return
        }
      } catch {
        // On error, fall through to normal behavior
      }
    }
    // Reset data to clean state — the new session's context will be loaded by InvoiceChat
    setData(prev => ({ ...getInitialInvoiceData(), design: prev.design }))
    setInvoiceLocked(false)
    setChatUnlockNonce(0)
    setDocumentSessionStatus("")
    setSelectedSessionId(sessionId)
    // Bubble up so AppShell can update the URL
    onSessionChange?.(sessionId)
  }, [onChatSessionSelect, onSessionChange, supabase])

  const [paymentLinkCancelledAt, setPaymentLinkCancelledAt] = useState<number>(0)
  // Stable no-op function for signaling cancellation to InvoiceChat
  const cancelledSignal = useCallback(() => {}, [])

  const handlePaymentLinkChange = useCallback((url: string, status: string) => {
    if (!url || status === "cancelled" || status === "expired") {
      // Link removed/cancelled — clear from PDF and signal chat
      handleChange({ paymentLink: "", paymentLinkStatus: undefined, showPaymentLinkInPdf: false })
      if (status === "cancelled") {
        setPaymentLinkCancelledAt(Date.now())
        setInvoiceLocked(false) // Unlock the document when payment link is cancelled
      }
    } else {
      handleChange({ paymentLink: url, paymentLinkStatus: status as any, showPaymentLinkInPdf: true })
    }
  }, [handleChange])

  const handleLockChange = useCallback((locked: boolean) => {
    setInvoiceLocked(locked)
  }, [])

  // ── Chat-unlock signal ───────────────────────────────────────────
  // When the user unlocks via the chat card, bump the nonce. The
  // DocumentPreview reads it as `externallyUnlocked` and overrides its
  // internal lock calculation (which is based on stale sentAt etc).
  const handleChatUnlock = useCallback(() => {
    setInvoiceLocked(false)
    setChatUnlockNonce(n => n + 1)
  }, [])

  const handleLinkedSessionCreate = useCallback((sessionId: string, docType: string) => {
    const capitalized = docType.charAt(0).toUpperCase() + docType.slice(1)
    // Preserve current design when creating a linked document
    const currentDesign = data.design
    setData(prev => ({ ...getInitialInvoiceData(), documentType: capitalized, design: currentDesign || prev.design }))
    setSelectedSessionId(sessionId)
    // Reset lock — new document has no payment link
    setInvoiceLocked(false)
    setChatUnlockNonce(0)
    setDocumentSessionStatus("")
    // Bubble up so AppShell can update the URL
    onSessionChange?.(sessionId)
  }, [data.design, onSessionChange])

  // Translate offset: 0% = chat, -100% = edit, -200% = preview
  const slideOffset = TAB_INDEX[mobileTab] * -100

  // ── Shared InvoiceChat props — used by exactly ONE instance at a time ──
  const chatProps = {
    data,
    onChange: handleChange,
    selectedSessionId,
    onSessionChange: handleChatSessionChange,
    onLinkedSessionCreate: handleLinkedSessionCreate,
    onChainSessionSelect: handleSessionSelect,
    onMessageCountChange: setMessageCount,
    onLockDocument: () => setInvoiceLocked(true),
    onUnlockDocument: handleChatUnlock,
    onPaymentLinkCancelled: paymentLinkCancelledAt > 0 ? cancelledSignal : undefined,
    onDocumentStatusChange: setDocumentSessionStatus,
    onSaveContext: handleSaveContextReady,
    initialPrompt,
  } as const

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center px-3 py-2.5 border-b border-border bg-card shrink-0 relative gap-2"
        style={{ boxShadow: "0 1px 0 0 rgba(0,0,0,0.06), 0 4px 16px -4px rgba(0,0,0,0.1)" }}
      >
        {/* Left: back + logo+beta */}
        <div className="flex items-center gap-2 shrink-0 z-10">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center w-9 h-9 rounded-2xl bg-background border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-200 active:scale-95 shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <InvoLogo size={26} />
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Mobile tab switcher — compact, no overflow */}
        <div className="flex items-center md:hidden shrink-0 bg-secondary/60 border border-border/50 rounded-2xl p-[3px] shadow-sm z-10"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)" }}
        >
          {(["chat", "edit", "preview"] as MobileTab[]).map((tab) => {
            const icons = { chat: MessageSquare, edit: PenLine, preview: Eye }
            const labels = { chat: "Chat", edit: "Edit", preview: "View" }
            const Icon = icons[tab]
            const isActive = mobileTab === tab
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setMobileTab(tab)}
                className={cn(
                  "relative flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold transition-colors duration-150 active:scale-95 select-none touch-manipulation whitespace-nowrap",
                  isActive
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={isActive ? {
                  boxShadow: "0 1px 4px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.08)"
                } : undefined}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{labels[tab]}</span>
                {tab === "chat" && messageCount > 0 && (
                  <span className={cn(
                    "text-[9px] font-bold px-1 py-0.5 rounded-full leading-none min-w-[14px] text-center",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>{messageCount}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Desktop controls — hidden on mobile */}
        <div className="hidden md:flex items-center gap-2 shrink-0 justify-end z-10">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-200 whitespace-nowrap shrink-0 border",
              showHistory
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border text-foreground hover:bg-secondary shadow-sm"
            )}
          >
            <HistoryIcon className="w-4 h-4 shrink-0" />
            <span key={showHistory ? "hide" : "history"} className="hidden lg:inline text-sm animate-text-swap">
              {showHistory ? "Hide" : "History"}
            </span>
          </button>
          <div className="shrink-0 w-10 h-10 relative">
            <HamburgerMenu />
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Desktop: history sidebar — always mounted, animated in/out */}
        <div className={cn(
          "hidden md:flex transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden shrink-0",
          showHistory ? "w-[300px] opacity-100" : "w-0 opacity-0"
        )}>
          <div className="w-[300px] shrink-0">
            <SessionHistorySidebar
              currentSessionId={selectedSessionId}
              onSessionSelect={handleSessionSelect}
              documentType={data.documentType?.toLowerCase() || "invoice"}
            />
          </div>
        </div>

        {/* ── MOBILE: 3-panel sliding track ── */}
        <div className="md:hidden flex-1 relative overflow-hidden">
          {/* Absolute-positioned track fills the container exactly */}
          <div
            className="absolute inset-0 flex transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ width: "300%", transform: `translateX(calc(${slideOffset}% / 3))` }}
          >
            {/* Each panel is 1/3 of the 300%-wide track = exactly 100vw wide and 100% tall */}
            <div style={{ width: "33.3334%", height: "100%" }} className="flex flex-col">
              {/* MOBILE CHAT: only rendered when NOT desktop — prevents duplicate InvoiceChat */}
              {!isDesktop && <InvoiceChat {...chatProps} />}
            </div>

            <div style={{ width: "33.3334%", height: "100%" }} className="flex flex-col">
              {mobileTab === "edit" && <EditorPanel data={data} onChange={handleChange} />}
            </div>

            <div style={{ width: "33.3334%", height: "100%" }} className="flex flex-col">
              <DocumentPreview
                data={data}
                onChange={invoiceLocked ? undefined : handleChange}
                onToggleEditor={() => setMobileTab("edit")}
                showEditor={mobileTab === "edit"}
                sessionId={selectedSessionId}
                onPaymentLinkChange={handlePaymentLinkChange}
                onLockChange={handleLockChange}
                externallyUnlocked={chatUnlockNonce > 0}
                documentStatus={documentSessionStatus}
                onDocumentCancelled={() => {
                  setDocumentSessionStatus("cancelled")
                  setInvoiceLocked(false)
                  setChatUnlockNonce(0)
                }}
              />
            </div>
          </div>
        </div>

        {/* ── DESKTOP: chat+editor left panel ── */}
        <div
          className={cn(
            "hidden md:flex bg-card shrink-0 flex-col relative z-10",
            "transition-all duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
            !isAnimating && "w-[420px] lg:w-[460px]"
          )}
          style={{
            width: isAnimating ? "100%" : undefined,
            borderRight: "1px solid hsl(var(--border) / 0.6)",
            boxShadow: "2px 0 20px -4px rgba(0,0,0,0.1)",
          }}
        >
          <div className="flex flex-col flex-1 relative overflow-hidden">
            {/* Chat */}
            <div className={cn(
              "absolute inset-0 flex flex-col transition-all duration-300 ease-in-out",
              showEditor ? "-translate-x-full opacity-0 pointer-events-none" : "translate-x-0 opacity-100"
            )}>
              {/* DESKTOP CHAT: only rendered when IS desktop — prevents duplicate InvoiceChat */}
              {isDesktop && <InvoiceChat {...chatProps} />}
            </div>
            {/* Editor */}
            <div className={cn(
              "absolute inset-0 flex flex-col transition-all duration-300 ease-in-out",
              showEditor ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
            )}>
              {showEditor && <EditorPanel data={data} onChange={handleChange} />}
            </div>
          </div>
        </div>

        {/* ── DESKTOP: preview panel ── */}
        <div
          className={cn(
            "hidden md:flex flex-1 bg-background overflow-hidden flex-col",
            "transition-all duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
          )}
          style={{
            opacity: isAnimating ? 0 : 1,
            transform: isAnimating ? "translateX(40px)" : "translateX(0)",
          }}
        >
          <DocumentPreview
            data={data}
            onChange={invoiceLocked ? undefined : handleChange}
            onToggleEditor={() => setShowEditor(e => !e)}
            showEditor={showEditor}
            sessionId={selectedSessionId}
            onPaymentLinkChange={handlePaymentLinkChange}
            onLockChange={handleLockChange}
            externallyUnlocked={chatUnlockNonce > 0}
            documentStatus={documentSessionStatus}
            onDocumentCancelled={() => {
              setDocumentSessionStatus("cancelled")
              setInvoiceLocked(false)
              setChatUnlockNonce(0)
            }}
          />
        </div>
      </div>

      {/* Mobile floating action buttons — preview tab only */}
      {mobileTab === "preview" && (data.documentType || data.fromName || data.toName) && (
        <div className="md:hidden fixed bottom-6 right-4 z-50 flex items-center gap-2">
          <ShareButton data={data} className="shadow-lg bg-card" />
          <PDFDownloadButton data={data} size="default" variant="default" />
        </div>
      )}
    </div>
  )
}

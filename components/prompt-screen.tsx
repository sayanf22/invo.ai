"use client"

import { useState, useCallback } from "react"
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

type MobileTab = "chat" | "edit" | "preview"
const TAB_INDEX: Record<MobileTab, number> = { chat: 0, edit: 1, preview: 2 }

interface PromptScreenProps {
  onBack: () => void
  initialCategory?: string
  initialPrompt?: string
  selectedSessionId?: string
}

export function PromptScreen({
  onBack,
  initialCategory,
  initialPrompt,
  selectedSessionId: initialSessionId,
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

  const handleChange = useCallback((updates: Partial<InvoiceData>) => {
    setData((prev) => ({ ...prev, ...updates }))
  }, [])

  const handleSessionSelect = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId)
  }, [])

  const handleLinkedSessionCreate = useCallback((sessionId: string, docType: string) => {
    const capitalized = docType.charAt(0).toUpperCase() + docType.slice(1)
    setData({ ...getInitialInvoiceData(), documentType: capitalized })
    setSelectedSessionId(sessionId)
  }, [])

  // Translate offset: 0% = chat, -100% = edit, -200% = preview
  const slideOffset = TAB_INDEX[mobileTab] * -100

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center px-4 py-3 border-b border-border bg-card shrink-0"
        style={{ boxShadow: "0 1px 0 0 rgba(0,0,0,0.06), 0 4px 16px -4px rgba(0,0,0,0.1)" }}
      >
        {/* Left: back */}
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-9 h-9 rounded-2xl bg-background border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-200 active:scale-95 shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Center logo — flex-1 so it truly centers */}
        <div className="flex-1 flex justify-center">
          <InvoLogo size={30} />
        </div>

        {/* Mobile tab switcher */}
        <div className="flex items-center gap-1 md:hidden shrink-0 bg-secondary/50 border border-border/40 rounded-2xl p-1 shadow-sm">
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
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 active:scale-95",
                  isActive
                    ? "bg-background text-foreground shadow-md shadow-black/8"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{labels[tab]}</span>
                {tab === "chat" && messageCount > 0 && (
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[16px] text-center",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>{messageCount}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Desktop controls — fixed width so they never overlap */}
        <div className="hidden md:flex items-center gap-2 shrink-0 min-w-[140px] justify-end">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0",
              showHistory ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-foreground hover:bg-secondary/50"
            )}
          >
            <HistoryIcon className="w-4 h-4 shrink-0" />
            <span className="hidden lg:inline">{showHistory ? "Hide" : "History"}</span>
          </button>
          {/* Fixed-size wrapper prevents layout shift when button goes fixed */}
          <div className="shrink-0 w-10 h-10 relative">
            <HamburgerMenu />
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Desktop: history sidebar */}
        <div className={cn(
          "hidden md:block transition-all duration-300 ease-in-out overflow-hidden shrink-0",
          showHistory ? "w-[320px] opacity-100" : "w-0 opacity-0"
        )}>
          {showHistory && (
            <SessionHistorySidebar
              currentSessionId={selectedSessionId}
              onSessionSelect={handleSessionSelect}
              documentType={data.documentType?.toLowerCase() || "invoice"}
            />
          )}
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
              <InvoiceChat
                data={data}
                onChange={handleChange}
                selectedSessionId={selectedSessionId}
                onSessionChange={setSelectedSessionId}
                onLinkedSessionCreate={handleLinkedSessionCreate}
                onChainSessionSelect={handleSessionSelect}
                onMessageCountChange={setMessageCount}
                initialPrompt={initialPrompt}
              />
            </div>

            <div style={{ width: "33.3334%", height: "100%" }} className="flex flex-col">
              <EditorPanel data={data} onChange={handleChange} />
            </div>

            <div style={{ width: "33.3334%", height: "100%" }} className="flex flex-col">
              <DocumentPreview
                data={data}
                onChange={handleChange}
                onToggleEditor={() => setMobileTab("edit")}
                showEditor={mobileTab === "edit"}
              />
            </div>
          </div>
        </div>

        {/* ── DESKTOP: chat+editor left panel ── */}
        <div className="hidden md:flex w-[420px] lg:w-[460px] bg-card shrink-0 flex-col relative z-10"
          style={{
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
              <InvoiceChat
                data={data}
                onChange={handleChange}
                selectedSessionId={selectedSessionId}
                onSessionChange={setSelectedSessionId}
                onLinkedSessionCreate={handleLinkedSessionCreate}
                onChainSessionSelect={handleSessionSelect}
                onMessageCountChange={setMessageCount}
                initialPrompt={initialPrompt}
              />
            </div>
            {/* Editor */}
            <div className={cn(
              "absolute inset-0 flex flex-col transition-all duration-300 ease-in-out",
              showEditor ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
            )}>
              <EditorPanel data={data} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* ── DESKTOP: preview panel ── */}
        <div className="hidden md:flex flex-1 bg-background overflow-hidden flex-col transition-opacity duration-300">
          <DocumentPreview data={data} onChange={handleChange} onToggleEditor={() => setShowEditor(e => !e)} showEditor={showEditor} />
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

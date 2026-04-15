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
    if (initialCategory) {
      init.documentType = initialCategory
    }
    return init
  })
  const [mobileTab, setMobileTab] = useState<"chat" | "edit" | "preview">("chat")
  const [showEditor, setShowEditor] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(initialSessionId)
  const [messageCount, setMessageCount] = useState(0)
  const handleChange = useCallback(
    (updates: Partial<InvoiceData>) => {
      setData((prev) => ({ ...prev, ...updates }))
    },
    []
  )

  const handleSessionSelect = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId)
  }, [])

  // When a linked document is created, switch to it and update the category
  const handleLinkedSessionCreate = useCallback((sessionId: string, docType: string) => {
    const capitalized = docType.charAt(0).toUpperCase() + docType.slice(1)
    setData({
      ...getInitialInvoiceData(),
      documentType: capitalized,
    })
    setSelectedSessionId(sessionId)
  }, [])

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      <header className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-card shadow-sm shrink-0">
        {/* Left: back button */}
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-2xl bg-background border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 hover:shadow-md transition-all duration-200 active:scale-95 shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Center: logo */}
        <div className="flex-1 flex justify-center">
          <InvoLogo size={32} />
        </div>

        {/* Right: mobile tabs */}
        <div className="flex items-center gap-1.5 md:hidden">
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 btn-press ${
              mobileTab === "chat"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
            {messageCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                mobileTab === "chat" ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
              }`}>{messageCount}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("edit")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 btn-press ${
              mobileTab === "edit"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenLine className="w-4 h-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 btn-press ${
              mobileTab === "preview"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
        </div>

        {/* Right: desktop controls — each item shrinks-0 so they never overlap */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 btn-press whitespace-nowrap ${
              showHistory
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-foreground hover:bg-secondary/50 hover:shadow-sm"
            }`}
          >
            <HistoryIcon className="w-4 h-4 shrink-0" />
            <span>{showHistory ? "Hide History" : "History"}</span>
          </button>
          <HamburgerMenu />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* History Sidebar with slide animation */}
        <div
          className={cn(
            "hidden md:block transition-all duration-300 ease-in-out overflow-hidden shrink-0",
            showHistory ? "w-[320px] opacity-100" : "w-0 opacity-0"
          )}
        >
          {showHistory && (
            <SessionHistorySidebar
              currentSessionId={selectedSessionId}
              onSessionSelect={handleSessionSelect}
              documentType={data.documentType?.toLowerCase() || "invoice"}
            />
          )}
        </div>

        {/* Chat/Editor Panel — single instance of each, shared across mobile & desktop */}
        <div
          className={`w-full md:w-[420px] lg:w-[460px] border-r border-border bg-card shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)] shrink-0 flex flex-col ${
            mobileTab === "chat" || mobileTab === "edit" ? "flex overflow-hidden" : "hidden md:flex overflow-hidden"
          }`}
        >
          {/* Mobile: simple show/hide — overflow-y-auto so the panel scrolls end-to-end */}
          <div className="md:hidden flex flex-col flex-1 min-h-0">
            {mobileTab === "chat" && (
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
            )}
            {mobileTab === "edit" && (
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <EditorPanel data={data} onChange={handleChange} />
              </div>
            )}
          </div>

          {/* Desktop: slide animation between chat and editor */}
          <div className="hidden md:flex flex-col flex-1 relative overflow-hidden">
            {/* Chat panel */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col transition-all duration-300 ease-in-out",
                showEditor ? "-translate-x-full opacity-0 pointer-events-none" : "translate-x-0 opacity-100"
              )}
            >
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
            {/* Editor panel */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col transition-all duration-300 ease-in-out",
                showEditor ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
              )}
            >
              <EditorPanel data={data} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Preview Panel — always mounted, toggled via CSS */}
        <div
          className={`flex-1 bg-background overflow-hidden flex flex-col ${
            mobileTab === "preview" ? "flex" : "hidden md:flex"
          }`}
        >
          <DocumentPreview data={data} onChange={handleChange} onToggleEditor={() => setShowEditor(e => !e)} showEditor={showEditor} />
        </div>
      </div>

      {/* Mobile floating buttons — only on preview tab */}
      {mobileTab === "preview" && (data.documentType || data.fromName || data.toName) && (
        <div className="md:hidden fixed bottom-6 right-4 z-50 flex items-center gap-2">
          <ShareButton data={data} className="shadow-lg bg-card" />
          <PDFDownloadButton data={data} size="default" variant="default" />
        </div>
      )}
    </div>
  )
}

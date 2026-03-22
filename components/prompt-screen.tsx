"use client"

import { useState, useCallback } from "react"
import { ArrowLeft, Eye, PenLine, MessageSquare, Edit3, History as HistoryIcon } from "lucide-react"
import { EditorPanel } from "@/components/editor-panel"
import { DocumentPreview } from "@/components/document-preview"
import { InvoiceChat } from "@/components/invoice-chat"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { InvoLogo } from "@/components/invo-logo"
import { SessionHistorySidebar } from "@/components/session-history-sidebar"
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
  const [showHistory, setShowHistory] = useState(false) // Changed from true to false
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(initialSessionId)
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
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card shadow-sm shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-2xl bg-background border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 hover:shadow-md transition-all duration-200 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <span className="text-base font-semibold text-foreground tracking-tight">
          <InvoLogo size={32} />
        </span>

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

        <div className="hidden md:flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 btn-press ${
              showHistory
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-foreground hover:bg-secondary/50 hover:shadow-sm"
            }`}
          >
            <HistoryIcon className="w-[18px] h-[18px]" />
            {showHistory ? "Hide History" : "Show History"}
          </button>
          <button
            type="button"
            onClick={() => setShowEditor(!showEditor)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 btn-press ${
              showEditor
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-foreground hover:bg-secondary/50 hover:shadow-sm"
            }`}
          >
            <Edit3 className="w-[18px] h-[18px]" />
            {showEditor ? "Hide Editor" : "Show Editor"}
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
          className={`w-full md:w-[420px] lg:w-[460px] border-r border-border bg-card shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)] shrink-0 overflow-hidden flex flex-col ${
            mobileTab === "chat" || mobileTab === "edit" ? "flex" : "hidden md:flex"
          }`}
        >
          <div className="flex flex-col h-full relative overflow-hidden">
            {/* Chat panel */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col",
                // Mobile: simple show/hide, no animation
                mobileTab !== "chat" && "max-md:hidden",
                // Desktop: slide animation for editor toggle
                "md:transition-all md:duration-300 md:ease-in-out",
                showEditor ? "md:-translate-x-full md:opacity-0" : "md:translate-x-0 md:opacity-100"
              )}
            >
              <InvoiceChat 
                data={data} 
                onChange={handleChange}
                selectedSessionId={selectedSessionId}
                onSessionChange={setSelectedSessionId}
                onLinkedSessionCreate={handleLinkedSessionCreate}
                onChainSessionSelect={handleSessionSelect}
                initialPrompt={initialPrompt}
              />
            </div>
            {/* Editor panel */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col",
                // Mobile: simple show/hide, no animation
                mobileTab !== "edit" && "max-md:hidden",
                // Desktop: slide animation for editor toggle
                "md:transition-all md:duration-300 md:ease-in-out",
                showEditor ? "md:translate-x-0 md:opacity-100" : "md:translate-x-full md:opacity-0"
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

      {/* Mobile floating download button — only on preview tab */}
      {mobileTab === "preview" && (data.documentType || data.fromName || data.toName) && (
        <div className="md:hidden fixed bottom-6 right-4 z-50">
          <PDFDownloadButton data={data} size="default" variant="default" />
        </div>
      )}
    </div>
  )
}

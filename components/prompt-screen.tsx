"use client"

import { useState, useCallback } from "react"
import { ArrowLeft, Eye, PenLine } from "lucide-react"
import { EditorPanel } from "@/components/editor-panel"
import { DocumentPreview } from "@/components/document-preview"
import { BuilderPromptBar } from "@/components/builder-prompt-bar"
import { UserProfileMenu } from "@/components/user-profile-menu"
import type { InvoiceData } from "@/lib/invoice-types"
import { getInitialInvoiceData } from "@/lib/invoice-types"

interface PromptScreenProps {
  onBack: () => void
  initialCategory?: string
  initialPrompt?: string
}

export function PromptScreen({
  onBack,
  initialCategory,
  initialPrompt,
}: PromptScreenProps) {
  const [data, setData] = useState<InvoiceData>(() => {
    const init = getInitialInvoiceData()
    if (initialCategory) {
      init.documentType = initialCategory
    }
    if (initialPrompt) {
      init.description = initialPrompt
    }
    return init
  })
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit")

  const handleChange = useCallback(
    (updates: Partial<InvoiceData>) => {
      setData((prev) => ({ ...prev, ...updates }))
    },
    []
  )

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-background border border-border group-hover:border-primary/30 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </span>
          <span className="text-sm font-medium hidden sm:inline">Back</span>
        </button>

        <span className="text-sm font-semibold text-foreground tracking-tight">
          Invo.ai
        </span>

        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={() => setMobileTab("edit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mobileTab === "edit"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mobileTab === "preview"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>

        <div className="hidden md:block">
          <UserProfileMenu />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div
          className={`w-full md:w-[420px] lg:w-[460px] border-r border-border bg-card shrink-0 overflow-hidden flex flex-col ${mobileTab === "edit" ? "flex" : "hidden md:flex"
            }`}
        >
          <EditorPanel data={data} onChange={handleChange} />
          <BuilderPromptBar data={data} onChange={handleChange} />
        </div>

        <div
          className={`flex-1 bg-background overflow-hidden ${mobileTab === "preview" ? "flex" : "hidden md:flex"
            }`}
        >
          <div className="flex-1 flex flex-col">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2 shrink-0">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Live Preview
              </span>
              {data.documentType && (
                <span className="ml-auto text-xs text-primary font-medium">
                  {data.documentType}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              <DocumentPreview data={data} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

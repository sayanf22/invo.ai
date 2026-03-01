"use client"

import React from "react"

import { useState, useRef } from "react"
import { Plus, Clock, ChevronDown, ArrowUp, Lock } from "lucide-react"
import { useRequireAuth } from "@/hooks/use-require-auth"

interface PromptInputProps {
  onSubmit?: (prompt: string) => void
  placeholder?: string
}

export function PromptInput({ onSubmit, placeholder }: PromptInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { isAuthenticated, requireAuth, isLoading } = useRequireAuth()

  const canSubmit = value.trim().length > 0

  // Wrap onSubmit with auth requirement
  const handleSubmit = requireAuth(() => {
    if (canSubmit && onSubmit) {
      onSubmit(value.trim())
    }
  })

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="w-full max-w-[720px] mx-auto">
      <div className="rounded-2xl border border-border bg-card shadow-sm focus-within:shadow-md focus-within:border-primary/30 transition-all">
        <div className="px-6 pt-5 pb-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Describe your document... e.g. Create an invoice for web design services"}
            rows={3}
            className="w-full text-[16px] text-foreground placeholder:text-muted-foreground/50 bg-transparent outline-none resize-none leading-relaxed"
          />
        </div>
        <div className="flex items-center justify-between px-5 pb-4">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200 btn-icon-bounce"
              aria-label="Add attachment"
            >
              <Plus className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200 btn-icon-bounce"
              aria-label="History"
            >
              <Clock className="w-[18px] h-[18px]" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[14px] text-muted-foreground">
              <span className="font-medium">Invo AI</span>
              <ChevronDown className="w-4 h-4" />
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isLoading}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ${canSubmit && !isLoading
                ? "bg-foreground text-background hover:opacity-90 active:scale-90 send-ready"
                : "bg-secondary text-muted-foreground/40 cursor-not-allowed"
                }`}
              aria-label={isAuthenticated ? "Submit prompt" : "Sign in to submit"}
              title={!isAuthenticated ? "Sign in to use AI features" : undefined}
            >
              {isAuthenticated ? (
                <ArrowUp className="w-[18px] h-[18px]" />
              ) : (
                <Lock className="w-[18px] h-[18px]" />
              )}
            </button>
          </div>
        </div>
      </div>
      <p className="text-center text-[13px] text-muted-foreground mt-3">
        {isAuthenticated ? (
          "AI generates structured data only. Always review your documents."
        ) : (
          <span className="flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            {"Sign in to generate documents with AI"}
          </span>
        )}
      </p>
    </div>
  )
}

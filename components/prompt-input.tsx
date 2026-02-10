"use client"

import React from "react"

import { useState, useRef } from "react"
import { Plus, Clock, ChevronDown, ArrowUp, Lock } from "lucide-react"
import { useRequireAuth } from "@/hooks/use-require-auth"

interface PromptInputProps {
  onSubmit?: (prompt: string) => void
}

export function PromptInput({ onSubmit }: PromptInputProps) {
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
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-2xl border border-border bg-card shadow-sm focus-within:shadow-md focus-within:border-primary/30 transition-all">
        <div className="px-5 pt-4 pb-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your document... e.g. Create an invoice for web design services"
            rows={2}
            className="w-full text-base text-foreground placeholder:text-muted-foreground/50 bg-transparent outline-none resize-none leading-relaxed"
          />
        </div>
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Add attachment"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="History"
            >
              <Clock className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-medium">Invo AI</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isLoading}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${canSubmit && !isLoading
                ? "bg-foreground text-background hover:opacity-90"
                : "bg-secondary text-muted-foreground/40 cursor-not-allowed"
                }`}
              aria-label={isAuthenticated ? "Submit prompt" : "Sign in to submit"}
              title={!isAuthenticated ? "Sign in to use AI features" : undefined}
            >
              {isAuthenticated ? (
                <ArrowUp className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-3">
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

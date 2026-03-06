"use client"

import React from "react"
import { Lock } from "lucide-react"
import { useRequireAuth } from "@/hooks/use-require-auth"
import { PromptInputBox } from "@/components/ui/ai-prompt-box"

interface PromptInputProps {
  onSubmit?: (prompt: string) => void
  placeholder?: string
}

export function PromptInput({ onSubmit, placeholder }: PromptInputProps) {
  const { isAuthenticated, requireAuth, isLoading } = useRequireAuth()

  const wrappedSubmit = requireAuth((...args: unknown[]) => {
    const message = args[0] as string
    if (message && onSubmit) onSubmit(message)
  })

  const handleSend = (message: string) => {
    wrappedSubmit(message)
  }

  return (
    <div className="w-full max-w-[720px] mx-auto">
      <PromptInputBox
        onSend={handleSend}
        isLoading={isLoading}
        disabled={isLoading}
        placeholder={
          placeholder ||
          "Describe your document... e.g. Create an invoice for web design services"
        }
      />
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

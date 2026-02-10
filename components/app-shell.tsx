"use client"

import { useState, useCallback } from "react"
import { InvoLogo } from "@/components/invo-logo"
import { PromptInput } from "@/components/prompt-input"
import { CategoryPills } from "@/components/category-pills"
import { PromptScreen } from "@/components/prompt-screen"
import { UserProfileMenu } from "@/components/user-profile-menu"

type View = "start" | "prompt"

export function AppShell() {
  const [view, setView] = useState<View>("start")
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    undefined
  )
  const [initialPrompt, setInitialPrompt] = useState("")

  const handlePromptSubmit = useCallback((prompt: string) => {
    setInitialPrompt(prompt)
    setSelectedCategory(undefined)
    setView("prompt")
  }, [])

  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory(category)
    setInitialPrompt("")
    setView("prompt")
  }, [])

  const handleBack = useCallback(() => {
    setView("start")
    setSelectedCategory(undefined)
    setInitialPrompt("")
  }, [])

  if (view === "prompt") {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <PromptScreen
          onBack={handleBack}
          initialCategory={selectedCategory}
          initialPrompt={initialPrompt}
        />
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-300 min-h-screen flex flex-col">
      {/* Top bar with profile */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0">
        <span className="text-sm font-semibold text-foreground tracking-tight">
          Invo.ai
        </span>
        <UserProfileMenu />
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
          <div className="mb-2">
            <InvoLogo />
          </div>

          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-foreground text-center text-balance">
            {"What do you want to "}
            <span className="font-medium relative">
              {"create"}
              <span className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-primary" />
            </span>
            {"?"}
          </h1>

          <div className="w-full mt-4">
            <PromptInput onSubmit={handlePromptSubmit} />
          </div>

          <div className="mt-2">
            <CategoryPills onSelect={handleCategorySelect} />
          </div>
        </div>
      </main>
    </div>
  )
}

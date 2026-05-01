"use client"

import { useState } from "react"
import { HelpCircle } from "lucide-react"
import { SupportForm } from "@/components/onboarding-support-form"
import type { OnboardingPhase } from "@/lib/onboarding-utils"

interface OnboardingSupportButtonProps {
  currentPhase: OnboardingPhase
  userEmail: string
}

export function OnboardingSupportButton({
  currentPhase,
  userEmail,
}: OnboardingSupportButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Inline header button — sits in the header next to "Skip for now" */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[36px]"
        aria-label="Need help? Contact support"
      >
        <HelpCircle className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Help</span>
      </button>

      <SupportForm
        currentPhase={currentPhase}
        userEmail={userEmail}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

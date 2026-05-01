"use client"

import { useState } from "react"
import { MessageCircleQuestion } from "lucide-react"
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
      {/* Floating support button — pill shape with icon + label */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-foreground text-background shadow-lg hover:opacity-90 active:scale-95 transition-all min-h-[44px]"
        aria-label="Need help? Contact support"
      >
        <MessageCircleQuestion className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium hidden sm:inline">Need help?</span>
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

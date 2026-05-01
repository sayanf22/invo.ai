"use client"

import { useState } from "react"
import { HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
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
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 h-10 w-10 min-w-[44px] min-h-[44px] rounded-full bg-muted hover:bg-muted-foreground/10 shadow-sm"
        aria-label="Get support"
      >
        <HelpCircle className="h-5 w-5 text-muted-foreground" />
      </Button>

      <SupportForm
        currentPhase={currentPhase}
        userEmail={userEmail}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

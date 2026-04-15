"use client"

import { Sparkles, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useRazorpay } from "@/hooks/use-razorpay"
import { toast } from "sonner"

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tier: string
  currentUsage?: number
  limit?: number
  errorType: "limit" | "type_restriction" | "feature_restricted"
  message?: string
  onUpgradeSuccess?: () => void
}

const TIER_DISPLAY: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
}

// Maps current tier → recommended upgrade
const NEXT_TIER: Record<string, { id: string; name: string; docsPerMonth: number }> = {
  free:    { id: "starter", name: "Starter", docsPerMonth: 50 },
  starter: { id: "pro",     name: "Pro",     docsPerMonth: 150 },
  pro:     { id: "agency",  name: "Agency",  docsPerMonth: 0 },
}

export function UpgradeModal({
  open,
  onOpenChange,
  tier,
  currentUsage,
  limit,
  errorType,
  message,
  onUpgradeSuccess,
}: UpgradeModalProps) {
  const planName = TIER_DISPLAY[tier] || "Free"
  const next = NEXT_TIER[tier] || NEXT_TIER.free

  const { subscribe, isProcessing } = useRazorpay({
    onSuccess: () => {
      toast.success(`🎉 Upgraded to ${next.name}! You can now create more documents.`)
      onOpenChange(false)
      // Give the parent a chance to re-check limits
      setTimeout(() => onUpgradeSuccess?.(), 500)
    },
  })

  const headline =
    errorType === "limit"
      ? "Document limit reached"
      : errorType === "type_restriction"
        ? "Document type not available"
        : "Feature not available on your plan"

  const description =
    message ||
    (errorType === "limit"
      ? "You've used all your documents for this month."
      : errorType === "type_restriction"
        ? "This document type requires a paid plan."
        : "Upgrade your plan to unlock this feature.")

  const usageLine =
    errorType === "limit" && currentUsage != null && limit != null
      ? `${planName} Plan — ${currentUsage}/${limit} documents used`
      : `${planName} Plan`

  const upgradeHint =
    next.docsPerMonth > 0
      ? `Upgrade to ${next.name} for ${next.docsPerMonth} documents/month`
      : `Upgrade to ${next.name} for unlimited documents`

  const canUpgradeInline = next.id !== "agency" // Agency is coming soon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl shadow-sm">
        <DialogHeader className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-lg font-semibold">
            {headline}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
            {usageLine}
          </div>
          <p className="text-center text-sm font-medium text-foreground">
            {upgradeHint}
          </p>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          {canUpgradeInline ? (
            <Button
              className="w-full rounded-2xl gap-2"
              disabled={isProcessing}
              onClick={() => subscribe(next.id, "monthly")}
            >
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Upgrade to {next.name} now</>
              )}
            </Button>
          ) : (
            <Button asChild className="w-full rounded-2xl gap-2">
              <a href="/billing">View Plans</a>
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full rounded-2xl"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

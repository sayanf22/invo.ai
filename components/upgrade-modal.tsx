"use client"

import Link from "next/link"
import { ArrowUpRight, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tier: string
  currentUsage?: number
  limit?: number
  errorType: "limit" | "type_restriction" | "feature_restricted"
  message?: string
}

const TIER_DISPLAY: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
}

const NEXT_TIER: Record<string, { name: string; docsPerMonth: number }> = {
  free: { name: "Starter", docsPerMonth: 50 },
  starter: { name: "Pro", docsPerMonth: 150 },
  pro: { name: "Agency", docsPerMonth: 0 },
}

export function UpgradeModal({
  open,
  onOpenChange,
  tier,
  currentUsage,
  limit,
  errorType,
  message,
}: UpgradeModalProps) {
  const planName = TIER_DISPLAY[tier] || "Free"
  const next = NEXT_TIER[tier] || NEXT_TIER.free

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
          <Button asChild className="w-full rounded-2xl gap-2">
            <Link href="/pricing">
              View Plans
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
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

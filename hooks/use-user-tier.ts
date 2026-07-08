"use client"

/**
 * useUserTier — reads the current user's subscription tier client-side.
 * Used to gate tier-restricted features (e.g. reference context is Pro+).
 */

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { parseTier } from "@/lib/cost-protection"

export type Tier = "free" | "starter" | "pro" | "agency"

/** Reference context (RAG) is a Pro-and-above feature. */
export function isReferenceContextEnabled(tier: Tier): boolean {
  return tier === "pro" || tier === "agency"
}

export function useUserTier(): Tier {
  const [tier, setTier] = useState<Tier>("free")

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data } = await (supabase as any)
          .from("subscriptions")
          .select("plan")
          .eq("user_id", user.id)
          .single()
        if (!cancelled && data?.plan) setTier(parseTier(data.plan) as Tier)
      } catch {
        /* default free */
      }
    })()
    return () => { cancelled = true }
  }, [])

  return tier
}

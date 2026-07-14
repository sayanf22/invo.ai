"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/components/auth-provider"
import { useSupabase } from "@/components/auth-provider"
import { getTierLimits, resolveEffectiveTier, type UserTier } from "@/lib/cost-protection"

export interface TierInfo {
  tier: UserTier
  allowedDocTypes: string[]
  loading: boolean
}

/**
 * Returns the current user's tier and allowed document types.
 * Used to enforce tier restrictions in the UI.
 * Server-side enforcement is in /api/ai/stream and /api/sessions/create.
 */
export function useTier(): TierInfo {
  const user = useUser()
  const supabase = useSupabase()
  const [tier, setTier] = useState<UserTier>("free")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!user) { if (!cancelled) setLoading(false); return }
      try {
        const { data } = await (supabase as any)
          .from("subscriptions")
          .select("plan,status,current_period_end")
          .eq("user_id", user.id)
          .maybeSingle()
        if (!cancelled) setTier(resolveEffectiveTier(data))
      } catch {
        /* keep free on error */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const limits = getTierLimits(tier)

  return {
    tier,
    allowedDocTypes: limits.allowedDocTypes,
    loading,
  }
}

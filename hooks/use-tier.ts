"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/components/auth-provider"
import { useSupabase } from "@/components/auth-provider"
import { parseTier, getTierLimits, type UserTier } from "@/lib/cost-protection"

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
    if (!user) { setLoading(false); return }

    let cancelled = false
    ;(supabase as any)
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .single()
      .then(({ data }: { data: { plan?: string } | null }) => {
        if (cancelled) return
        setTier(parseTier(data?.plan))
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const limits = getTierLimits(tier)

  return {
    tier,
    allowedDocTypes: limits.allowedDocTypes,
    loading,
  }
}

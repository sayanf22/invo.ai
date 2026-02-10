"use client"

import { useState, useEffect, useCallback } from "react"
import { useSupabase, useUser } from "@/components/auth-provider"
import type { Business } from "@/lib/database.types"

export function useBusiness() {
    const supabase = useSupabase()
    const user = useUser()
    const [business, setBusiness] = useState<Business | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchBusiness = useCallback(async () => {
        if (!user) {
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const { data, error } = await supabase
                .from("businesses")
                .select("*")
                .eq("user_id", user.id)
                .single()

            if (error && error.code !== "PGRST116") {
                // PGRST116 = no rows found
                throw error
            }

            setBusiness(data)
        } catch (err) {
            setError(err instanceof Error ? err : new Error("Failed to fetch business"))
        } finally {
            setIsLoading(false)
        }
    }, [supabase, user])

    useEffect(() => {
        fetchBusiness()
    }, [fetchBusiness])

    const updateBusiness = useCallback(
        async (updates: Partial<Business>) => {
            if (!user || !business) return

            const { error } = await supabase
                .from("businesses")
                .update(updates)
                .eq("id", business.id)

            if (error) {
                throw error
            }

            setBusiness((prev) => (prev ? { ...prev, ...updates } : null))
        },
        [supabase, user, business]
    )

    return {
        business,
        isLoading,
        error,
        refetch: fetchBusiness,
        updateBusiness,
    }
}

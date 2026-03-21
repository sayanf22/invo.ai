"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient, clearAuthTokens, resetSupabaseClient } from "@/lib/supabase"
import type { User, Session, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

type SupabaseContext = {
    supabase: SupabaseClient<Database>
    user: User | null
    session: Session | null
    isLoading: boolean
}

const Context = createContext<SupabaseContext | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [supabase] = useState(() => createClient())
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let mounted = true

        // Get initial session
        async function initSession() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()

                if (!mounted) return

                if (error) {
                    console.warn("Session load warning:", error.message)
                    // DON'T clear tokens on session load failure — the token might still be valid
                    // and auto-refresh will handle it. Only clear on explicit sign-out.
                    setSession(null)
                    setUser(null)
                } else {
                    setSession(session)
                    setUser(session?.user ?? null)
                }
            } catch (err) {
                if (!mounted) return
                console.warn("Session init error:", err)
                // Network error — DON'T clear tokens. User might just have a flaky connection.
                // The session will be restored on next successful request.
                setSession(null)
                setUser(null)
            } finally {
                if (mounted) setIsLoading(false)
            }
        }

        initSession()

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return

            if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
                setSession(session)
                setUser(session?.user ?? null)
            } else if (event === "SIGNED_OUT") {
                clearAuthTokens()
                setSession(null)
                setUser(null)
            } else {
                setSession(session)
                setUser(session?.user ?? null)
            }
            setIsLoading(false)
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [supabase])

    return (
        <Context.Provider value={{ supabase, user, session, isLoading }}>
            {children}
        </Context.Provider>
    )
}

export function useSupabase() {
    const context = useContext(Context)
    if (context === undefined) {
        throw new Error("useSupabase must be used inside AuthProvider")
    }
    return context.supabase
}

export function useUser() {
    const context = useContext(Context)
    if (context === undefined) {
        throw new Error("useUser must be used inside AuthProvider")
    }
    return context.user
}

export function useSession() {
    const context = useContext(Context)
    if (context === undefined) {
        throw new Error("useSession must be used inside AuthProvider")
    }
    return context.session
}

export function useAuth() {
    const context = useContext(Context)
    if (context === undefined) {
        throw new Error("useAuth must be used inside AuthProvider")
    }
    return context
}

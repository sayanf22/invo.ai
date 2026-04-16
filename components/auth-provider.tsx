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
                // First try getSession() — reads from localStorage/cookies (fast, no network)
                const { data: { session }, error } = await supabase.auth.getSession()

                if (!mounted) return

                if (error) {
                    console.warn("Session load warning:", error.message)
                    setSession(null)
                    setUser(null)
                } else if (session) {
                    setSession(session)
                    setUser(session.user)
                } else {
                    // No session in storage — try getUser() which makes a network call
                    // This handles the case where @supabase/ssr set cookies server-side
                    // but the client-side storage adapter hasn't picked them up yet
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!mounted) return
                    if (user) {
                        // User exists server-side — refresh to get full session
                        const { data: refreshed } = await supabase.auth.refreshSession()
                        if (!mounted) return
                        setSession(refreshed.session)
                        setUser(refreshed.session?.user ?? null)
                    } else {
                        setSession(null)
                        setUser(null)
                    }
                }
            } catch (err) {
                if (!mounted) return
                console.warn("Session init error:", err)
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

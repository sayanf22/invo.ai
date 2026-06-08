"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient, clearAuthTokens, resetSupabaseClient, clearCorruptedAuthTokens } from "@/lib/supabase"
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
    const [supabase] = useState(() => {
        // Proactively clear any corrupted tokens before creating the client
        clearCorruptedAuthTokens()
        return createClient()
    })
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
                    // Only purge on true corruption (Base64/JSON parse failure).
                    const msg = error.message || ""
                    const isTrulyCorrupt =
                        msg.includes("Base64") ||
                        msg.includes("base64") ||
                        msg.includes("JSON") ||
                        msg.includes("parse")
                    if (isTrulyCorrupt) {
                        clearAuthTokens()
                        resetSupabaseClient()
                    }
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
            } catch (err: any) {
                if (!mounted) return
                console.warn("Session init error:", err)
                // Only clear tokens on TRUE corruption (unparseable Base64 payload).
                // Do NOT key on "%" — that matches URL-encoded cookies, which are
                // normal and valid (NextResponse URL-encodes cookie values).
                const msg = err?.message || ""
                const isTrulyCorrupt =
                    msg.includes("Base64") ||
                    msg.includes("base64") ||
                    msg.includes("JSON") ||
                    msg.includes("parse")
                if (isTrulyCorrupt) {
                    clearAuthTokens()
                    resetSupabaseClient()
                }
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
                // Record login location/IP once per real sign-in (server dedups by IP/30min)
                if (event === "SIGNED_IN") {
                    try {
                        fetch("/api/auth/track-login", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ method: session?.user?.app_metadata?.provider ?? "password" }),
                            keepalive: true,
                        }).catch(() => {})
                    } catch { /* non-blocking */ }
                }
            } else if (event === "SIGNED_OUT") {
                clearAuthTokens()
                // Clear any persisted session so the next user doesn't see the previous user's work
                if (typeof localStorage !== "undefined") {
                    localStorage.removeItem("clorefy_active_session")
                }
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

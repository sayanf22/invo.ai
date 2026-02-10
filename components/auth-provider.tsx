"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
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
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setIsLoading(false)
        })

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            setIsLoading(false)
        })

        return () => {
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

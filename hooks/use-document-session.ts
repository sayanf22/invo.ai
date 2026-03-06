"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSupabase, useUser } from "@/components/auth-provider"
import type { InvoiceData } from "@/lib/invoice-types"
import type { DocumentSession, Json } from "@/lib/database.types"

export interface ChatMessage {
    id: string
    role: "user" | "assistant" | "system"
    content: string
    created_at: string
}

export function useDocumentSession(documentType: string = "invoice", externalSessionId?: string) {
    const supabase = useSupabase()
    const user = useUser()
    const [session, setSession] = useState<DocumentSession | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const initRef = useRef(false)
    const currentSessionIdRef = useRef<string | null>(null)

    // Load a specific session by ID
    const loadSession = useCallback(async (sessionId: string) => {
        if (!user) return null
        setIsLoading(true)
        try {
            const { data: sessionData, error: sessionError } = await supabase
                .from("document_sessions")
                .select("*")
                .eq("id", sessionId)
                .eq("user_id", user.id)
                .maybeSingle()

            if (sessionError) {
                console.warn("Session load issue:", sessionError.message)
                return null
            }
            if (!sessionData) {
                // Session not found — silently fall back (stale ID, deleted, etc.)
                return null
            }

            const { data: sessionMessages, error: messagesError } = await supabase
                .from("chat_messages")
                .select("*")
                .eq("session_id", sessionId)
                .order("created_at", { ascending: true })

            if (messagesError) {
                console.error("Failed to load messages:", messagesError)
            }

            const loadedSession = sessionData as DocumentSession
            currentSessionIdRef.current = loadedSession.id
            setSession(loadedSession)
            setMessages((sessionMessages as ChatMessage[]) || [])
            return loadedSession
        } catch (error) {
            console.error("Error loading session:", error)
            return null
        } finally {
            setIsLoading(false)
        }
    }, [supabase, user])

    // Create a brand new session
    const createNewSession = useCallback(async (): Promise<DocumentSession | null> => {
        if (!user) return null
        try {
            const response = await fetch("/api/sessions/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentType }),
            })
            const result = await response.json()
            if (!response.ok || !result.success) {
                console.error("Failed to create session:", result.error)
                return null
            }

            const { data: newSession, error } = await supabase
                .from("document_sessions")
                .select("*")
                .eq("id", result.session.id)
                .single()

            if (error || !newSession) return null

            const created = newSession as DocumentSession
            currentSessionIdRef.current = created.id
            setSession(created)
            setMessages([])
            return created
        } catch (error) {
            console.error("Error creating session:", error)
            return null
        }
    }, [supabase, user, documentType])

    // Initialize: load external session OR create a fresh one
    // IMPORTANT: Each new prompt from the home screen = new session. Never reuse old sessions.
    useEffect(() => {
        if (!user || initRef.current) return

        const init = async () => {
            initRef.current = true
            setIsLoading(true)

            try {
                if (externalSessionId) {
                    // Load the specific session requested (e.g. from history sidebar)
                    await loadSession(externalSessionId)
                } else {
                    // Always create a fresh session for new prompts
                    await createNewSession()
                }
            } catch (error) {
                console.error("Error initializing session:", error)
            } finally {
                setIsLoading(false)
            }
        }

        init()
    }, [user, externalSessionId, documentType, supabase, loadSession, createNewSession])

    // Switch session when externalSessionId changes AFTER init
    useEffect(() => {
        if (!user || !initRef.current) return
        if (!externalSessionId) return
        if (externalSessionId === currentSessionIdRef.current) return

        loadSession(externalSessionId)
    }, [externalSessionId, user, loadSession])

    // Save message to the CURRENT session
    const saveMessage = useCallback(async (role: "user" | "assistant", content: string) => {
        if (!session?.id || !user) return
        setIsSaving(true)
        try {
            const { error } = await supabase
                .from("chat_messages")
                .insert({
                    session_id: session.id,
                    role,
                    content,
                })

            if (error) {
                console.error("Error saving message:", error.message, error.code, error.details)
            }
        } catch (error) {
            console.error("Error saving message (exception):", error instanceof Error ? error.message : String(error))
        } finally {
            setIsSaving(false)
        }
    }, [supabase, session, user])

    // Update session context (document data)
    const updateSessionContext = useCallback(async (context: Partial<InvoiceData>) => {
        if (!session || !user) return
        try {
            const { error } = await supabase
                .from("document_sessions")
                .update({
                    context: context as unknown as Json,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", session.id)

            if (error) throw error

            setSession(prev => {
                if (!prev) return null
                const prevContext = (prev.context && typeof prev.context === 'object' && !Array.isArray(prev.context))
                    ? prev.context as Record<string, unknown>
                    : {}
                return {
                    ...prev,
                    context: { ...prevContext, ...context } as unknown as Json
                }
            })
        } catch (error) {
            console.error("Error updating session context:", error)
        }
    }, [supabase, session, user])

    // Save generation to history
    const saveGeneration = useCallback(async (
        prompt: string,
        generatedData: any,
        businessContext: any,
        success: boolean = true,
        errorMessage?: string
    ) => {
        if (!session || !user) return
        try {
            await supabase
                .from("generation_history")
                .insert({
                    session_id: session.id,
                    user_id: user.id,
                    document_type: documentType,
                    prompt,
                    generated_data: generatedData,
                    business_context: businessContext,
                    success,
                    error_message: errorMessage,
                })
        } catch (error) {
            console.error("Error saving generation history:", error)
        }
    }, [supabase, session, user, documentType])

    // Start a completely new session (marks current as completed)
    const startNewSession = useCallback(async () => {
        if (!user) return
        try {
            if (session) {
                await supabase
                    .from("document_sessions")
                    .update({ status: "completed" })
                    .eq("id", session.id)
            }
            const newSession = await createNewSession()
            return newSession
        } catch (error) {
            console.error("Error starting new session:", error)
            return null
        }
    }, [user, session, supabase, createNewSession])

    // Complete session
    const completeSession = useCallback(async (documentId?: string) => {
        if (!session || !user) return
        try {
            await supabase
                .from("document_sessions")
                .update({
                    status: "completed",
                    completed_at: new Date().toISOString(),
                    document_id: documentId || null,
                })
                .eq("id", session.id)
            setSession(prev => prev ? { ...prev, status: "completed" } : null)
        } catch (error) {
            console.error("Error completing session:", error)
        }
    }, [supabase, session, user])

    // Update client name on the session (for chain grouping)
    const updateClientName = useCallback(async (clientName: string) => {
        if (!session || !user || !clientName) return
        try {
            await supabase
                .from("document_sessions")
                .update({ client_name: clientName })
                .eq("id", session.id)
            setSession(prev => prev ? { ...prev, client_name: clientName } : null)
        } catch (error) {
            console.error("Error updating client name:", error)
        }
    }, [supabase, session, user])

    return {
        session,
        messages,
        isLoading,
        isSaving,
        saveMessage,
        updateSessionContext,
        updateClientName,
        saveGeneration,
        completeSession,
        startNewSession,
        loadSession,
        chainId: session?.chain_id ?? null,
    }
}

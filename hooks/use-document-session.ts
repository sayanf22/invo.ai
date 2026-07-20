"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSupabase, useUser } from "@/components/auth-provider"
import type { InvoiceData } from "@/lib/invoice-types"
import type { DocumentSession, Json } from "@/lib/database.types"
import { authFetch } from "@/lib/auth-fetch"
import { coerceReferenceNumber } from "@/lib/document-type-registry"

export interface ChatMessage {
    id: string
    role: "user" | "assistant" | "system"
    content: string
    created_at: string
    metadata?: Record<string, unknown>
}

export function useDocumentSession(documentType: string = "invoice", externalSessionId?: string) {
    const supabase = useSupabase()
    const user = useUser()
    const [session, setSession] = useState<DocumentSession | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [limitError, setLimitError] = useState<{ error: string; tier: string; currentUsage: number; limit: number; message: string } | null>(null)
    const initRef = useRef(false)
    const creatingRef = useRef(false) // mutex: prevent concurrent session creation
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
        // Mutex: prevent concurrent session creation (React StrictMode / fast re-renders)
        if (creatingRef.current) return null
        creatingRef.current = true
        try {
            const response = await authFetch("/api/sessions/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentType }),
            })
            const result = await response.json()
            if (!response.ok || !result.success) {
                // Check if this is a document limit error
                if (response.status === 429 && result.error === "Monthly document limit reached") {
                    setLimitError({
                        error: result.error,
                        tier: result.tier || "free",
                        currentUsage: result.currentUsage || 0,
                        limit: result.limit || 0,
                        message: result.message || "Upgrade your plan to create more documents",
                    })
                } else {
                    console.error("Failed to create session:", result.error)
                }
                return null
            }

            // Clear any previous limit error on successful creation
            setLimitError(null)

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
        } finally {
            creatingRef.current = false
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
    const saveMessage = useCallback(async (role: "user" | "assistant", content: string, metadata?: Record<string, unknown>) => {
        if (!session?.id || !user) return
        setIsSaving(true)
        try {
            const { error } = await supabase
                .from("chat_messages")
                .insert({
                    session_id: session.id,
                    role,
                    content,
                    ...(metadata ? { metadata: metadata as unknown as Json } : {}),
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
            // ── Reference number coercion ────────────────────────────────
            // The session's document_type is the source of truth. If the AI
            // (or some other write path) hands us a referenceNumber/invoiceNumber
            // whose prefix doesn't match (e.g. REM- for an invoice because the
            // AI got confused), rewrite it to the correct prefix before
            // persisting. The numeric portion is preserved — only the prefix
            // is touched, so deterministic numbering still works.
            const sessionDocType = (session.document_type as string | undefined) || ""
            const safeContext: Partial<InvoiceData> = { ...context }
            if (sessionDocType) {
                if (typeof safeContext.referenceNumber === "string") {
                    safeContext.referenceNumber = coerceReferenceNumber(safeContext.referenceNumber, sessionDocType) ?? safeContext.referenceNumber
                }
                if (typeof safeContext.invoiceNumber === "string") {
                    // For invoices, invoiceNumber is the canonical reference. For
                    // payment_followup, invoiceNumber refers to the *parent invoice*
                    // and must keep its INV- prefix. Same for SOW/CO referencing
                    // a parent contract — but those don't reuse invoiceNumber, they
                    // use parentContractId / parentDocumentId. So only coerce when
                    // the field actually IS this document's primary identifier.
                    const isInvoiceLike = sessionDocType === "invoice"
                    if (isInvoiceLike) {
                        safeContext.invoiceNumber = coerceReferenceNumber(safeContext.invoiceNumber, sessionDocType) ?? safeContext.invoiceNumber
                    } else if (sessionDocType !== "payment_followup" && sessionDocType !== "sow" && sessionDocType !== "change_order") {
                        // BUG FIX: PDF headers fall back to `invoiceNumber` when
                        // `referenceNumber` is empty (e.g. `data.referenceNumber ||
                        // data.invoiceNumber || "EST-0000"`). For every non-invoice
                        // type that does NOT deliberately carry a parent invoice's
                        // number, a stray invoiceNumber value (AI mistake or leftover
                        // from an earlier doc type) leaked through with the WRONG
                        // prefix — e.g. "INV-2350" printed under an ESTIMATE title.
                        // Clear it so the correct referenceNumber (already coerced
                        // above) is what actually renders.
                        delete (safeContext as Record<string, unknown>).invoiceNumber
                    }
                }
            }

            const previousContext = (session.context && typeof session.context === "object" && !Array.isArray(session.context))
                ? session.context as Record<string, unknown>
                : {}
            const mergedContext = { ...previousContext, ...safeContext }
            const { error } = await supabase
                .from("document_sessions")
                .update({
                    context: mergedContext as unknown as Json,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", session.id)
                .eq("user_id", user.id) // defense-in-depth: scope to owner

            if (error) throw error

            setSession(prev => {
                if (!prev) return null
                const prevContext = (prev.context && typeof prev.context === 'object' && !Array.isArray(prev.context))
                    ? prev.context as Record<string, unknown>
                    : {}
                return {
                    ...prev,
                    context: { ...prevContext, ...safeContext } as unknown as Json
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
                    .eq("user_id", user.id)
            }
            // Reset mutex so forceNew can proceed
            creatingRef.current = false
            const response = await authFetch("/api/sessions/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentType, forceNew: true }),
            })
            const result = await response.json()
            if (!response.ok || !result.success) {
                console.error("Failed to create new session:", result.error)
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
            console.error("Error starting new session:", error)
            return null
        }
    }, [user, session, supabase, documentType])

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
                .eq("user_id", user.id)
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
                .eq("user_id", user.id)
            setSession(prev => prev ? { ...prev, client_name: clientName } : null)
        } catch (error) {
            console.error("Error updating client name:", error)
        }
    }, [supabase, session, user])

    // Refresh session status from DB (used after unlock to update the banner)
    const refreshSession = useCallback(async () => {
        if (!session || !user) return null
        try {
            const { data: refreshedSession, error } = await supabase
                .from("document_sessions")
                .select("*")
                .eq("id", session.id)
                .eq("user_id", user.id)
                .single()

            if (error || !refreshedSession) {
                console.error("Error refreshing session:", error)
                return null
            }

            setSession(refreshedSession as DocumentSession)
            return refreshedSession as DocumentSession
        } catch (error) {
            console.error("Error refreshing session:", error)
            return null
        }
    }, [supabase, session, user])

    // Update session status locally (for immediate UI updates without DB round-trip)
    const updateSessionStatus = useCallback((status: string) => {
        setSession(prev => prev ? { ...prev, status } as DocumentSession : null)
    }, [])

    return {
        session,
        messages,
        isLoading,
        isSaving,
        limitError,
        saveMessage,
        updateSessionContext,
        updateClientName,
        saveGeneration,
        completeSession,
        startNewSession,
        loadSession,
        refreshSession,
        updateSessionStatus,
        chainId: session?.chain_id ?? null,
    }
}

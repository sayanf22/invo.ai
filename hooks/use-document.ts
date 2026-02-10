"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSupabase, useUser } from "@/components/auth-provider"
import type { Document, Json } from "@/lib/database.types"

interface UseDocumentOptions {
    documentId?: string
    autoSave?: boolean
    autoSaveDelay?: number
}

export function useDocument(options: UseDocumentOptions = {}) {
    const { documentId, autoSave = true, autoSaveDelay = 1500 } = options

    const supabase = useSupabase()
    const user = useUser()
    const [document, setDocument] = useState<Document | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const pendingDataRef = useRef<Json | null>(null)

    // Fetch document
    const fetchDocument = useCallback(async () => {
        if (!documentId) {
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const { data, error } = await supabase
                .from("documents")
                .select("*")
                .eq("id", documentId)
                .single()

            if (error) throw error
            setDocument(data)
        } catch (err) {
            setError(err instanceof Error ? err : new Error("Failed to fetch document"))
        } finally {
            setIsLoading(false)
        }
    }, [supabase, documentId])

    useEffect(() => {
        fetchDocument()
    }, [fetchDocument])

    // Create new document
    const createDocument = useCallback(
        async (
            type: "invoice" | "contract" | "nda" | "agreement",
            businessId: string,
            initialData: Json = {}
        ) => {
            if (!user) throw new Error("Not authenticated")

            setIsLoading(true)

            try {
                const { data, error } = await supabase
                    .from("documents")
                    .insert({
                        type,
                        business_id: businessId,
                        data: initialData,
                        status: "draft",
                        version: 1,
                    })
                    .select()
                    .single()

                if (error) throw error

                setDocument(data)
                return data
            } catch (err) {
                setError(err instanceof Error ? err : new Error("Failed to create document"))
                throw err
            } finally {
                setIsLoading(false)
            }
        },
        [supabase, user]
    )

    // Save document data
    const saveDocument = useCallback(
        async (data: Json, createVersion = false) => {
            if (!document || !user) return

            setIsSaving(true)

            try {
                const newVersion = createVersion ? (document.version || 1) + 1 : document.version

                // If creating version, save current state to versions table
                if (createVersion) {
                    await supabase.from("document_versions").insert({
                        document_id: document.id,
                        version: document.version || 1,
                        data: document.data,
                        created_by: user.id,
                    })
                }

                // Update document
                const { error } = await supabase
                    .from("documents")
                    .update({
                        data,
                        version: newVersion,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", document.id)

                if (error) throw error

                setDocument((prev) =>
                    prev ? { ...prev, data, version: newVersion } : null
                )
            } catch (err) {
                setError(err instanceof Error ? err : new Error("Failed to save document"))
                throw err
            } finally {
                setIsSaving(false)
            }
        },
        [supabase, document, user]
    )

    // Auto-save with debounce
    const updateData = useCallback(
        (newData: Json) => {
            pendingDataRef.current = newData

            // Update local state immediately for responsiveness
            setDocument((prev) => (prev ? { ...prev, data: newData } : null))

            if (!autoSave) return

            // Clear existing timeout
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }

            // Set new timeout
            saveTimeoutRef.current = setTimeout(() => {
                if (pendingDataRef.current) {
                    saveDocument(pendingDataRef.current)
                    pendingDataRef.current = null
                }
            }, autoSaveDelay)
        },
        [autoSave, autoSaveDelay, saveDocument]
    )

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [])

    // Update status
    const updateStatus = useCallback(
        async (status: "draft" | "pending" | "signed" | "completed" | "cancelled") => {
            if (!document) return

            const { error } = await supabase
                .from("documents")
                .update({ status })
                .eq("id", document.id)

            if (error) throw error

            setDocument((prev) => (prev ? { ...prev, status } : null))
        },
        [supabase, document]
    )

    // Fetch version history
    const fetchVersions = useCallback(async () => {
        if (!document) return []

        const { data, error } = await supabase
            .from("document_versions")
            .select("*")
            .eq("document_id", document.id)
            .order("version", { ascending: false })

        if (error) throw error
        return data
    }, [supabase, document])

    return {
        document,
        isLoading,
        isSaving,
        error,
        createDocument,
        saveDocument,
        updateData,
        updateStatus,
        fetchVersions,
        refetch: fetchDocument,
    }
}

// Hook for listing documents
export function useDocuments() {
    const supabase = useSupabase()
    const user = useUser()
    const [documents, setDocuments] = useState<Document[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchDocuments = useCallback(async () => {
        if (!user) {
            setIsLoading(false)
            return
        }

        setIsLoading(true)

        const { data, error } = await supabase
            .from("documents")
            .select("*, businesses!inner(user_id)")
            .eq("businesses.user_id", user.id)
            .order("updated_at", { ascending: false })

        if (!error && data) {
            setDocuments(data)
        }

        setIsLoading(false)
    }, [supabase, user])

    useEffect(() => {
        fetchDocuments()
    }, [fetchDocuments])

    return { documents, isLoading, refetch: fetchDocuments }
}

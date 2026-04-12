"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Loader2, Check, MessageSquare, PenLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"
import { createClient } from "@/lib/supabase"

interface ChatMessage {
    role: "user" | "assistant"
    content: string
}

export interface ProfileData {
    name?: string
    business_type?: string
    owner_name?: string
    email?: string
    phone?: string
    country?: string
    state_province?: string
    address?: Record<string, string>
    tax_ids?: Record<string, string>
    client_countries?: string[]
    default_currency?: string
    default_payment_terms?: string
    default_payment_instructions?: string
    additional_notes?: string
    payment_methods?: Record<string, unknown>
}

interface ProfileUpdateChatProps {
    currentProfile: ProfileData
    onProfileUpdated: () => void
    onClose: () => void
    userId: string
    /**
     * "full" = Update with AI button (has file upload, covers all fields, needs confirmation)
     * "section" = Section Edit button (no file upload, focused on one section, DeepSeek only)
     */
    mode?: "full" | "section"
    /** Required when mode="section" — which section to edit */
    section?: string
    /** Display title for the section being edited */
    sectionTitle?: string
}

// Map extracted AI field names to database column names with intelligent merging
export function mapExtractedToDbUpdate(
    extracted: Record<string, unknown>,
    currentProfile: ProfileData
): Record<string, unknown> {
    const update: Record<string, unknown> = {}

    const setIfPresent = (extractedKey: string, dbKey: string) => {
        const val = extracted[extractedKey]
        if (val !== null && val !== undefined && val !== "") {
            update[dbKey] = val
        }
    }

    setIfPresent("businessName", "name")
    setIfPresent("businessType", "business_type")
    setIfPresent("ownerName", "owner_name")
    setIfPresent("email", "email")
    setIfPresent("phone", "phone")
    setIfPresent("country", "country")

    // Deep merge address: only overwrite sub-fields that are present in extracted
    if (extracted.address && typeof extracted.address === "object") {
        const a = extracted.address as Record<string, string>
        const existing = currentProfile.address || {}
        update.address = {
            street: (a.street && a.street.trim()) ? a.street : existing.street || "",
            city: (a.city && a.city.trim()) ? a.city : existing.city || "",
            state: (a.state && a.state.trim()) ? a.state : existing.state || "",
            postal_code: (a.postalCode || a.postal_code || "").trim()
                || existing.postal_code || "",
            country: (extracted.country as string) || currentProfile.country || "",
        }
        if (a.state && a.state.trim()) update.state_province = a.state
    }

    // Merge tax_ids (shallow merge, preserve existing keys)
    if (extracted.taxId) {
        update.tax_ids = {
            ...(currentProfile.tax_ids || {}),
            tax_id: extracted.taxId as string,
        }
    }

    // Deduplicated union of clientCountries
    if (extracted.clientCountries && Array.isArray(extracted.clientCountries)) {
        const existing = currentProfile.client_countries || []
        const merged = [...new Set([...existing, ...extracted.clientCountries])]
        update.client_countries = merged
    }

    setIfPresent("defaultCurrency", "default_currency")
    setIfPresent("paymentTerms", "default_payment_terms")
    setIfPresent("paymentInstructions", "default_payment_instructions")

    // Merge additional_notes: combine services, projectDescription, additionalContext,
    // and additionalNotes from file extraction — append to existing notes instead of replacing
    const noteParts: string[] = []
    if (extracted.services && typeof extracted.services === "string" && extracted.services.trim()) {
        noteParts.push(extracted.services.trim())
    }
    if (extracted.projectDescription && typeof extracted.projectDescription === "string" && extracted.projectDescription.trim()) {
        noteParts.push(extracted.projectDescription.trim())
    }
    if (extracted.additionalContext && typeof extracted.additionalContext === "string" && extracted.additionalContext.trim()) {
        noteParts.push(extracted.additionalContext.trim())
    }
    if (extracted.additionalNotes && typeof extracted.additionalNotes === "string" && extracted.additionalNotes.trim()) {
        noteParts.push(extracted.additionalNotes.trim())
    }
    if (noteParts.length > 0) {
        const newNotes = noteParts.join(" ")
        const existing = currentProfile.additional_notes?.trim() || ""
        // Always append new info to existing notes
        if (existing) {
            update.additional_notes = `${existing} ${newNotes}`.trim()
        } else {
            update.additional_notes = newNotes
        }
    }

    // Deep merge bankDetails: only overwrite sub-fields with non-empty values
    if (extracted.bankDetails && typeof extracted.bankDetails === "object") {
        const existingBank = (currentProfile.payment_methods as any)?.bank || {}
        const newBank = extracted.bankDetails as Record<string, string>
        const merged: Record<string, string> = { ...existingBank }
        for (const [k, v] of Object.entries(newBank)) {
            if (v && String(v).trim()) merged[k] = v
        }
        update.payment_methods = { bank: merged }
    }

    return update
}

export function ProfileUpdateChat({
    currentProfile, onProfileUpdated, onClose, userId,
    mode = "full", section, sectionTitle,
}: ProfileUpdateChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [stagedFile, setStagedFile] = useState<File | null>(null)
    const [updateCount, setUpdateCount] = useState(0)
    // "full" mode: require confirmation before first AI call
    const [confirmed, setConfirmed] = useState(mode === "section")

    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const latestProfileRef = useRef<ProfileData>(currentProfile)

    const isFullMode = mode === "full"
    const isSectionMode = mode === "section"

    // Sync latestProfileRef when parent prop changes
    useEffect(() => {
        latestProfileRef.current = currentProfile
    }, [currentProfile])

    useEffect(() => {
        if (confirmed) sendInitialGreeting()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [confirmed])

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const sendInitialGreeting = async () => {
        setIsLoading(true)
        try {
            const initMessage = isSectionMode
                ? `I want to edit my ${sectionTitle || section} section.`
                : "I want to update my business profile."

            const response = await authFetch("/api/ai/profile-update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [{ role: "user", content: initMessage }],
                    currentProfile,
                    ...(isSectionMode && section ? { section } : {}),
                }),
            })
            const result = await response.json()
            if (result.message) {
                setMessages([{ role: "assistant", content: result.message }])
            } else {
                const fallback = isSectionMode
                    ? `📝 What would you like to change in your ${sectionTitle || section}?`
                    : "Hi! 📝 What would you like to update? You can also upload a document."
                setMessages([{ role: "assistant", content: fallback }])
            }
        } catch {
            const fallback = isSectionMode
                ? `📝 Tell me the new values for your ${sectionTitle || section}.`
                : "Hi! 📝 What would you like to update?"
            setMessages([{ role: "assistant", content: fallback }])
        } finally {
            setIsLoading(false)
        }
    }

    const applyUpdates = useCallback(async (updates: Record<string, unknown>) => {
        if (Object.keys(updates).length === 0) return

        try {
            const supabase = createClient()
            const { error } = await supabase
                .from("businesses")
                .update(updates)
                .eq("user_id", userId)

            if (error) throw error

            const fieldCount = Object.keys(updates).length
            setUpdateCount(prev => prev + fieldCount)
            toast.success(`${fieldCount} field${fieldCount > 1 ? "s" : ""} updated!`)
            latestProfileRef.current = { ...latestProfileRef.current, ...updates } as ProfileData
            onProfileUpdated()
        } catch (err) {
            console.error("Failed to save profile update:", err)
            toast.error("Failed to save changes")
        }
    }, [userId, onProfileUpdated])

    // Text-only chat — ALWAYS uses DeepSeek (via /api/ai/profile-update)
    const handleSendMessage = useCallback(async () => {
        if (!inputValue.trim() || isLoading) return

        const userMessage = inputValue.trim()
        setInputValue("")

        const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMessage }]
        setMessages(newMessages)
        setIsLoading(true)

        try {
            const response = await authFetch("/api/ai/profile-update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: newMessages,
                    currentProfile: latestProfileRef.current,
                    ...(isSectionMode && section ? { section } : {}),
                }),
            })

            const result = await response.json()
            if (result.error) throw new Error(result.error)

            if (result.needsClarification) {
                // Show clarification message only, do NOT apply extractedData
                if (result.message) {
                    setMessages(prev => [...prev, { role: "assistant", content: result.message }])
                }
            } else if (result.extractedData && Object.keys(result.extractedData).length > 0) {
                const dbUpdates = mapExtractedToDbUpdate(result.extractedData, latestProfileRef.current)
                if (Object.keys(dbUpdates).length > 0) {
                    await applyUpdates(dbUpdates)
                }
                if (result.message) {
                    setMessages(prev => [...prev, { role: "assistant", content: result.message }])
                }
            } else {
                if (result.message) {
                    setMessages(prev => [...prev, { role: "assistant", content: result.message }])
                }
            }

            if (result.allFieldsComplete) {
                setTimeout(() => onClose(), 1500)
            }
        } catch (err: any) {
            console.error("Profile update chat error:", err)
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "Something went wrong. Please try again."
            }])
        } finally {
            setIsLoading(false)
            inputRef.current?.focus()
        }
    }, [inputValue, isLoading, messages, section, isSectionMode, applyUpdates, onClose])

    // File upload — GPT only, available in "full" mode only
    const handleFileUpload = useCallback(async (file: File, userText?: string) => {
        setIsUploading(true)
        setMessages(prev => [...prev, {
            role: "user",
            content: userText ? `📎 ${file.name}\n${userText}` : `📎 Uploaded: ${file.name}`
        }])
        setMessages(prev => [...prev, { role: "assistant", content: "Analyzing your document..." }])

        try {
            const formData = new FormData()
            formData.append("file", file)
            if (userText) formData.append("message", userText)

            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const accessToken = session?.access_token

            const res = await fetch("/api/ai/analyze-file", {
                method: "POST",
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                body: formData,
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Failed to analyze file")
            }

            const result = await res.json()
            const extracted = result.extracted

            if (extracted) {
                const dbUpdates = mapExtractedToDbUpdate(extracted, latestProfileRef.current)
                if (Object.keys(dbUpdates).length > 0) {
                    await applyUpdates(dbUpdates)
                }

                // Build a detailed summary of what was extracted
                const extractedParts: string[] = []
                if (dbUpdates.name) extractedParts.push(`Business Name: ${dbUpdates.name}`)
                if (dbUpdates.business_type) extractedParts.push(`Business Type: ${dbUpdates.business_type}`)
                if (dbUpdates.owner_name) extractedParts.push(`Owner: ${dbUpdates.owner_name}`)
                if (dbUpdates.email) extractedParts.push(`Email: ${dbUpdates.email}`)
                if (dbUpdates.phone) extractedParts.push(`Phone: ${dbUpdates.phone}`)
                if (dbUpdates.country) extractedParts.push(`Country: ${dbUpdates.country}`)
                if (dbUpdates.address) extractedParts.push(`Address: updated`)
                if (dbUpdates.tax_ids) extractedParts.push(`Tax ID: updated`)
                if (dbUpdates.client_countries) extractedParts.push(`Client Countries: ${(dbUpdates.client_countries as string[]).join(", ")}`)
                if (dbUpdates.default_currency) extractedParts.push(`Currency: ${dbUpdates.default_currency}`)
                if (dbUpdates.default_payment_terms) extractedParts.push(`Payment Terms: ${dbUpdates.default_payment_terms}`)
                if (dbUpdates.payment_methods) extractedParts.push(`Bank Details: updated`)
                if (dbUpdates.additional_notes) extractedParts.push(`Additional Notes: updated with new services/pricing info`)

                const fieldCount = extractedParts.length
                const detailList = extractedParts.length > 0
                    ? `\n\nUpdated fields:\n${extractedParts.map(p => `• ${p}`).join("\n")}`
                    : ""

                setMessages(prev => {
                    const filtered = prev.filter(m => m.content !== "Analyzing your document...")
                    return [...filtered, {
                        role: "assistant",
                        content: `✅ Extracted and updated ${fieldCount} field${fieldCount !== 1 ? "s" : ""} from your document!${detailList}\n\nAnything else you'd like to change?`
                    }]
                })

                // Follow-up with DeepSeek to check what's still missing
                try {
                    const followUp = await authFetch("/api/ai/profile-update", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            messages: [...messages, {
                                role: "user",
                                content: "I just uploaded a document. What fields are still missing?"
                            }],
                            currentProfile: latestProfileRef.current,
                            fileExtracted: extracted,
                        }),
                    })
                    const followResult = await followUp.json()
                    if (followResult.message) {
                        setMessages(prev => [...prev, { role: "assistant", content: followResult.message }])
                    }
                } catch { /* silently skip follow-up failures */ }
            } else {
                throw new Error("Could not extract information from the file")
            }
        } catch (err: any) {
            setMessages(prev => {
                const filtered = prev.filter(m => m.content !== "Analyzing your document...")
                return [...filtered, {
                    role: "assistant",
                    content: `❌ ${err.message || "Could not analyze the file."}`
                }]
            })
        } finally {
            setIsUploading(false)
        }
    }, [messages, applyUpdates])

    // ── Confirmation screen for "full" mode ────────────────────────────
    if (isFullMode && !confirmed) {
        return (
            <div className="flex flex-col h-full max-h-[70vh]">
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="max-w-md text-center space-y-5">
                        <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                            <PenLine className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Update your profile with AI</h3>
                            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                AI will help you update your business profile through a conversation.
                                You can also upload documents and the AI will extract your business
                                information automatically.
                            </p>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-4 text-left text-sm space-y-2">
                            <p className="font-medium text-foreground">What will happen:</p>
                            <ul className="space-y-1.5 text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                    AI will analyze your current profile and identify gaps
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                    You can chat to update any field or upload documents
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                    Changes are saved immediately after confirmation
                                </li>
                            </ul>
                        </div>
                        <div className="flex gap-3 justify-center pt-2">
                            <Button variant="outline" onClick={onClose}>Cancel</Button>
                            <Button onClick={() => setConfirmed(true)}>
                                Start Updating
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ── Chat UI ────────────────────────────────────────────────────────
    const headerTitle = isSectionMode ? `Edit ${sectionTitle || "Section"}` : "Update Profile"
    const headerSubtitle = updateCount > 0
        ? `${updateCount} field${updateCount > 1 ? "s" : ""} updated`
        : isSectionMode ? `Editing ${sectionTitle || section}` : "Chat or upload docs to update"
    const HeaderIcon = isSectionMode ? MessageSquare : PenLine

    return (
        <div className="flex flex-col h-full max-h-[70vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b flex items-center gap-3 shrink-0 pr-12">
                <div className="p-2 bg-primary/10 rounded-xl">
                    <HeaderIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h3 className="font-semibold text-base">{headerTitle}</h3>
                    <p className="text-xs text-muted-foreground">{headerSubtitle}</p>
                </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-5">
                <div className="space-y-4 pb-4 max-w-xl mx-auto">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                                msg.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            <div className={cn(
                                "max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm whitespace-pre-wrap",
                                msg.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                    : "bg-muted text-foreground rounded-bl-md"
                            )}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {(isLoading || isUploading) && (
                        <div className="flex justify-start w-full animate-in fade-in duration-200">
                            <div className="bg-muted rounded-2xl px-4 py-3 space-x-1.5 flex items-center rounded-bl-md">
                                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 bg-background border-t shrink-0">
                {isFullMode ? (
                    <div className="max-w-xl mx-auto">
                        <AIInputWithLoading
                            value={inputValue}
                            onValueChange={setInputValue}
                            isLoading={isLoading}
                            isUploading={isUploading}
                            onSubmit={(val) => {
                                if (stagedFile) {
                                    handleFileUpload(stagedFile, val.trim() || undefined)
                                    setStagedFile(null)
                                    setInputValue("")
                                } else {
                                    handleSendMessage()
                                }
                            }}
                            placeholder="Tell me what to update..."
                            statusText={isUploading ? "Analyzing file..." : undefined}
                            showAttachButton={true}
                            stagedFile={stagedFile}
                            onFileSelect={(file) => setStagedFile(file)}
                            onFileRemove={() => setStagedFile(null)}
                        />
                    </div>
                ) : (
                    <div className="relative flex items-center gap-2 max-w-xl mx-auto">
                        <Input
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    handleSendMessage()
                                }
                            }}
                            placeholder={`Tell me the new ${sectionTitle || section} values...`}
                            disabled={isLoading || isUploading}
                            className="flex-1 rounded-xl h-10 px-4 text-[14px]"
                            autoFocus
                        />
                        <Button
                            size="icon"
                            onClick={() => handleSendMessage()}
                            disabled={!inputValue.trim() || isLoading || isUploading}
                            className="rounded-xl h-10 w-10 shrink-0"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

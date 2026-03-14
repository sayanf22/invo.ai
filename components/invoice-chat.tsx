"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Sparkles, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading"
import { toast } from "sonner"
import type { InvoiceData } from "@/lib/invoice-types"
import { calculateTotal } from "@/lib/invoice-types"
import { useDocumentSession } from "@/hooks/use-document-session"
import { MarkdownMessage } from "@/components/markdown-message"
import { NextStepsBar } from "@/components/next-steps-bar"
import { ChainNavigator } from "@/components/chain-navigator"
import { authFetch } from "@/lib/auth-fetch"

interface InvoiceChatProps {
    data: InvoiceData
    onChange: (updates: Partial<InvoiceData>) => void
    selectedSessionId?: string
    onSessionChange?: (sessionId: string) => void
    onLinkedSessionCreate?: (sessionId: string, docType: string) => void
    onChainSessionSelect?: (sessionId: string) => void
    initialPrompt?: string
}

export function InvoiceChat({ data, onChange, selectedSessionId, onSessionChange, onLinkedSessionCreate, onChainSessionSelect, initialPrompt }: InvoiceChatProps) {
    const docType = data.documentType?.toLowerCase() || "invoice"

    // Hook handles session init + switching when selectedSessionId changes
    const {
        session,
        messages: savedMessages,
        isLoading: sessionLoading,
        isSaving,
        saveMessage,
        updateSessionContext,
        updateClientName,
        saveGeneration,
        startNewSession,
    } = useDocumentSession(docType, selectedSessionId)

    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
    const [welcomeLoaded, setWelcomeLoaded] = useState(false)
    const [documentGenerated, setDocumentGenerated] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)
    const initialPromptSentRef = useRef(false)
    const lastSyncedSessionRef = useRef<string | null>(null)
    const pendingAutoGenerateRef = useRef<string | null>(null)

    // Sync messages from hook when session changes (new session loaded or switched)
    useEffect(() => {
        if (sessionLoading) return
        if (!session) return

        // Only sync when the session actually changed
        if (lastSyncedSessionRef.current === session.id) return
        lastSyncedSessionRef.current = session.id

        // Reset chat state for the new session
        setDocumentGenerated(false)
        setIsLoading(false)

        if (savedMessages.length > 0) {
            // Loaded an existing session with messages
            setMessages(savedMessages.map(msg => ({
                role: msg.role as "user" | "assistant",
                content: msg.content,
            })))
            setWelcomeLoaded(true)

            // Restore document preview from session context
            const ctx = session.context
            if (ctx && typeof ctx === "object" && !Array.isArray(ctx) && Object.keys(ctx).length > 0) {
                onChange(ctx as Partial<InvoiceData>)
                setDocumentGenerated(true)
            }
        } else {
            // Check if this is a linked session with seed context (no messages yet)
            const ctx = session.context
            const hasSeedData = ctx && typeof ctx === "object" && !Array.isArray(ctx) && Object.keys(ctx).length > 1

            if (hasSeedData && session.chain_id) {
                // Linked session — show seed data in preview and auto-generate
                onChange(ctx as Partial<InvoiceData>)
                const clientName = (ctx as any).toName || "the client"
                const welcomeMsg = `I've loaded the details from your previous document for ${clientName}. Generating your ${docType} now...`
                setMessages([{ role: "assistant", content: welcomeMsg }])
                setWelcomeLoaded(true)
                // Queue auto-generation (will be picked up by a separate effect that has fresh refs)
                pendingAutoGenerateRef.current = `Generate a ${docType} using the linked document details for ${clientName}`
            } else {
                // New session with no messages — load welcome
                setMessages([])
                setWelcomeLoaded(false)
                loadWelcome()
            }
        }
    }, [session, sessionLoading, savedMessages]) // eslint-disable-line react-hooks/exhaustive-deps

    // Handle pending auto-generation for linked sessions (separate effect to avoid stale closures)
    useEffect(() => {
        if (!pendingAutoGenerateRef.current || isLoading || !session) return
        const prompt = pendingAutoGenerateRef.current
        pendingAutoGenerateRef.current = null
        const timer = setTimeout(() => sendMessage(prompt), 300)
        return () => clearTimeout(timer)
    }, [session, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

    // Load welcome message
    const loadWelcome = useCallback(async () => {
        const msg = `Hi! Describe your ${docType} and I'll generate it right away. Just tell me what you need — like "invoice for 10k for web design to Acme Corp".`
        setMessages([{ role: "assistant", content: msg }])
        setWelcomeLoaded(true)
    }, [docType])

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Core send function
    const sendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading || !session) return

        const userMessage = messageText.trim()
        setInputValue("")
        setMessages(prev => [...prev, { role: "user" as const, content: userMessage }])
        await saveMessage("user", userMessage)
        setIsLoading(true)

        try {
            const response = await authFetch("/api/ai/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: userMessage,
                    documentType: docType,
                    // Send currentData if this is a follow-up OR if this is a linked session with seed data
                    currentData: (messages.length > 1 || session.chain_id) ? data : undefined,
                    conversationHistory: messages.length > 1 ? messages.slice(-5) : [],
                }),
            })

            if (!response.ok) throw new Error(`API error: ${response.status}`)

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let fullContent = ""
            if (!reader) throw new Error("No response body")

            while (true) {
                const { done, value: chunk } = await reader.read()
                if (done) break
                const text = decoder.decode(chunk, { stream: true })
                const lines = text.split("\n").filter(l => l.startsWith("data: "))

                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line.slice(6))
                        if (parsed.type === "chunk") {
                            fullContent += parsed.data
                        } else if (parsed.type === "complete") {
                            let cleaned = fullContent.trim()
                            if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "")
                            else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "")
                            cleaned = cleaned.trim()

                            if (cleaned.startsWith("{")) {
                                try {
                                    const result = JSON.parse(cleaned)
                                    const docData = result.document || result
                                    const aiMessage = result.message || ""

                                    if (docData.documentType) {
                                        const t = docData.documentType.toLowerCase()
                                        docData.documentType = t === "invoice" ? "Invoice"
                                            : t === "contract" ? "Contract"
                                            : t === "quotation" ? "Quotation"
                                            : t === "proposal" ? "Proposal"
                                            : docData.documentType
                                    }

                                    // Ensure every item has a unique id (AI often omits them)
                                    if (Array.isArray(docData.items)) {
                                        docData.items = docData.items.map((item: any, i: number) => ({
                                            ...item,
                                            id: item.id || `ai-${Date.now()}-${i}`,
                                            quantity: Number(item.quantity) || 1,
                                            rate: Number(item.rate) || 0,
                                            discount: item.discount ? Number(item.discount) || 0 : 0,
                                        }))
                                    }

                                    // Strip AI-invented payment info if user didn't ask for it
                                    const promptLower = userMessage.toLowerCase()
                                    const mentionsPayment = /\b(payment method|bank transfer|bank details|payment info|pay via|pay by|wire|paypal|stripe|credit card|upi|ach)\b/i.test(promptLower)
                                    if (!mentionsPayment) {
                                        if (docData.paymentMethod) docData.paymentMethod = ""
                                        if (docData.paymentInstructions) docData.paymentInstructions = ""
                                    }

                                    // Strip markdown formatting from all text fields — PDF renders raw asterisks
                                    const stripMarkdown = (s: string) => s.replace(/\*\*/g, "").replace(/^#{1,6}\s+/gm, "").replace(/^[-*]\s+/gm, "• ")
                                    const textFields = ["notes", "terms", "description", "paymentInstructions"] as const
                                    for (const field of textFields) {
                                        if (typeof docData[field] === "string" && docData[field]) {
                                            docData[field] = stripMarkdown(docData[field])
                                        }
                                    }
                                    if (Array.isArray(docData.items)) {
                                        for (const item of docData.items) {
                                            if (typeof item.description === "string") {
                                                item.description = stripMarkdown(item.description)
                                            }
                                        }
                                    }

                                    // Recalculate totals client-side — LLMs can't do math reliably
                                    if (Array.isArray(docData.items) && docData.items.length > 0) {
                                        // Ensure numeric types for calculation inputs
                                        docData.taxRate = Number(docData.taxRate) || 0
                                        docData.discountValue = Number(docData.discountValue) || 0
                                        docData.shippingFee = Number(docData.shippingFee) || 0
                                        if (docData.discountType && docData.discountType !== "percent" && docData.discountType !== "flat") {
                                            docData.discountType = "percent"
                                        }

                                        // Prevent double-discounting: if AI set per-item discounts AND a global discount,
                                        // zero out the global discount — the AI is likely double-counting the same discount.
                                        // Only keep global discount if NO items have per-item discounts.
                                        const hasPerItemDiscounts = docData.items.some((item: any) => item.discount && item.discount > 0)
                                        if (hasPerItemDiscounts && docData.discountValue > 0) {
                                            docData.discountValue = 0
                                        }

                                        // Strip any AI-computed total fields — system calculates these
                                        delete (docData as any).subtotal
                                        delete (docData as any).total
                                        delete (docData as any).taxAmount
                                        delete (docData as any).discountAmount
                                        delete (docData as any).grandTotal
                                    }

                                    onChange(docData)
                                    await updateSessionContext(docData)
                                    await saveGeneration(userMessage, docData, null, true)
                                    setDocumentGenerated(true)

                                    // Update client name on session for chain grouping
                                    const clientName = docData.toName || docData.clientName || docData.preparedFor
                                    if (clientName) await updateClientName(clientName)

                                    const displayMsg = aiMessage || "✅ Document generated! Check the preview. Need changes? Just tell me."
                                    setMessages(prev => [...prev, { role: "assistant", content: displayMsg }])
                                    await saveMessage("assistant", displayMsg)
                                    toast.success("Document updated!")
                                } catch {
                                    setMessages(prev => [...prev, { role: "assistant", content: cleaned }])
                                    await saveMessage("assistant", cleaned)
                                }
                            } else {
                                setMessages(prev => [...prev, { role: "assistant", content: cleaned }])
                                await saveMessage("assistant", cleaned)
                            }
                        } else if (parsed.type === "error") {
                            throw new Error(parsed.data)
                        }
                    } catch { /* skip malformed SSE lines */ }
                }
            }
        } catch (err: any) {
            const errorMsg = err.message || "Something went wrong"
            const assistantMsg = errorMsg.includes("429") || errorMsg.includes("rate limit")
                ? "⏳ High demand right now. Please wait a minute and try again."
                : "Something went wrong. Please try again."
            setMessages(prev => [...prev, { role: "assistant", content: assistantMsg }])
            await saveMessage("assistant", assistantMsg)
            await saveGeneration(messageText, {}, null, false, errorMsg)
        } finally {
            setIsLoading(false)
        }
    }, [isLoading, messages, data, docType, onChange, session, saveMessage, updateSessionContext, saveGeneration])

    // Auto-send initial prompt ONCE
    useEffect(() => {
        if (initialPrompt && session && !sessionLoading && !initialPromptSentRef.current && welcomeLoaded) {
            initialPromptSentRef.current = true
            sendMessage(initialPrompt.trim())
        }
    }, [initialPrompt, session, sessionLoading, welcomeLoaded, sendMessage])

    // Handle "New" conversation
    const handleNewConversation = useCallback(async () => {
        initialPromptSentRef.current = true // prevent re-send of initialPrompt
        lastSyncedSessionRef.current = null
        setWelcomeLoaded(false)
        setDocumentGenerated(false)

        const newSession = await startNewSession()
        if (newSession && onSessionChange) {
            onSessionChange(newSession.id)
        }
        toast.success("Started new conversation")
    }, [startNewSession, onSessionChange])

    // Handle creating a linked document from the Next Steps bar
    const handleCreateLinked = useCallback(async (parentSessionId: string, targetType: string) => {
        try {
            const res = await authFetch("/api/sessions/create-linked", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentSessionId, targetDocumentType: targetType }),
            })
            const result = await res.json()
            if (!res.ok || !result.success) {
                toast.error(result.error || "Failed to create linked document")
                return
            }
            // Navigate to the new linked session
            if (onLinkedSessionCreate) {
                onLinkedSessionCreate(result.session.id, targetType)
            }
            toast.success(`${targetType.charAt(0).toUpperCase() + targetType.slice(1)} created from ${docType}`)
        } catch {
            toast.error("Failed to create linked document")
        }
    }, [docType, onLinkedSessionCreate])

    return (
        <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-2xl">
                        <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-base">
                            {data.documentType ? `${data.documentType} Builder` : "Document Builder"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {sessionLoading ? "Loading..." : messages.length > 1 ? `${messages.length} messages` : "New conversation"}
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleNewConversation} className="gap-2 btn-press rounded-xl">
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">New</span>
                </Button>
            </div>

            {/* Chain Navigator — shows when session is part of a linked chain */}
            <ChainNavigator
                currentSessionId={selectedSessionId}
                onSessionSelect={onChainSessionSelect || (() => {})}
            />

            {/* Messages */}
            <ScrollArea className="flex-1 p-5">
                <div className="space-y-4 pb-4 max-w-2xl mx-auto">
                    {messages.map((msg, idx) => (
                        <div key={`${session?.id}-${idx}`} className={cn(
                            "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                            msg.role === "user" ? "justify-end" : "justify-start"
                        )}>
                            <div className={cn(
                                "max-w-[85%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed shadow-sm",
                                msg.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                    : "bg-muted text-foreground rounded-bl-md"
                            )}>
                                {msg.role === "user" ? (
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                ) : (
                                    <MarkdownMessage content={msg.content} />
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
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

            {/* Input + Next Steps */}
            <div className="px-4 py-3 border-t border-border/50 shrink-0">
                <div className="max-w-2xl mx-auto">
                    {/* Next Steps Bar — shows after generation is complete */}
                    {documentGenerated && !isLoading && session && (
                        <div className="mb-2.5">
                            <NextStepsBar
                                clientName={data.toName || null}
                                currentDocType={docType}
                                parentSessionId={session.id}
                                onCreateLinked={handleCreateLinked}
                            />
                        </div>
                    )}
                    <AIInputWithLoading
                        value={inputValue}
                        onValueChange={setInputValue}
                        isLoading={isLoading}
                        onSubmit={sendMessage}
                        placeholder={`Describe your ${docType}...`}
                        disabled={sessionLoading || !session}
                        statusText={isSaving ? "Saving..." : undefined}
                    />
                </div>
            </div>
        </div>
    )
}

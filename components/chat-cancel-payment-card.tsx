"use client"

import { useState } from "react"
import { AlertTriangle, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { authFetch } from "@/lib/auth-fetch"

interface ChatCancelPaymentCardProps {
    sessionId: string
    razorpayPaymentLinkId: string
    amount: string // formatted amount string e.g. "Rs. 25,000.00"
    onCancelled: () => void
    onDismiss: () => void
}

export function ChatCancelPaymentCard({
    sessionId,
    razorpayPaymentLinkId,
    amount,
    onCancelled,
    onDismiss,
}: ChatCancelPaymentCardProps) {
    const [state, setState] = useState<"confirm" | "loading" | "success" | "error">("confirm")
    const [errorMsg, setErrorMsg] = useState("")

    async function handleConfirm() {
        setState("loading")
        try {
            const res = await authFetch("/api/payments/cancel-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, razorpayPaymentLinkId }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: "Failed to cancel" }))
                throw new Error(data.error || "Failed to cancel payment link")
            }
            setState("success")
            // Trigger parent callback after a brief delay so user sees the success state
            setTimeout(() => onCancelled(), 800)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Something went wrong"
            setErrorMsg(msg)
            setState("error")
        }
    }

    return (
        <div className="w-full max-w-[88%] animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="rounded-2xl bg-card border border-border/50 overflow-hidden"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
            >
                {state === "confirm" && (
                    <div className="p-4 space-y-3 animate-in fade-in duration-200">
                        {/* Header */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Cancel Payment Link?</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {amount} — link will stop working immediately
                                </p>
                            </div>
                        </div>

                        {/* Consequences */}
                        <div className="text-[11px] text-muted-foreground space-y-1 pl-[52px]">
                            <p>• Recipients will no longer be able to pay</p>
                            <p>• Document will become editable again</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pl-[52px]">
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-all active:scale-[0.97] shadow-sm"
                            >
                                Cancel Link
                            </button>
                            <button
                                type="button"
                                onClick={onDismiss}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-muted text-muted-foreground hover:bg-muted/80 transition-all active:scale-[0.97]"
                            >
                                Keep Active
                            </button>
                        </div>
                    </div>
                )}

                {state === "loading" && (
                    <div className="p-4 flex items-center gap-3 animate-in fade-in duration-200">
                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />
                        <p className="text-sm text-muted-foreground">Cancelling payment link...</p>
                    </div>
                )}

                {state === "success" && (
                    <div className="p-4 flex items-center gap-3 animate-in fade-in duration-200">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Payment link cancelled</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">The document is now editable again</p>
                        </div>
                    </div>
                )}

                {state === "error" && (
                    <div className="p-4 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                <XCircle className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Failed to cancel</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{errorMsg}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pl-[52px]">
                            <button
                                type="button"
                                onClick={() => { setState("confirm"); setErrorMsg("") }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-muted text-foreground hover:bg-muted/80 transition-all active:scale-[0.97]"
                            >
                                Try Again
                            </button>
                            <button
                                type="button"
                                onClick={onDismiss}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-all"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

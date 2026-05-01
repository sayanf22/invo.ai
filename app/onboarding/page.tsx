"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { InvoLogo } from "@/components/invo-logo"
import { OnboardingChat, type CollectedData } from "@/components/onboarding-chat"
import { UploadScreen } from "@/components/upload-screen"
import { LogoUploader } from "@/components/logo-uploader"
import { toast } from "sonner"
import { Loader2, ImageIcon, ArrowRight, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getTaxIdFieldName } from "@/lib/countries"
import { PaymentSettings } from "@/components/payment-settings"
import { OnboardingSupportButton } from "@/components/onboarding-support-button"
import { motion, AnimatePresence } from "framer-motion"
import { logErrorToDatabase } from "@/lib/error-logger"

/** Fire-and-forget POST to /api/onboarding/track. Never blocks the UI. */
function trackPhaseTransition(
    phase: string,
    options?: { used_extraction?: boolean; fields_completed?: number }
) {
    fetch("/api/onboarding/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, ...options }),
    }).catch(() => {}) // silently ignore errors
}

/** Count the number of non-empty tracked fields from collected onboarding data. */
function countCompletedFields(data: CollectedData): number {
    let count = 0
    if (data.businessType?.trim()) count++
    if (data.country?.trim()) count++
    if (data.businessName?.trim()) count++
    if (data.ownerName?.trim()) count++
    if (data.email?.trim()) count++
    if (data.phone?.trim()) count++
    // address: at least one non-empty value
    if (data.address && Object.values(data.address).some(v => typeof v === "string" && v.trim().length > 0)) count++
    // taxDetails: taxRegistered is defined (user answered the question)
    if (data.taxRegistered !== undefined) count++
    // services / additionalNotes
    if (data.services?.trim() || data.additionalNotes?.trim()) count++
    // clientCountries: non-empty array
    if (data.clientCountries && data.clientCountries.length > 0) count++
    // defaultCurrency
    if (data.defaultCurrency?.trim()) count++
    // bankDetails: at least one key with a value, or explicitly skipped
    if ((data.bankDetails && Object.values(data.bankDetails).some(v => typeof v === "string" && v.trim().length > 0)) || data.bankDetailsSkipped) count++
    return count
}

export default function OnboardingPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { supabase, user, isLoading } = useAuth()
    
    // Restore phase and data from localStorage on mount
    const [phase, setPhase] = useState<"upload" | "chat" | "logo" | "payments">(() => {
        if (typeof window === "undefined") return "upload"
        const saved = localStorage.getItem("clorefy_onboarding_phase")
        if (saved === "chat" || saved === "logo" || saved === "payments") return saved as any
        return "upload"
    })
    const [extractedData, setExtractedData] = useState<CollectedData>(() => {
        if (typeof window === "undefined") return {}
        try {
            const saved = localStorage.getItem("clorefy_onboarding_data")
            return saved ? JSON.parse(saved) : {}
        } catch { return {} }
    })

    // Persist phase and data to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem("clorefy_onboarding_phase", phase)
    }, [phase])
    
    useEffect(() => {
        localStorage.setItem("clorefy_onboarding_data", JSON.stringify(extractedData))
    }, [extractedData])

    // Track whether the user used file extraction in the upload phase
    const usedExtractionRef = useRef(false)

    // Track the initial phase on mount (fire-and-forget)
    useEffect(() => {
        trackPhaseTransition(phase)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Redirect if not logged in, or if plan not selected
    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/auth/login")
            return
        }
        if (!isLoading && user) {
            // If we just came from choose-plan, persist the flag so refreshes don't lose it
            if (searchParams.get("plan_selected") === "1") {
                localStorage.setItem("clorefy_plan_selected", "1")
            }

            supabase
                .from("profiles")
                .select("onboarding_complete, plan_selected")
                .eq("id", user.id)
                .single()
                .then(({ data }: any) => {
                    // Must select a plan before onboarding
                    // Trust the URL param OR localStorage flag to avoid DB race on first load/refresh
                    const hasJustSelectedPlan = searchParams.get("plan_selected") === "1"
                    const hasCachedPlanSelected = localStorage.getItem("clorefy_plan_selected") === "1"
                    if (!data?.plan_selected && !hasJustSelectedPlan && !hasCachedPlanSelected) {
                        router.push("/choose-plan")
                        return
                    }
                    // Only redirect home if onboarding is complete AND business profile
                    // is actually filled out. If the user skipped, their business profile
                    // will be empty and they should be allowed to complete it.
                    if (data?.onboarding_complete) {
                        supabase
                            .from("businesses")
                            .select("name, country, email")
                            .eq("user_id", user.id)
                            .single()
                            .then(({ data: biz }: any) => {
                                if (biz?.name && biz?.country && biz?.email) {
                                    // Business profile is complete — redirect home
                                    localStorage.removeItem("invo_onboarding_session")
                                    localStorage.removeItem("clorefy_onboarding_skipped")
                                    localStorage.removeItem("clorefy_plan_selected")
                                    localStorage.removeItem("clorefy_upload_extracted")
                                    router.push("/")
                                }
                                // Otherwise: business profile is incomplete, let them stay on onboarding
                            })
                    }
                })
        }
    }, [isLoading, user, router, supabase, searchParams])

    // Called when the chat phase completes — transition to logo upload step
    const handleChatComplete = (data: CollectedData) => {
        const merged = { ...extractedData, ...data }
        setExtractedData(merged)
        setPhase("logo")
        trackPhaseTransition("logo", { fields_completed: countCompletedFields(merged) })
    }
    // Called when logo upload completes or user skips — saves everything to DB
    const handleFinalSave = async (data: CollectedData) => {
        if (!user) return

        try {
            // Build tax_ids object
            const taxIds: Record<string, string> = {}
            if (data.taxId && data.country) {
                const fieldName = getTaxIdFieldName(data.country)
                taxIds[fieldName] = data.taxId
            }

            // Save business profile to Supabase
            // First check if there's an existing logo that should be preserved
            // Check if business exists to decide insert vs update
            const { data: existingBiz, error: fetchError } = await supabase
                .from("businesses")
                .select("id, logo_url")
                .eq("user_id", user.id)
                .maybeSingle() as any

            const logoUrl = data.logoUrl || existingBiz?.logo_url || null

            const bizPayload = {
                user_id: user.id,
                name: data.businessName || "",
                business_type: data.businessType || "",
                owner_name: data.ownerName || "",
                email: data.email || user.email || "",
                phone: data.phone || "",
                country: data.country || "",
                state_province: data.address?.state || "",
                address: {
                    street: data.address?.street || "",
                    city: data.address?.city || "",
                    state: data.address?.state || "",
                    postal_code: data.address?.postalCode || "",
                    country: data.country || "",
                },
                tax_ids: taxIds,
                client_countries: data.clientCountries || [],
                default_currency: data.defaultCurrency || "",
                default_payment_terms: data.paymentTerms || "net_30",
                default_payment_instructions: data.paymentInstructions || "",
                additional_notes: [data.services, data.additionalNotes].filter(Boolean).join("\n\n") || "",
                payment_methods: data.bankDetails ? { bank: data.bankDetails } : {},
                logo_url: logoUrl,
                signature_url: data.signatureUrl || null,
            }

            let businessError;
            if (existingBiz?.id) {
                const { error } = await supabase.from("businesses").update(bizPayload as any).eq("id", existingBiz.id)
                businessError = error;
            } else {
                const { error } = await supabase.from("businesses").insert(bizPayload as any)
                businessError = error;
            }

            if (businessError) {
                throw businessError
            }

            // Update profile onboarding status
            const { error: profileError } = await supabase
                .from("profiles")
                .update({ onboarding_complete: true })
                .eq("id", user.id)

            if (profileError) {
                throw profileError
            }

            toast.success("🎉 Business profile saved! Welcome to Clorefy")
            trackPhaseTransition("completed", { fields_completed: countCompletedFields(data) })
            localStorage.removeItem("clorefy_onboarding_skipped")
            localStorage.removeItem("clorefy_onboarding_phase")
            localStorage.removeItem("clorefy_onboarding_data")
            localStorage.removeItem("clorefy_onboarding_messages")
            localStorage.removeItem("clorefy_plan_selected")
            localStorage.removeItem("clorefy_upload_extracted")
            router.push("/")
            router.refresh()
        } catch (error: any) {
            console.error("Save error:", error)
            await logErrorToDatabase(`onboarding_${phase}`, error, {
                onboarding_phase: phase,
                fields_completed: countCompletedFields(data),
                used_extraction: usedExtractionRef.current,
            })
            toast.error(error?.message || error?.details || "Failed to save profile. Please try again.")
        }
    }

    const handleSkip = async () => {
        if (!user) return
        try {
            await supabase
                .from("profiles")
                .update({ onboarding_complete: true })
                .eq("id", user.id)
            
            localStorage.setItem("clorefy_onboarding_skipped", "true")
            localStorage.removeItem("clorefy_onboarding_phase")
            localStorage.removeItem("clorefy_onboarding_data")
            localStorage.removeItem("clorefy_onboarding_messages")
            localStorage.removeItem("clorefy_plan_selected")
            localStorage.removeItem("clorefy_upload_extracted")
            
            toast.info("You can complete your setup anytime from the dashboard")
            router.push("/")
            router.refresh()
        } catch (error) {
            console.error("Skip error:", error)
            await logErrorToDatabase(`onboarding_${phase}`, error, {
                onboarding_phase: phase,
                fields_completed: countCompletedFields(extractedData),
                used_extraction: usedExtractionRef.current,
            })
            toast.error("Something went wrong. Please try again.")
        }
    }

    if (isLoading) {
        return (
            <div className="h-[100dvh] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <header className="border-b py-4 px-5 flex items-center justify-between shrink-0 bg-card shadow-sm">
                <div className="flex items-center gap-3">
                    <InvoLogo size={32} />
                    <span className="text-sm font-semibold text-foreground">Business Setup</span>
                </div>
                <button
                    type="button"
                    onClick={handleSkip}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
                >
                    Skip for now
                </button>
            </header>

            {/* Main — Upload, Chat, Logo, Payments */}
            <main className="flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    {phase === "upload" && (
                        <motion.div 
                            key="upload" 
                            initial={{ opacity: 0, y: 15 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -15 }} 
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="absolute inset-0 h-full w-full"
                        >
                            <UploadScreen
                                onContinue={(data) => {
                                    usedExtractionRef.current = true
                                    setExtractedData(data)
                                    setPhase("chat")
                                    trackPhaseTransition("chat", { used_extraction: true })
                                }}
                                onSkip={() => {
                                    usedExtractionRef.current = false
                                    setExtractedData({})
                                    setPhase("chat")
                                    trackPhaseTransition("chat", { used_extraction: false })
                                }}
                            />
                        </motion.div>
                    )}
                    {phase === "chat" && (
                        <motion.div 
                            key="chat" 
                            initial={{ opacity: 0, y: 15 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -15 }} 
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="absolute inset-0 h-full w-full"
                        >
                            <OnboardingChat
                                onComplete={handleChatComplete}
                                userEmail={user?.email || ""}
                                initialData={extractedData}
                            />
                        </motion.div>
                    )}
                    {phase === "logo" && (
                        <motion.div 
                            key="logo" 
                            initial={{ opacity: 0, y: 15 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -15 }} 
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="absolute inset-0 h-full w-full flex items-center justify-center p-6 bg-background"
                        >
                        <div className="w-full max-w-md space-y-6">
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                                    <ImageIcon className="w-6 h-6 text-primary" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground">Add your business logo</h2>
                                <p className="text-sm text-muted-foreground">
                                    Your logo will appear on invoices, contracts, and other documents you generate.
                                </p>
                            </div>

                            <LogoUploader
                                onUploadComplete={(objectKey) => {
                                    setExtractedData(prev => ({ ...prev, logoUrl: objectKey }))
                                }}
                                onRemove={() => {
                                    setExtractedData(prev => ({ ...prev, logoUrl: null }))
                                }}
                            />

                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={() => {
                                        setPhase("payments")
                                        trackPhaseTransition("payments")
                                    }}
                                    className="w-full gap-2 h-11"
                                >
                                    Continue
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPhase("payments")
                                        trackPhaseTransition("payments")
                                    }}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Skip — I&apos;ll add a logo later
                                </button>
                            </div>
                        </div>
                    </motion.div>
                    )}
                    {phase === "payments" && (
                        <motion.div 
                            key="payments" 
                            initial={{ opacity: 0, y: 15 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -15 }} 
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="absolute inset-0 h-full w-full overflow-y-auto bg-background"
                        >
                            <div className="w-full max-w-lg space-y-6 py-8 px-6 mx-auto">
                                <div className="text-center space-y-2">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                                        <CreditCard className="w-6 h-6 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-foreground">Set up payment collection</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Connect your payment gateway so clients can pay invoices directly. You can skip and set it up later in Settings.
                                    </p>
                                </div>

                                <PaymentSettings />

                                <div className="flex flex-col gap-3 pt-2">
                                    <Button onClick={() => handleFinalSave(extractedData)} className="w-full gap-2 h-11">
                                        Complete Setup
                                        <ArrowRight className="w-4 h-4" />
                                    </Button>
                                    <button type="button" onClick={() => handleFinalSave(extractedData)}
                                        className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                                        Skip — I&apos;ll set up payments later
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Support button — visible on all 4 active phases */}
                <OnboardingSupportButton
                    currentPhase={phase}
                    userEmail={user?.email || ""}
                />
            </main>
        </div>
    )
}

"use client"

import { useState, useEffect } from "react"
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
import { motion, AnimatePresence } from "framer-motion"

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

    // Redirect if not logged in, or if plan not selected
    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/auth/login")
            return
        }
        if (!isLoading && user) {
            supabase
                .from("profiles")
                .select("onboarding_complete, plan_selected")
                .eq("id", user.id)
                .single()
                .then(({ data }: any) => {
                    // Must select a plan before onboarding
                    // Trust the plan_selected URL param if we just came from choose-plan to avoid DB replication races
                    const hasJustSelectedPlan = searchParams.get("plan_selected") === "1"
                    if (!data?.plan_selected && !hasJustSelectedPlan) {
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
        setExtractedData(prev => ({ ...prev, ...data }))
        setPhase("logo")
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
            const { data: existingBiz } = await supabase
                .from("businesses")
                .select("logo_url, logo_data_url")
                .eq("user_id", user.id)
                .single() as any

            const logoUrl = data.logoUrl || existingBiz?.logo_url || null
            const logoDataUrl = existingBiz?.logo_data_url || null

            const { error: businessError } = await supabase.from("businesses").upsert({
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
                logo_data_url: logoDataUrl,
                signature_url: data.signatureUrl || null,
            } as any, { onConflict: 'user_id' })

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
            localStorage.removeItem("clorefy_onboarding_skipped")
            localStorage.removeItem("clorefy_onboarding_phase")
            localStorage.removeItem("clorefy_onboarding_data")
            localStorage.removeItem("clorefy_onboarding_messages")
            router.push("/")
            router.refresh()
        } catch (error) {
            console.error("Save error:", error)
            toast.error("Failed to save profile. Please try again.")
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
            
            toast.info("You can complete your setup anytime from the dashboard")
            router.push("/")
            router.refresh()
        } catch (error) {
            console.error("Skip error:", error)
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
                                    setExtractedData(data)
                                    setPhase("chat")
                                }}
                                onSkip={() => {
                                    setExtractedData({})
                                    setPhase("chat")
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
                                    onClick={() => setPhase("payments")}
                                    className="w-full gap-2 h-11"
                                >
                                    Continue
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setPhase("payments")}
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
            </main>
        </div>
    )
}

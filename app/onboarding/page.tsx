"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { InvoLogo } from "@/components/invo-logo"
import { OnboardingChat, type CollectedData } from "@/components/onboarding-chat"
import { UploadScreen } from "@/components/upload-screen"
import { LogoUploader } from "@/components/logo-uploader"
import { toast } from "sonner"
import { Loader2, ImageIcon, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getTaxIdFieldName } from "@/lib/countries"

export default function OnboardingPage() {
    const router = useRouter()
    const { supabase, user, isLoading } = useAuth()
    const [phase, setPhase] = useState<"upload" | "chat" | "logo">("upload")
    const [extractedData, setExtractedData] = useState<CollectedData>({})

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
                    if (!data?.plan_selected) {
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
    }, [isLoading, user, router, supabase])

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
            // Mark onboarding as complete but with skipped flag
            await supabase
                .from("profiles")
                .update({ onboarding_complete: true })
                .eq("id", user.id)
            
            // Store skip flag in localStorage so the banner shows
            localStorage.setItem("clorefy_onboarding_skipped", "true")
            
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
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col bg-background">
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

            {/* Main — Upload, Chat, or Logo */}
            <main className="flex-1 overflow-hidden">
                {phase === "upload" ? (
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
                ) : phase === "chat" ? (
                    <OnboardingChat
                        onComplete={handleChatComplete}
                        userEmail={user?.email || ""}
                        initialData={extractedData}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full p-6">
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
                                    onClick={() => handleFinalSave(extractedData)}
                                    className="w-full gap-2 h-11"
                                >
                                    Complete Setup
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => handleFinalSave(extractedData)}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Skip — I&apos;ll add a logo later
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

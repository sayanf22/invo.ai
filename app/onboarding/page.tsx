"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { InvoLogo } from "@/components/invo-logo"
import { OnboardingChat } from "@/components/onboarding-chat"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { getTaxIdFieldName } from "@/lib/countries"

export default function OnboardingPage() {
    const router = useRouter()
    const { supabase, user, isLoading } = useAuth()

    // Redirect if not logged in
    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/auth/login")
        }
    }, [isLoading, user, router])

    const handleComplete = async (data: Record<string, any>) => {
        if (!user) return

        try {
            // Build tax_ids object
            const taxIds: Record<string, string> = {}
            if (data.taxId && data.country) {
                const fieldName = getTaxIdFieldName(data.country)
                taxIds[fieldName] = data.taxId
            }

            // Save business profile to Supabase
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
                logo_url: data.logoUrl || null,
                signature_url: data.signatureUrl || null,
            })

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

            toast.success("🎉 Business profile saved! Welcome to Invo.ai")
            router.push("/")
            router.refresh()
        } catch (error) {
            console.error("Save error:", error)
            toast.error("Failed to save profile. Please try again.")
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
            <header className="border-b py-4 px-6 flex items-center justify-between shrink-0">
                <InvoLogo />
                <div className="text-sm text-muted-foreground">
                    Business Setup
                </div>
            </header>

            {/* Main — Chat Only */}
            <main className="flex-1 p-4 lg:p-6 overflow-hidden">
                <OnboardingChat
                    onComplete={handleComplete}
                    userEmail={user?.email || ""}
                />
            </main>
        </div>
    )
}

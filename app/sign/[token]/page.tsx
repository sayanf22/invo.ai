"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { SignaturePad } from "@/components/signature-pad"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InvoLogo } from "@/components/invo-logo"
import { Loader2, CheckCircle2, XCircle, FileText, Shield } from "lucide-react"
import { toast } from "sonner"

interface SignatureData {
    id: string
    signer_name: string | null
    signer_email: string
    party: string
    signed_at: string | null
    expires_at: string | null
    documents: {
        id: string
        type: string
        data: Record<string, unknown>
        status: string | null
    }
}

export default function SigningPage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string

    const [isLoading, setIsLoading] = useState(true)
    const [signature, setSignature] = useState<SignatureData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isComplete, setIsComplete] = useState(false)

    // Form state
    const [agreedToTerms, setAgreedToTerms] = useState(false)
    const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)

    useEffect(() => {
        async function loadSignature() {
            try {
                // Fetch signature details via API (public endpoint if token provided)
                const response = await fetch(`/api/signatures?token=${token}`)
                const data = await response.json()

                if (!response.ok) {
                    setError(data.error || "Failed to load signing request")
                    return
                }

                if (data.signature.signed_at) {
                    setIsComplete(true)
                }

                setSignature(data.signature)
            } catch (err) {
                setError("Failed to load signing request")
                console.error(err)
            } finally {
                setIsLoading(false)
            }
        }

        if (token) {
            loadSignature()
        } else {
            setError("Invalid signing link")
            setIsLoading(false)
        }
    }, [token])

    const handleSubmitSignature = async () => {
        if (!signatureDataUrl || !agreedToTerms || !signature) {
            toast.error("Please complete all required fields")
            return
        }

        setIsSubmitting(true)

        try {
            // Submit to backend API
            const response = await fetch("/api/signatures/sign", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token,
                    signatureDataUrl,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to submit signature")
            }

            setIsComplete(true)
            toast.success("Document signed successfully!")
        } catch (err) {
            console.error("Signing error:", err)
            toast.error(err instanceof Error ? err.message : "Failed to submit signature. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
                <div className="w-full max-w-md text-center space-y-4">
                    <XCircle className="h-16 w-16 text-destructive mx-auto" />
                    <h1 className="text-2xl font-semibold">Unable to Sign</h1>
                    <p className="text-muted-foreground">{error}</p>
                    <Button onClick={() => router.push("/")} variant="outline">
                        Go to Home
                    </Button>
                </div>
            </div>
        )
    }

    if (isComplete) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
                <div className="w-full max-w-md text-center space-y-4">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                    <h1 className="text-2xl font-semibold">Signature Complete</h1>
                    <p className="text-muted-foreground">
                        Thank you, {signature?.signer_name}! Your signature has been recorded.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        A confirmation email will be sent to {signature?.signer_email}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Header */}
            <header className="border-b py-4 px-6 flex items-center justify-between">
                <InvoLogo />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4 text-green-500" />
                    Secure Signing
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-lg space-y-8">
                    {/* Document info */}
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
                        <FileText className="h-10 w-10 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                                {(signature?.documents.data as { title?: string })?.title ||
                                    `${signature?.documents.type} Document`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Signing as: {signature?.signer_name} ({signature?.party})
                            </p>
                        </div>
                    </div>

                    {/* Signer info (readonly) */}
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label>Your Name</Label>
                            <Input value={signature?.signer_name || ""} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Your Email</Label>
                            <Input value={signature?.signer_email || ""} disabled />
                        </div>
                    </div>

                    {/* Signature pad */}
                    <div className="space-y-2">
                        <Label>Your Signature</Label>
                        <SignaturePad onSignature={setSignatureDataUrl} />
                        {signatureDataUrl && (
                            <p className="text-sm text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" />
                                Signature captured
                            </p>
                        )}
                    </div>

                    {/* Terms agreement */}
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-muted-foreground">
                            I agree that this electronic signature is legally binding and represents
                            my intent to sign this document.
                        </span>
                    </label>

                    {/* Submit button */}
                    <Button
                        onClick={handleSubmitSignature}
                        disabled={!signatureDataUrl || !agreedToTerms || isSubmitting}
                        className="w-full"
                        size="lg"
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            "Sign Document"
                        )}
                    </Button>

                    {/* Security note */}
                    <p className="text-xs text-center text-muted-foreground">
                        This signing session is encrypted and your signature will be securely
                        stored. By signing, you agree to our Terms of Service.
                    </p>
                </div>
            </main>
        </div>
    )
}


"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, Shield, FileText, Clock, Globe, Hash } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { InvoLogo } from "@/components/invo-logo"

interface VerificationData {
  valid: boolean
  signature: {
    id: string
    signer_name: string
    signer_email: string
    signed_at: string | null
    document_hash: string | null
    ip_address: string | null
    user_agent: string | null
    verification_url: string | null
  }
  document: {
    type: string
    reference: string
    business_name: string
  }
}

export default function VerifySignaturePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/signatures/verify?id=${id}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) setError(json.error)
        else setData(json)
      })
      .catch(() => setError("Failed to verify signature"))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <InvoLogo size={48} />
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Shield className="w-4 h-4" />
            <span>Signature Verification</span>
          </div>
        </div>

        {loading && (
          <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-3 shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Verifying signature…</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-card border border-red-200 dark:border-red-800/40 rounded-2xl p-8 flex flex-col items-center gap-3 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Verification Failed</h1>
            <p className="text-sm text-muted-foreground text-center">{error}</p>
          </div>
        )}

        {!loading && data && (
          <div className={cn(
            "bg-card border rounded-2xl overflow-hidden shadow-sm",
            data.valid && data.signature.signed_at
              ? "border-emerald-200 dark:border-emerald-800/40"
              : "border-amber-200 dark:border-amber-800/40"
          )}>
            {/* Status banner */}
            <div className={cn(
              "px-6 py-5 flex items-center gap-4",
              data.valid && data.signature.signed_at
                ? "bg-emerald-50 dark:bg-emerald-950/30"
                : "bg-amber-50 dark:bg-amber-950/30"
            )}>
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                data.valid && data.signature.signed_at
                  ? "bg-emerald-100 dark:bg-emerald-900/40"
                  : "bg-amber-100 dark:bg-amber-900/40"
              )}>
                {data.valid && data.signature.signed_at
                  ? <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  : <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                }
              </div>
              <div>
                <h1 className={cn(
                  "text-base font-bold",
                  data.valid && data.signature.signed_at
                    ? "text-emerald-800 dark:text-emerald-200"
                    : "text-amber-800 dark:text-amber-200"
                )}>
                  {data.valid && data.signature.signed_at ? "Signature Verified" : "Not Yet Signed"}
                </h1>
                <p className={cn(
                  "text-sm mt-0.5",
                  data.valid && data.signature.signed_at
                    ? "text-emerald-600/80 dark:text-emerald-400/80"
                    : "text-amber-600/80 dark:text-amber-400/80"
                )}>
                  {data.valid && data.signature.signed_at
                    ? "This signature is authentic and unmodified"
                    : "This signing request has not been completed yet"
                  }
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="px-6 py-5 space-y-4">
              {/* Document */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Document</p>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {data.document.type} {data.document.reference}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">{data.document.business_name}</p>
              </div>

              {/* Signer */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Signer</p>
                <p className="text-sm font-medium text-foreground">{data.signature.signer_name}</p>
                <p className="text-xs text-muted-foreground">{data.signature.signer_email}</p>
              </div>

              {/* Signed at */}
              {data.signature.signed_at && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Signed At</p>
                  <p className="text-sm text-foreground">
                    {format(new Date(data.signature.signed_at), "MMMM d, yyyy 'at' h:mm a 'UTC'")}
                  </p>
                </div>
              )}

              {/* IP */}
              {data.signature.ip_address && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">IP Address</p>
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm text-foreground font-mono">{data.signature.ip_address}</p>
                  </div>
                </div>
              )}

              {/* Document hash */}
              {data.signature.document_hash && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Document Hash</p>
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground font-mono truncate">{data.signature.document_hash}</p>
                  </div>
                </div>
              )}

              {/* Device */}
              {data.signature.user_agent && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Device</p>
                  <p className="text-xs text-muted-foreground">
                    {data.signature.user_agent.includes("Mobile") ? "Mobile" : "Desktop"} ·{" "}
                    {data.signature.user_agent.includes("Chrome") ? "Chrome" :
                     data.signature.user_agent.includes("Firefox") ? "Firefox" :
                     data.signature.user_agent.includes("Safari") ? "Safari" : "Browser"}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border/50 bg-muted/20">
              <p className="text-[11px] text-muted-foreground text-center">
                Verified by <span className="font-semibold text-foreground">Clorefy</span> · Electronic Signature Platform
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

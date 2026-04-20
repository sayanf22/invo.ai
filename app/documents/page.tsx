"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { FileText, Download, Eye, Calendar, Loader2, ArrowRight, ArrowLeft, Plus } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"

interface DocSession {
  id: string
  document_type: string
  status: string
  client_name: string | null
  created_at: string
  updated_at: string | null
  context: any
}

const TYPE_COLORS: Record<string, string> = {
  invoice: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  contract: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  quotation: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  proposal: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

export default function MyDocumentsPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const user = useUser()
  const [sessions, setSessions] = useState<DocSession[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>("all")

  useEffect(() => {
    if (!user) return
    loadSessions()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSessions = async () => {
    if (!user?.id) { setLoading(false); return }
    try {
      const { data, error } = await supabase
        .from("document_sessions")
        .select("id, document_type, status, client_name, created_at, updated_at, context")
        .eq("user_id", user.id)
        .not("context", "eq", "{}")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error

      const withContent = (data || []).filter((s: any) => {
        const ctx = s.context
        if (!ctx || typeof ctx !== "object") return false
        return ctx.documentType || ctx.fromName || ctx.toName || (Array.isArray(ctx.items) && ctx.items.length > 0)
      })

      setSessions(withContent as DocSession[])
    } catch (error: any) {
      console.error("Error loading sessions:", error?.message || error)
      toast.error("Failed to load documents")
    } finally {
      setLoading(false)
    }
  }

  const downloadDocument = async (session: DocSession) => {
    if (!session.context) { toast.error("No document data available"); return }
    setDownloadingId(session.id)
    try {
      const cleanedData = cleanDataForExport(session.context as InvoiceData)
      const logoUrl = await resolveLogoUrl(cleanedData.fromLogo)
      const templates = await import("@/lib/pdf-templates")
      const { pdf } = await import("@react-pdf/renderer")

      let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null }>
      let filePrefix: string
      const docType = (session.document_type || "invoice").toLowerCase()

      switch (docType) {
        case "contract": PdfComponent = templates.ContractPDF; filePrefix = cleanedData.referenceNumber || "contract"; break
        case "quotation": PdfComponent = templates.QuotationPDF; filePrefix = cleanedData.referenceNumber || "quotation"; break
        case "proposal": PdfComponent = templates.ProposalPDF; filePrefix = cleanedData.referenceNumber || "proposal"; break
        default: PdfComponent = templates.InvoicePDF; filePrefix = cleanedData.invoiceNumber || "invoice"; break
      }

      const blob = await pdf(<PdfComponent data={cleanedData} logoUrl={logoUrl} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${filePrefix}_${new Date().toISOString().split("T")[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("PDF downloaded!")
    } catch (error) {
      console.error("PDF download error:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setDownloadingId(null)
    }
  }

  const getDocTitle = (s: DocSession): string => {
    const ctx = s.context || {}
    return ctx.invoiceNumber || ctx.referenceNumber || s.client_name ||
      `${(s.document_type || "document").charAt(0).toUpperCase() + (s.document_type || "document").slice(1)}`
  }

  const getDocTotal = (s: DocSession): string | null => {
    const ctx = s.context || {}
    if (!ctx.items || !Array.isArray(ctx.items) || ctx.items.length === 0) return null
    const subtotal = ctx.items.reduce((sum: number, item: any) => {
      return sum + (Number(item.quantity) || 1) * (Number(item.rate) || 0)
    }, 0)
    return `${ctx.currency || "₹"}${subtotal.toLocaleString()}`
  }

  const filtered = filter === "all" ? sessions : sessions.filter(s => s.document_type === filter)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-secondary/60 transition-colors shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold">My Documents</h1>
            <p className="text-xs text-muted-foreground">
              {sessions.length} document{sessions.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity active:scale-[0.97] shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Filter pills */}
        {sessions.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
            {["all", "invoice", "contract", "quotation", "proposal"].map(f => {
              const count = f === "all" ? sessions.length : sessions.filter(s => s.document_type === f).length
              if (f !== "all" && count === 0) return null
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted/60"
                  }`}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                </button>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <p className="font-semibold text-base mb-1">
              {sessions.length === 0 ? "No documents yet" : "No matching documents"}
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {sessions.length === 0
                ? "Describe a document to the AI and it will appear here."
                : "Try a different filter."}
            </p>
            {sessions.length === 0 && (
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity active:scale-[0.97]"
              >
                Create your first document <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const total = getDocTotal(s)
              const docType = (s.document_type || "invoice").toLowerCase()
              const title = getDocTitle(s)
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/60 hover:border-border transition-colors active:bg-secondary/30"
                  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                >
                  {/* Type badge */}
                  <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${TYPE_COLORS[docType] || "bg-muted text-muted-foreground"}`}>
                    {docType}
                  </div>

                  {/* Info — tappable to open */}
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => router.push(`/?sessionId=${s.id}`)}
                  >
                    <p className="font-medium text-sm truncate">{title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {s.client_name && s.client_name !== title && (
                        <span className="truncate max-w-[120px]">{s.client_name}</span>
                      )}
                      <span className="flex items-center gap-1 shrink-0">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(s.created_at), "MMM d, yyyy")}
                      </span>
                      {total && (
                        <span className="font-medium text-foreground shrink-0">{total}</span>
                      )}
                    </div>
                  </button>

                  {/* Actions — always visible */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-secondary/60 active:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => router.push(`/?sessionId=${s.id}`)}
                      aria-label="Open document"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-secondary/60 active:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
                      disabled={downloadingId === s.id}
                      onClick={() => downloadDocument(s)}
                      aria-label="Download PDF"
                    >
                      {downloadingId === s.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Download className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

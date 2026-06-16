"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft, Plus, Search, Eye, Download, Send, Copy,
  Trash2, Clock, CheckCircle2, XCircle, FileText, AlertTriangle,
  Loader2, Presentation,
} from "lucide-react"
import { useSafeBack } from "@/hooks/use-safe-back"
import { toast } from "sonner"
import { format, differenceInDays, isPast } from "date-fns"
import { cn } from "@/lib/utils"
import { authFetch } from "@/lib/auth-fetch"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import type { InvoiceData } from "@/lib/invoice-types"

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProposalSession {
  id: string
  status: "active" | "finalized" | "signed" | "expired"
  client_name: string | null
  created_at: string
  updated_at: string | null
  sent_at: string | null
  context: InvoiceData & {
    referenceNumber?: string
    proposalNumber?: string
    validUntilDate?: string
    dueDate?: string
    _proposalFormData?: any
    _proposalSections?: any
  }
  quotationResponse?: { response_type: string } | null
}

// ── Status helpers ─────────────────────────────────────────────────────────────

type ProposalStatus = "draft" | "sent" | "accepted" | "declined" | "changes_requested" | "expired"

function getProposalStatus(p: ProposalSession): ProposalStatus {
  const validUntil = p.context?.validUntilDate || p.context?.dueDate
  if (validUntil && isPast(new Date(validUntil + "T23:59:59"))) {
    return "expired"
  }
  if (p.quotationResponse?.response_type === "accepted") return "accepted"
  if (p.quotationResponse?.response_type === "declined") return "declined"
  if (p.quotationResponse?.response_type === "changes_requested") return "changes_requested"
  if (p.sent_at || p.status === "finalized") return "sent"
  return "draft"
}

const STATUS_CONFIG: Record<ProposalStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: Send },
  accepted: { label: "Accepted", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  declined: { label: "Declined", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  changes_requested: { label: "Changes Requested", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: AlertTriangle },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", icon: Clock },
}

// ── Proposals Page ──────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const supabase = useSupabase()
  const user = useUser()
  const router = useRouter()
  const safeBack = useSafeBack()

  const [proposals, setProposals] = useState<ProposalSession[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "all">("all")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadProposals = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("document_sessions")
        .select(`
          id, status, client_name, created_at, updated_at, sent_at, context,
          quotation_responses(response_type)
        `)
        .eq("user_id", user.id)
        .eq("document_type", "proposal")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error

      const rows = (data || []).map((row: any) => ({
        ...row,
        quotationResponse: row.quotation_responses?.[0] ?? null,
      }))
      setProposals(rows)
    } catch (err) {
      toast.error("Failed to load proposals")
    } finally {
      setLoading(false)
    }
  }, [user?.id, supabase])

  useEffect(() => {
    loadProposals()
  }, [loadProposals])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from("document_sessions")
        .delete()
        .eq("id", deleteTarget)
        .eq("user_id", user!.id)

      if (error) throw error
      setProposals(prev => prev.filter(p => p.id !== deleteTarget))
      toast.success("Proposal deleted")
    } catch {
      toast.error("Failed to delete proposal")
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  function openProposal(id: string) {
    router.push(`/?sessionId=${id}`)
  }

  // Filtered proposals
  const filtered = proposals.filter(p => {
    const status = getProposalStatus(p)
    const matchesStatus = statusFilter === "all" || status === statusFilter
    const matchesSearch = !searchQuery
      || (p.client_name || "").toLowerCase().includes(searchQuery.toLowerCase())
      || (p.context?.referenceNumber || p.context?.proposalNumber || "").toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={safeBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border/60 bg-background hover:bg-accent transition-colors text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <ClorefyLogo size={28} />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Proposals</h1>
            <p className="text-xs text-muted-foreground">
              {proposals.length} {proposals.length === 1 ? "proposal" : "proposals"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => router.push("/?builder=proposal")}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Proposal
          </Button>
          <HamburgerMenu />
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-6 py-3 border-b border-border bg-card/50 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by client or number…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(["all", "draft", "sent", "accepted", "declined", "expired"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {s === "all" ? "All" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4">
              <Presentation className="w-7 h-7 text-violet-600 dark:text-violet-400" />
            </div>
            {proposals.length === 0 ? (
              <>
                <h3 className="text-base font-semibold mb-1">No proposals yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Use the Proposal Builder to create your first professional proposal.
                </p>
                <Button onClick={() => router.push("/?builder=proposal")} size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Build a Proposal
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold mb-1">No matching proposals</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your search or filter.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(proposal => {
              const status = getProposalStatus(proposal)
              const cfg = STATUS_CONFIG[status]
              const StatusIcon = cfg.icon
              const validUntil = proposal.context?.validUntilDate || proposal.context?.dueDate
              const daysUntilExpiry = validUntil ? differenceInDays(new Date(validUntil), new Date()) : null
              const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7
              const refNum = proposal.context?.referenceNumber || proposal.context?.proposalNumber || proposal.id.slice(0, 8).toUpperCase()

              return (
                <div
                  key={proposal.id}
                  className="flex items-center gap-3 p-3 sm:p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors group cursor-pointer"
                  onClick={() => openProposal(proposal.id)}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                    <Presentation className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">
                        {proposal.client_name || "Unknown Client"}
                      </p>
                      <span className="text-xs text-muted-foreground font-mono">{refNum}</span>
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      {isExpiringSoon && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          <Clock className="w-3 h-3" />
                          Expires in {daysUntilExpiry}d
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span>Created {format(new Date(proposal.created_at), "dd MMM yyyy")}</span>
                      {validUntil && !isPast(new Date(validUntil)) && (
                        <span>Valid until {format(new Date(validUntil), "dd MMM yyyy")}</span>
                      )}
                      {proposal.context?._proposalFormData?.serviceCategory && (
                        <span className="capitalize">
                          {proposal.context._proposalFormData.serviceCategory.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      title="Open proposal"
                      onClick={() => openProposal(proposal.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Delete proposal"
                      onClick={() => setDeleteTarget(proposal.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Proposal"
        description="This proposal and all its data will be permanently deleted. This cannot be undone."
      />
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import { Bell, CheckCircle2, Gift, CreditCard, XCircle, RefreshCw, Info, Loader2, Check, ArrowLeft, Eye, PenLine, Clock, Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSafeBack } from "@/hooks/use-safe-back"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { ClorefyLogo } from "@/components/clorefy-logo"
import Link from "next/link"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  metadata: Record<string, any>
  created_at: string
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  subscription_activated: { icon: CreditCard,   color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  subscription_free_grant:{ icon: Gift,          color: "text-purple-600",  bg: "bg-purple-50 dark:bg-purple-950/30" },
  subscription_cancelled: { icon: XCircle,       color: "text-red-500",     bg: "bg-red-50 dark:bg-red-950/30" },
  subscription_renewed:   { icon: RefreshCw,     color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/30" },
  document_limit_warning:          { icon: Info,          color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30" },
  general:                         { icon: Bell,          color: "text-muted-foreground", bg: "bg-muted" },
  signature_viewed:                { icon: Eye,           color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/30" },
  signature_signed:                { icon: PenLine,       color: "text-green-600",   bg: "bg-green-50 dark:bg-green-950/30" },
  signature_completed:             { icon: CheckCircle2,  color: "text-green-700",   bg: "bg-green-100 dark:bg-green-950/40" },
  signature_expired:               { icon: Clock,         color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30" },
  quotation_accepted:              { icon: Check,         color: "text-green-600",   bg: "bg-green-50 dark:bg-green-950/30" },
  quotation_declined:              { icon: XCircle,       color: "text-red-500",     bg: "bg-red-50 dark:bg-red-950/30" },
  quotation_changes_requested:     { icon: Edit3,         color: "text-orange-600",  bg: "bg-orange-50 dark:bg-orange-950/30" },
}

export default function NotificationsPage() {
  const router = useRouter()
  const goBack = useSafeBack("/")
  const user = useUser()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return }
    loadNotifications()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadNotifications = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)
      if (error) throw error
      setNotifications((data || []) as unknown as Notification[])
    } catch (err) {
      console.error("Failed to load notifications:", err)
    } finally {
      setLoading(false)
    }
  }, [user])

  const markAsRead = useCallback(async (id: string) => {
    const supabase = createClient()
    await supabase.from("notifications" as any).update({ read: true }).eq("id", id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!user) return
    setMarkingAll(true)
    try {
      const supabase = createClient()
      await supabase
        .from("notifications" as any)
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } finally {
      setMarkingAll(false)
    }
  }, [user])

  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="w-8 h-8 flex items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <ClorefyLogo size={24} />
              <span className="font-semibold text-sm">Notifications</span>
            </div>
          </div>
          <HamburgerMenu />
        </div>
      </div>

      <div className="container mx-auto p-4 sm:p-6 max-w-2xl pt-6 sm:pt-10">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your account activity and updates</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={markingAll} className="gap-1.5">
            {markingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
            <Bell className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold mb-1">All caught up</h3>
          <p className="text-sm text-muted-foreground">Notifications about your plan and activity will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.general
            const Icon = cfg.icon
            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.read) markAsRead(n.id)
                  if (n.metadata?.session_id) router.push(`/view/${n.metadata.session_id}`)
                }}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                  n.read
                    ? "bg-card border-border/50 opacity-60"
                    : "bg-card border-border shadow-sm hover:shadow-md hover:-translate-y-px"
                )}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", cfg.bg)}>
                  <Icon className={cn("w-5 h-5", cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm font-semibold leading-snug", !n.read && "text-foreground")}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                  {n.type === "quotation_changes_requested" && n.metadata?.reason && (
                    <div className="mt-2 p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40">
                      <p className="text-xs font-medium text-orange-700 dark:text-orange-400 mb-0.5">Requested changes:</p>
                      <p className="text-xs text-orange-600 dark:text-orange-300 leading-relaxed">{n.metadata.reason}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/60 mt-1.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
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

import { requireAdmin } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { formatDistanceToNow } from "date-fns"
import { MessageSquare, Mail, CheckCircle, Clock } from "lucide-react"

export default async function AdminSupportPage() {
    await requireAdmin()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

    const { data: messages, error } = await supabase
        .from("support_messages")
        .select(`
            id,
            message,
            status,
            admin_notes,
            created_at,
            user_id,
            profiles:user_id (email, full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(100)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Support Feedback</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    View and manage support tickets and feedback submitted directly from the user dashboard.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {error ? (
                    <div className="p-8 text-center text-red-500 bg-card rounded-xl border border-border">
                        Failed to load support messages.
                    </div>
                ) : !messages || messages.length === 0 ? (
                    <div className="p-16 text-center text-muted-foreground flex flex-col items-center bg-card rounded-xl border border-border shadow-sm">
                        <MessageSquare className="w-10 h-10 mb-4 text-primary/40" />
                        <p className="font-medium text-foreground text-lg">Inbox Zero</p>
                        <p className="text-sm mt-1">No pending support messages.</p>
                    </div>
                ) : (
                    messages.map((msg: any) => (
                        <div key={msg.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                            {msg.status === 'unread' && (
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                            )}
                            
                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                                <div className="flex items-start gap-4 flex-1">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                        <span className="font-semibold text-primary">
                                            {msg.profiles?.full_name?.[0]?.toUpperCase() || "U"}
                                        </span>
                                    </div>
                                    <div className="space-y-1 w-full">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-foreground">
                                                {msg.profiles?.full_name || "Unknown User"}
                                            </h3>
                                            {msg.profiles?.email && (
                                                <a href={`mailto:${msg.profiles.email}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors bg-muted/50 px-2 py-0.5 rounded-full">
                                                    <Mail className="w-3 h-3" />
                                                    {msg.profiles.email}
                                                </a>
                                            )}
                                            {msg.status === 'unread' && (
                                                <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                    New
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                                            <Clock className="w-3 h-3" />
                                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                                        </div>

                                        <div className="bg-muted/30 border border-border/50 rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed mt-3">
                                            {msg.message}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

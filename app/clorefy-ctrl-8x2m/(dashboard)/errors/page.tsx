import { requireAdmin } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, CheckCircle, Clock } from "lucide-react"

export default async function AdminErrorsPage() {
    await requireAdmin()

    // Service role client to bypass RLS and fetch all errors
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

    const { data: errors, error } = await supabase
        .from("error_logs")
        .select(`
            id,
            error_context,
            error_message,
            metadata,
            status,
            created_at,
            user_id,
            profiles:user_id (email, full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(100)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">System Errors</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Track and resolve application errors automatically logged from user sessions.
                </p>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                {error ? (
                    <div className="p-8 text-center text-red-500">
                        Failed to load error logs.
                    </div>
                ) : !errors || errors.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                        <CheckCircle className="w-8 h-8 mb-3 text-green-500 opacity-80" />
                        <p className="font-medium text-foreground">No errors logged</p>
                        <p className="text-sm mt-1">The system is running smoothly.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                                <tr>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Context</th>
                                    <th className="px-6 py-4">Error Message</th>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {errors.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-6 py-4">
                                            {log.status === "open" ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                                    <AlertTriangle className="w-3.5 h-3.5" /> Open
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                                    <CheckCircle className="w-3.5 h-3.5" /> Resolved
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs">
                                            {log.error_context}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="max-w-md truncate font-medium" title={log.error_message}>
                                                {log.error_message}
                                            </div>
                                            {log.metadata && (
                                                <div className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                                                    {JSON.stringify(log.metadata)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.profiles ? (
                                                <div className="text-sm">
                                                    <div className="font-medium">{log.profiles.full_name || 'Unnamed'}</div>
                                                    <div className="text-muted-foreground text-xs">{log.profiles.email}</div>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground italic text-xs">Anonymous / System</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

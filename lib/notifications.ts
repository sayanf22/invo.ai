import type { SupabaseClient } from "@supabase/supabase-js"

export type NotificationType =
    | "subscription_activated"
    | "subscription_free_grant"
    | "subscription_cancelled"
    | "subscription_renewed"
    | "document_limit_warning"
    | "general"

export interface CreateNotificationParams {
    user_id: string
    type: NotificationType
    title: string
    message: string
    metadata?: Record<string, any>
}

/**
 * Insert a notification for a user.
 * Uses the provided Supabase client (should be service-role for server-side).
 */
export async function createNotification(
    supabase: SupabaseClient,
    params: CreateNotificationParams
): Promise<void> {
    const { error } = await supabase.from("notifications" as any).insert({
        user_id: params.user_id,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: params.metadata ?? {},
    })
    if (error) {
        console.error("Failed to create notification:", error.message)
    }
}

export const PLAN_NAMES: Record<string, string> = {
    free: "Free",
    starter: "Starter",
    pro: "Pro",
    agency: "Agency",
}

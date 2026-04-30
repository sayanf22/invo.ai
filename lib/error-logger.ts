import { createClient } from "@/lib/supabase"

export async function logErrorToDatabase(
    context: string,
    error: any,
    metadata?: Record<string, any>
) {
    try {
        const supabase = createClient()
        
        // Extract useful error info
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined

        // Try to get user if available
        const { data: { user } } = await supabase.auth.getUser()

        await supabase.from("error_logs").insert({
            user_id: user?.id || null,
            error_context: context,
            error_message: errorMessage,
            metadata: {
                ...metadata,
                stack: errorStack,
                url: typeof window !== "undefined" ? window.location.href : undefined
            }
        })
    } catch (e) {
        // Fallback: Silently fail to avoid crashing the app during an error
        console.error("Failed to write to error_logs:", e)
    }
}

/**
 * Temporary script to reset user password via Supabase Auth API.
 * 
 * REQUIRES: SUPABASE_SERVICE_ROLE_KEY environment variable
 * 
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/reset-password.mjs
 * 
 * Get the service role key from:
 *   Supabase Dashboard → Settings → API → service_role key (secret)
 */

const SUPABASE_URL = "https://tdeqauhtobtahncglqwq.supabase.co"
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
    console.error("\n❌ SUPABASE_SERVICE_ROLE_KEY is required.")
    console.error("\nTo get it:")
    console.error("1. Go to https://supabase.com/dashboard/project/tdeqauhtobtahncglqwq/settings/api")
    console.error("2. Copy the 'service_role' key (under 'Project API keys')")
    console.error("3. Run: SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/reset-password.mjs")
    process.exit(1)
}

const USER_ID = "2987246b-c8a4-419f-9aa3-5e041c15c663"
const NEW_PASSWORD = "InvoAi2026!"

async function resetPassword() {
    console.log(`\nResetting password for user ${USER_ID}...`)
    
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${USER_ID}`, {
        method: "PUT",
        headers: {
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: NEW_PASSWORD }),
    })

    if (!response.ok) {
        const error = await response.text()
        console.error(`❌ Failed: ${response.status} ${response.statusText}`)
        console.error(error)
        process.exit(1)
    }

    const data = await response.json()
    console.log(`✅ Password reset successfully!`)
    console.log(`   Email: ${data.email}`)
    console.log(`   New password: ${NEW_PASSWORD}`)
    console.log(`\nYou can now log in at: https://invoai.proj-invo.workers.dev/auth/login`)
}

resetPassword().catch(console.error)

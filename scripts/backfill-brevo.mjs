/**
 * Backfill all existing Clorefy users into Brevo contact lists.
 * Run ONCE today to bring all existing users into the right Brevo lists.
 *
 * Usage:
 *   node scripts/backfill-brevo.mjs
 *   node scripts/backfill-brevo.mjs --dry-run   (preview only)
 *
 * What it does:
 *   - Users with onboarding_complete=false   → added to "Onboarding Started" list (id 4)
 *   - Users with onboarding_complete=true    → added to "Active Users" list (id 5)
 *   - Sets LAST_ACTIVE, SIGNUP_AT, ONBOARDING_COMPLETE attributes on each contact
 *   - Does NOT send any emails — that happens via Brevo automation workflows
 */

import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, "../.env")

// Load env vars
const envContent = readFileSync(envPath, "utf8")
function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.+)$`, "m"))
  return match ? match[1].trim() : process.env[key] || ""
}

const BREVO_KEY = getEnv("BREVO_API_KEY")
const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL")
const SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY")
const ONBOARDING_LIST = Number(getEnv("BREVO_ONBOARDING_LIST_ID")) || 4
const ACTIVE_LIST = Number(getEnv("BREVO_ACTIVE_LIST_ID")) || 5

const DRY_RUN = process.argv.includes("--dry-run")

if (!BREVO_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("✗ Missing required env vars. Check .env")
  process.exit(1)
}

async function fetchAllUsers() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,email,full_name,onboarding_complete,last_active_at,created_at&order=created_at.desc`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  )
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`)
  return res.json()
}

async function upsertBrevoContact(user) {
  const today = new Date().toISOString().split("T")[0]
  const listIds = user.onboarding_complete ? [ACTIVE_LIST] : [ONBOARDING_LIST]

  const attributes = {
    LAST_ACTIVE: user.last_active_at ? user.last_active_at.split("T")[0] : today,
    SIGNUP_AT: user.created_at ? user.created_at.split("T")[0] : today,
    ONBOARDING_COMPLETE: user.onboarding_complete ?? false,
  }
  if (user.full_name) {
    attributes.FIRSTNAME = user.full_name.split(" ")[0]
  }

  const res = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": BREVO_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      listIds,
      updateEnabled: true,
      attributes,
    }),
  })

  return res.ok
}

async function main() {
  console.log(`\n🔄 Brevo backfill${DRY_RUN ? " [DRY RUN]" : ""}\n`)

  const users = await fetchAllUsers()
  console.log(`Found ${users.length} users in Supabase\n`)

  const withOnboarding = users.filter((u) => u.onboarding_complete)
  const withoutOnboarding = users.filter((u) => !u.onboarding_complete)

  console.log(`  → ${withOnboarding.length} completed onboarding → "Active Users" list`)
  console.log(`  → ${withoutOnboarding.length} not completed → "Onboarding Started" list\n`)

  if (DRY_RUN) {
    console.log("Dry run complete. No contacts were synced.")
    return
  }

  let synced = 0
  let failed = 0

  for (const user of users) {
    if (!user.email) continue

    const ok = await upsertBrevoContact(user)
    if (ok) {
      synced++
      if (synced % 10 === 0) process.stdout.write(`  Synced ${synced}/${users.length}...\r`)
    } else {
      failed++
      console.error(`  ✗ Failed: ${user.email}`)
    }

    // Rate limiting: ~15 req/sec to be safe
    await new Promise((r) => setTimeout(r, 70))
  }

  console.log(`\n\n✅ Done!`)
  console.log(`  Synced: ${synced}`)
  console.log(`  Failed: ${failed}`)
  console.log(`\nAll existing users are now in Brevo.`)
  console.log(`Next: Set up the 2 automation workflows in app.brevo.com → Automations`)
}

main().catch((err) => {
  console.error("\nFatal error:", err)
  process.exit(1)
})

/**
 * One-time Brevo setup script.
 * Run with: node scripts/setup-brevo.mjs
 *
 * Creates:
 *  - 3 contact attributes: ONBOARDING_COMPLETE, LAST_ACTIVE, SIGNUP_AT
 *  - 1 folder: Clorefy
 *  - 2 contact lists: "Onboarding Started", "Active Users"
 *
 * After running, copy the printed list IDs into your .env file.
 */

import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

// Load .env manually (no dotenv dependency needed)
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, "../.env")
let API_KEY = process.env.BREVO_API_KEY
if (!API_KEY) {
  try {
    const envContent = readFileSync(envPath, "utf8")
    const match = envContent.match(/^BREVO_API_KEY=(.+)$/m)
    if (match) API_KEY = match[1].trim()
  } catch { /* no .env file */ }
}

if (!API_KEY) {
  console.error("✗ BREVO_API_KEY not found in .env or environment")
  process.exit(1)
}

const BASE = "https://api.brevo.com/v3"
const headers = {
  "api-key": API_KEY,
  "Content-Type": "application/json",
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  return { status: res.status, ok: res.ok, json }
}

async function createAttribute(name, type) {
  const res = await call("POST", `/contacts/attributes/normal/${name}`, { type })
  if (res.ok) {
    console.log(`  ✓ Attribute ${name} — created`)
  } else if (res.status === 400 && JSON.stringify(res.json).includes("ATTRIBUTE_ALREADY_EXIST")) {
    console.log(`  ✓ Attribute ${name} — already exists`)
  } else {
    console.error(`  ✗ Attribute ${name} failed (${res.status}):`, JSON.stringify(res.json))
  }
}

async function getOrCreateFolder(name) {
  const res = await call("POST", "/contacts/folders", { name })
  if (res.ok) {
    console.log(`  ✓ Folder "${name}" — created (id: ${res.json.id})`)
    return res.json.id
  }
  // Fetch existing folders
  const listRes = await call("GET", "/contacts/folders?limit=50&offset=0")
  if (listRes.ok) {
    const existing = listRes.json.folders?.find(f => f.name === name)
    if (existing) {
      console.log(`  ✓ Folder "${name}" — already exists (id: ${existing.id})`)
      return existing.id
    }
  }
  console.error(`  ✗ Folder failed:`, res.json)
  return null
}

async function getOrCreateList(name, folderId) {
  const res = await call("POST", "/contacts/lists", { name, folderId })
  if (res.ok) {
    console.log(`  ✓ List "${name}" — created (id: ${res.json.id})`)
    return res.json.id
  }
  // Fetch existing lists
  const listRes = await call("GET", "/contacts/lists?limit=50&offset=0")
  if (listRes.ok) {
    const existing = listRes.json.lists?.find(l => l.name === name)
    if (existing) {
      console.log(`  ✓ List "${name}" — already exists (id: ${existing.id})`)
      return existing.id
    }
  }
  console.error(`  ✗ List "${name}" failed:`, res.json)
  return null
}

async function main() {
  console.log("\n🔧 Setting up Brevo for Clorefy drop-off emails\n")
  console.log(`Using API key: ...${API_KEY.slice(-8)}\n`)

  // Verify connection
  const me = await call("GET", "/account")
  if (!me.ok) {
    console.error("✗ API key rejected by Brevo:", me.json)
    process.exit(1)
  }
  console.log(`✓ Connected as: ${me.json.email}\n`)

  // 1. Attributes
  console.log("Creating contact attributes...")
  await createAttribute("ONBOARDING_COMPLETE", "boolean")
  await createAttribute("LAST_ACTIVE", "date")
  await createAttribute("SIGNUP_AT", "date")

  // 2. Folder
  console.log("\nCreating folder...")
  const folderId = await getOrCreateFolder("Clorefy")
  if (!folderId) {
    console.error("Cannot continue without a folder.")
    process.exit(1)
  }

  // 3. Lists
  console.log("\nCreating contact lists...")
  const onboardingListId = await getOrCreateList("Onboarding Started", folderId)
  const activeListId = await getOrCreateList("Active Users", folderId)

  // 4. Summary
  console.log("\n" + "═".repeat(55))
  console.log("✅ Done! Add these to your .env:\n")
  console.log(`BREVO_ONBOARDING_LIST_ID=${onboardingListId}`)
  console.log(`BREVO_ACTIVE_LIST_ID=${activeListId}`)
  console.log("═".repeat(55))
  console.log("\nNext: go to app.brevo.com → Automations and build the 2 workflows.")
}

main().catch(err => {
  console.error("Unexpected error:", err)
  process.exit(1)
})

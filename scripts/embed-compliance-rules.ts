/**
 * One-time embedding generation script for compliance_knowledge table.
 *
 * Reads all rows with NULL embeddings, generates vector embeddings via
 * OpenAI text-embedding-3-large (1536 dimensions), and writes them back.
 *
 * Usage: npx tsx scripts/embed-compliance-rules.ts
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { resolve } from "path"

// Load .env file manually (no dotenv dependency needed)
try {
  const envPath = resolve(process.cwd(), ".env")
  const envContent = readFileSync(envPath, "utf-8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
} catch {
  // .env file not found — rely on existing env vars
}

// ── Types ──────────────────────────────────────────────────────────────

interface ComplianceRow {
  id: string
  country: string
  document_type: string
  category: string
  requirement_key: string
  description: string | null
}

// ── Exported Helpers (used by property tests) ──────────────────────────

/**
 * Constructs the text representation used for embedding a compliance rule.
 * Format: "{country} {document_type} {category} {requirement_key}: {description}"
 *
 * Exported for property testing (Task 4.2, Property 1).
 */
export function buildEmbeddingText(row: ComplianceRow): string {
  const description = row.description ?? ""
  return `${row.country} ${row.document_type} ${row.category} ${row.requirement_key}: ${description}`
}

/**
 * Splits an array into batches of at most `batchSize` items.
 * Preserves order and completeness — concatenation of all batches
 * equals the original array.
 *
 * Exported for property testing (Task 4.3, Property 2).
 */
export function batchArray<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }
  return batches
}

// ── OpenAI Embedding Call ──────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-3-large"
const BATCH_SIZE = 100
const MAX_RETRIES = 3

/**
 * Calls the OpenAI embeddings API for a batch of texts.
 * Returns an array of 1536-dimensional vectors, one per input text.
 */
async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: 1536,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "unknown")
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} — ${errorBody}`
    )
  }

  const result = await response.json()
  // OpenAI returns embeddings sorted by index, but we sort explicitly to be safe
  const sorted = (result.data as { index: number; embedding: number[] }[])
    .sort((a, b) => a.index - b.index)
  return sorted.map((d) => d.embedding)
}

/**
 * Retries a batch embedding call up to MAX_RETRIES times with exponential backoff.
 * Backoff schedule: 1s, 2s, 4s.
 * Returns null if all retries fail.
 */
async function generateEmbeddingsWithRetry(
  texts: string[],
  apiKey: string,
  batchNumber: number
): Promise<number[][] | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await generateEmbeddings(texts, apiKey)
    } catch (error: any) {
      const backoffMs = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
      console.error(
        `Batch ${batchNumber} attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`
      )
      if (attempt < MAX_RETRIES) {
        console.log(`Retrying batch ${batchNumber} in ${backoffMs}ms...`)
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
      }
    }
  }
  console.error(`Batch ${batchNumber} failed after ${MAX_RETRIES} retries. Skipping.`)
  return null
}

// ── Main Script ────────────────────────────────────────────────────────

async function main() {
  console.log("=== Compliance Knowledge Embedding Script ===\n")

  // 1. Get API key directly from env (standalone script, not Next.js route)
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error("ERROR: OPENAI_API_KEY not found in environment or .env file.")
    process.exit(1)
  }

  // 2. Create Supabase service role client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.")
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // 3. Fetch rows with NULL embeddings
  console.log("Fetching rows with NULL embeddings...")
  const { data: rows, error: fetchError } = await supabase
    .from("compliance_knowledge")
    .select("id, country, document_type, category, requirement_key, description")
    .is("embedding", null)

  if (fetchError) {
    console.error("ERROR: Failed to fetch rows:", fetchError.message)
    process.exit(1)
  }

  if (!rows || rows.length === 0) {
    console.log("No rows with NULL embeddings found. Nothing to do.")
    return
  }

  console.log(`Found ${rows.length} rows to embed.\n`)

  // 4. Process in batches
  const batches = batchArray(rows as ComplianceRow[], BATCH_SIZE)
  let totalSucceeded = 0
  let totalFailed = 0

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const batchNumber = i + 1
    console.log(`Processing batch ${batchNumber}/${batches.length} (${batch.length} rows)...`)

    // Build text representations
    const texts = batch.map(buildEmbeddingText)

    // Generate embeddings with retry
    const embeddings = await generateEmbeddingsWithRetry(texts, apiKey, batchNumber)

    if (!embeddings) {
      totalFailed += batch.length
      continue
    }

    // Write embeddings back to the database
    let batchSucceeded = 0
    let batchFailed = 0

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j]
      const embedding = embeddings[j]

      const { error: updateError } = await supabase
        .from("compliance_knowledge")
        .update({ embedding: JSON.stringify(embedding) })
        .eq("id", row.id)

      if (updateError) {
        console.error(`  Failed to update row ${row.id}: ${updateError.message}`)
        batchFailed++
      } else {
        batchSucceeded++
      }
    }

    totalSucceeded += batchSucceeded
    totalFailed += batchFailed

    console.log(
      `  Batch ${batchNumber} complete: ${batchSucceeded} succeeded, ${batchFailed} failed.`
    )
  }

  // 5. Log completion summary
  console.log("\n=== Embedding Script Complete ===")
  console.log(`Total rows processed: ${rows.length}`)
  console.log(`Successfully embedded: ${totalSucceeded}`)
  console.log(`Failed: ${totalFailed}`)
}

// Only run main() when executed directly (not when imported by tests)
if (process.argv[1] && (process.argv[1].endsWith("embed-compliance-rules.ts") || process.argv[1].endsWith("embed-compliance-rules.js"))) {
  main().catch((error) => {
    console.error("Unhandled error:", error)
    process.exit(1)
  })
}

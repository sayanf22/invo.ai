#!/usr/bin/env node
/**
 * Backfill OpenAI embeddings for compliance_knowledge rows that have NULL embedding.
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL        (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 *
 * Usage:
 *   node scripts/backfill-compliance-embeddings.mjs
 *
 * Cost: 113 rows × ~300 tokens × $0.13/M = < $0.01 total.
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

// Load .env / .env.local if present (lightweight parser, no dotenv dep)
function loadEnvFile(filePath) {
    try {
        const content = readFileSync(filePath, "utf-8")
        for (const line of content.split("\n")) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith("#")) continue
            const eq = trimmed.indexOf("=")
            if (eq < 0) continue
            const key = trimmed.slice(0, eq).trim()
            let value = trimmed.slice(eq + 1).trim()
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1)
            }
            if (!process.env[key]) process.env[key] = value
        }
    } catch {}
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnvFile(path.join(__dirname, "..", ".env.local"))
loadEnvFile(path.join(__dirname, "..", ".env"))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE || !OPENAI_KEY) {
    console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY")
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
})

async function generateEmbedding(text) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "text-embedding-3-large",
            input: text,
            dimensions: 1536,
        }),
    })
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`OpenAI ${res.status}: ${body}`)
    }
    const json = await res.json()
    return json.data?.[0]?.embedding
}

function buildEmbeddingText(row) {
    // Rich text combining all searchable fields
    const parts = [
        `Country: ${row.country}`,
        `Document type: ${row.document_type}`,
        `Category: ${row.category}`,
        `Requirement: ${row.requirement_key}`,
        row.description || "",
        JSON.stringify(row.requirement_value),
    ]
    return parts.filter(Boolean).join(". ")
}

async function main() {
    console.log("Fetching rows without embeddings...")
    const { data: rows, error } = await supabase
        .from("compliance_knowledge")
        .select("id, country, document_type, category, requirement_key, requirement_value, description")
        .is("embedding", null)

    if (error) {
        console.error("Fetch error:", error)
        process.exit(1)
    }

    console.log(`Found ${rows.length} rows to embed.`)
    if (rows.length === 0) {
        console.log("All rows already embedded. Done.")
        return
    }

    let done = 0
    let failed = 0

    for (const row of rows) {
        try {
            const text = buildEmbeddingText(row)
            const embedding = await generateEmbedding(text)

            const { error: updateErr } = await supabase
                .from("compliance_knowledge")
                .update({ embedding: embedding })
                .eq("id", row.id)

            if (updateErr) {
                console.error(`Failed to update ${row.id}:`, updateErr.message)
                failed++
            } else {
                done++
                if (done % 10 === 0) console.log(`  Progress: ${done}/${rows.length}`)
            }

            // Gentle rate-limiting — OpenAI embeddings allow 3000 RPM, we do ~60/min
            await new Promise((resolve) => setTimeout(resolve, 50))
        } catch (err) {
            console.error(`Error for ${row.country}/${row.document_type}/${row.requirement_key}:`, err.message)
            failed++
        }
    }

    console.log(`\nDone. Embedded: ${done}, Failed: ${failed}`)
}

main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
})

/**
 * Symmetric encryption for sensitive user data (API keys, secrets).
 * Uses AES-256-GCM via Web Crypto API — edge-compatible (Cloudflare Workers).
 *
 * The encryption key is derived from CSRF_SECRET (already in .env).
 * Each value gets a unique random IV — same plaintext encrypts differently each time.
 *
 * SECURITY:
 * - AES-256-GCM provides both confidentiality and integrity (authenticated encryption)
 * - IV is prepended to the ciphertext (safe to store alongside it)
 * - Keys are never logged or returned to the client
 */

const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12 // 96 bits — recommended for GCM

/** Derive a CryptoKey from the app secret */
async function getDerivedKey(): Promise<CryptoKey> {
    // SECURITY: Only use server-side secrets — never fall back to public keys
    // ENCRYPTION_KEY is the preferred dedicated key
    // CSRF_SECRET is acceptable as a fallback (server-side only)
    // NEVER use NEXT_PUBLIC_* keys — they are exposed in the client bundle
    const secret = process.env.ENCRYPTION_KEY || process.env.CSRF_SECRET
    if (!secret) {
        throw new Error("No encryption key configured. Set ENCRYPTION_KEY in environment variables.")
    }

    const encoder = new TextEncoder()

    // Import raw key material
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    )

    // Derive AES-256-GCM key
    // Salt includes the app name to namespace keys across different apps using the same secret
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode("clorefy-payment-keys-v2"),
            iterations: 100_000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ["encrypt", "decrypt"]
    )
}

/**
 * Encrypt a plaintext string.
 * Returns base64-encoded "iv:ciphertext".
 */
export async function encrypt(plaintext: string): Promise<string> {
    const key = await getDerivedKey()
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const encoder = new TextEncoder()

    const ciphertext = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv },
        key,
        encoder.encode(plaintext)
    )

    // Encode as base64: iv + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), iv.length)

    return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt a base64-encoded "iv:ciphertext" string.
 * Returns the original plaintext, or null if decryption fails.
 */
export async function decrypt(encoded: string): Promise<string | null> {
    try {
        const key = await getDerivedKey()
        const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))

        const iv = combined.slice(0, IV_LENGTH)
        const ciphertext = combined.slice(IV_LENGTH)

        const plaintext = await crypto.subtle.decrypt(
            { name: ALGORITHM, iv },
            key,
            ciphertext
        )

        return new TextDecoder().decode(plaintext)
    } catch {
        return null
    }
}

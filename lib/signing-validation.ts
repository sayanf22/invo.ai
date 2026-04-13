/**
 * Signing endpoint validation helpers.
 * 
 * Extracted for testability — used by app/api/signatures/sign/route.ts
 * and property tests in lib/__tests__/signing.property.test.ts.
 */

/** Maximum decoded signature image size in bytes (500KB) */
export const MAX_DECODED_IMAGE_SIZE = 500 * 1024

/**
 * Validates a signing token format.
 * Must start with "sign_" and be ≤ 100 characters.
 */
export function isValidSigningToken(token: unknown): boolean {
    if (typeof token !== "string") return false
    return token.startsWith("sign_") && token.length <= 100
}

/**
 * Validates a signature data URL.
 * Must start with "data:image/" and the decoded image size must be ≤ 500KB.
 * 
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validateSignatureDataUrl(dataUrl: unknown): { valid: true } | { valid: false; reason: string } {
    if (typeof dataUrl !== "string") {
        return { valid: false, reason: "Signature data URL must be a string" }
    }

    if (!dataUrl.startsWith("data:image/")) {
        return { valid: false, reason: "Invalid signature image format. Must be a data:image URL." }
    }

    const commaIndex = dataUrl.indexOf(",")
    if (commaIndex === -1) {
        return { valid: false, reason: "Invalid signature data URL format" }
    }

    const base64Part = dataUrl.substring(commaIndex + 1)

    // Calculate decoded size from base64 length
    const padding = (base64Part.match(/=+$/) || [""])[0].length
    const decodedSize = Math.floor((base64Part.length * 3) / 4) - padding

    if (decodedSize > MAX_DECODED_IMAGE_SIZE) {
        return { valid: false, reason: "Signature image too large. Maximum 500KB allowed." }
    }

    return { valid: true }
}

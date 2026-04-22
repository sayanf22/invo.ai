/**
 * QR Code Generator — Server-side utility
 * Generates a QR code as a base64 PNG data URL for embedding in PDFs.
 * Uses the `qrcode` npm package (Node.js compatible).
 */

import QRCode from "qrcode"

/**
 * Generate a QR code as a base64 PNG data URL.
 * Returns null if generation fails (never throws).
 *
 * @param url - The URL to encode in the QR code
 * @param size - Size in pixels (default 200)
 */
export async function generateQRCodeDataUrl(url: string, size: number = 200): Promise<string | null> {
    if (!url || typeof url !== "string") return null
    try {
        const dataUrl = await QRCode.toDataURL(url, {
            width: size,
            margin: 1,
            color: {
                dark: "#000000",
                light: "#FFFFFF",
            },
            errorCorrectionLevel: "M", // Medium — good balance of size vs error recovery
        })
        return dataUrl
    } catch (err) {
        console.error("[qrcode] Failed to generate QR code:", err)
        return null
    }
}

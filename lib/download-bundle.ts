/**
 * Client-side asset bundling helpers.
 *
 * Downloads a set of files as a single ZIP so the owner can grab every asset
 * "all at once" instead of clicking each file individually. Uses fflate — a
 * tiny, dependency-free zipper that runs in the browser (no server memory or
 * Cloudflare Worker streaming concerns).
 */

import { zipSync, strToU8, type Zippable } from "fflate"

export interface BundleEntry {
    /** File name as it should appear inside the zip (will be de-duplicated). */
    name: string
    /** Raw bytes for this entry. */
    bytes: Uint8Array
}

/** Trigger a browser download for a Blob under the given filename. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Delay revocation so mobile Safari / iOS QuickLook can open the blob URL.
    setTimeout(() => URL.revokeObjectURL(url), 3000)
}

/**
 * Ensure every entry name is unique within the archive by appending " (n)"
 * before the extension on collisions (e.g. two files both named "logo.png").
 */
function dedupeNames(names: string[]): string[] {
    const seen = new Map<string, number>()
    return names.map((raw) => {
        const name = raw && raw.trim() ? raw.trim() : "file"
        const count = seen.get(name) ?? 0
        seen.set(name, count + 1)
        if (count === 0) return name
        const dot = name.lastIndexOf(".")
        return dot > 0
            ? `${name.slice(0, dot)} (${count})${name.slice(dot)}`
            : `${name} (${count})`
    })
}

/**
 * Zip the provided entries in-memory and download the archive. Returns the
 * number of entries written. Throws if there are no entries.
 */
export function downloadEntriesAsZip(entries: BundleEntry[], zipName: string): number {
    if (entries.length === 0) throw new Error("No files to download")
    const names = dedupeNames(entries.map((e) => e.name))
    const zippable: Zippable = {}
    entries.forEach((entry, i) => {
        // Store (level 0) — the assets (PDF/JPEG/PNG) are already compressed, so
        // re-deflating wastes CPU for no size gain.
        zippable[names[i]] = [entry.bytes, { level: 0 }]
    })
    const zipped = zipSync(zippable)
    // Copy into a fresh, exact-length ArrayBuffer so the Blob view is correct
    // even if fflate returned a larger backing buffer.
    triggerBlobDownload(new Blob([zipped.slice()], { type: "application/zip" }), zipName)
    return entries.length
}

/** Convenience: a text file entry for READMEs/manifests inside a bundle. */
export function textEntry(name: string, content: string): BundleEntry {
    return { name, bytes: strToU8(content) }
}

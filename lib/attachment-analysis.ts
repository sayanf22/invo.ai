/**
 * Client-side attachment analysis (Kimi vision).
 *
 * Kimi K2.5 via Bedrock Mantle accepts raster IMAGES only — it cannot read PDFs
 * natively. So this helper rasterizes the attachment to one or more PNG images
 * on the CLIENT (using pdf.js, already bundled via react-pdf) and sends those
 * images to `/api/ai/analyze-file`, which runs Kimi vision server-side.
 *
 * Design goals:
 *  - Images are sent directly (compressed if large).
 *  - PDFs are rendered page-by-page to PNG and sent as multiple images.
 *  - The raw file content is NEVER concatenated into the visible chat prompt.
 *    Callers receive a structured `summary`/`extracted`/`analysis` string and
 *    pass it as HIDDEN reference context to the generator.
 */

import { authFetch } from "@/lib/auth-fetch"

/** Max PDF pages to rasterize (keeps request size + Kimi cost bounded). */
const MAX_PDF_PAGES = 5
/** Render scale for PDF pages — 1.6 keeps text legible without huge payloads. */
const PDF_RENDER_SCALE = 1.6
/** Compress images larger than this (bytes) before upload. */
const IMAGE_COMPRESS_THRESHOLD = 1_000_000

export interface AnalyzeAttachmentResult {
    ok: boolean
    /** Structured, human-readable summary of the file (hidden reference context). */
    summary?: string
    /** Structured extracted fields (extract mode). */
    extracted?: Record<string, unknown>
    /** Full generated document (generate mode). */
    document?: Record<string, unknown>
    mode?: string
    /** Error message + HTTP status when ok === false. */
    error?: string
    status?: number
}

/** Read a File/Blob as a base64 data URL. */
function readAsDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error("Could not read file"))
        reader.readAsDataURL(file)
    })
}

/**
 * Convert an uploaded File into one or more image data URLs suitable for Kimi
 * vision. Images pass through (optionally compressed); PDFs are rasterized.
 * Throws on unsupported types or render failure so callers can fall back.
 */
export async function fileToImageDataUrls(file: File): Promise<string[]> {
    const type = file.type

    if (type.startsWith("image/")) {
        let toUpload: Blob = file
        if (file.size > IMAGE_COMPRESS_THRESHOLD) {
            try {
                const imageCompression = (await import("browser-image-compression")).default
                toUpload = await imageCompression(file, {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 2000,
                    useWebWorker: true,
                })
            } catch {
                toUpload = file
            }
        }
        return [await readAsDataUrl(toUpload)]
    }

    if (type === "application/pdf") {
        const buf = await file.arrayBuffer()
        const pdfjsLib = await import("pdfjs-dist")
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
        }
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) })
        const pdfDoc = await loadingTask.promise
        const pageCount = Math.min(pdfDoc.numPages, MAX_PDF_PAGES)
        const images: string[] = []
        for (let p = 1; p <= pageCount; p++) {
            const page = await pdfDoc.getPage(p)
            const viewport = page.getViewport({ scale: PDF_RENDER_SCALE })
            const canvas = document.createElement("canvas")
            canvas.width = viewport.width
            canvas.height = viewport.height
            const ctx = canvas.getContext("2d")
            if (!ctx) throw new Error("Could not get canvas context")
            ctx.fillStyle = "#FFFFFF"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await page.render({ canvasContext: ctx, viewport } as any).promise
            // JPEG keeps the payload small for multi-page documents.
            images.push(canvas.toDataURL("image/jpeg", 0.85))
        }
        if (images.length === 0) throw new Error("PDF has no renderable pages")
        return images
    }

    throw new Error("Unsupported file type. Attach an image or PDF.")
}

/**
 * Analyze an attachment with Kimi vision and return structured context.
 *
 * @param opts.mode  "extract" (default) → structured business fields;
 *                   "generate" → a full document JSON built from the file.
 */
export async function analyzeAttachment(opts: {
    file: File
    message?: string
    mode?: "extract" | "generate"
    documentType?: string
    businessContext?: string
}): Promise<AnalyzeAttachmentResult> {
    let images: string[]
    try {
        images = await fileToImageDataUrls(opts.file)
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Could not read the file", status: 0 }
    }

    try {
        const res = await authFetch("/api/ai/analyze-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                images,
                fileName: opts.file.name,
                message: opts.message || "",
                mode: opts.mode || "extract",
                documentType: opts.documentType || "",
                businessContext: opts.businessContext || "",
            }),
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            return { ok: false, error: data?.error || "Failed to analyze the file", status: res.status }
        }
        return {
            ok: true,
            summary: data.summary || "",
            extracted: data.extracted,
            document: data.document,
            mode: data.mode,
        }
    } catch {
        return { ok: false, error: "Network error while analyzing the file", status: 0 }
    }
}

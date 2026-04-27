"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Eraser, Check, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SignaturePadProps {
    onSignature: (dataUrl: string) => void
    className?: string
}

/**
 * Crop a canvas to the bounding box of non-white pixels and return a
 * compact JPEG data URL. Keeps the image tiny (typically 3–15 KB).
 *
 * Strategy used by DocuSign / HelloSign:
 * 1. Find the tight bounding box of actual ink strokes
 * 2. Add a small padding
 * 3. Export as JPEG at 0.75 quality (signatures are black-on-white — JPEG is fine)
 * 4. Cap the output at 300×100 logical pixels
 */
function exportCompactSignature(canvas: HTMLCanvasElement): string {
    const ctx = canvas.getContext("2d")
    if (!ctx) return canvas.toDataURL("image/jpeg", 0.75)

    const w = canvas.width
    const h = canvas.height
    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data

    let minX = w, minY = h, maxX = 0, maxY = 0
    let hasInk = false

    // Find bounding box of non-white pixels
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4
            const r = data[idx], g = data[idx + 1], b = data[idx + 2]
            // Consider a pixel "ink" if it's not near-white
            if (r < 240 || g < 240 || b < 240) {
                if (x < minX) minX = x
                if (x > maxX) maxX = x
                if (y < minY) minY = y
                if (y > maxY) maxY = y
                hasInk = true
            }
        }
    }

    if (!hasInk) return canvas.toDataURL("image/jpeg", 0.75)

    // Add padding (8px each side)
    const pad = 8
    minX = Math.max(0, minX - pad)
    minY = Math.max(0, minY - pad)
    maxX = Math.min(w - 1, maxX + pad)
    maxY = Math.min(h - 1, maxY + pad)

    const cropW = maxX - minX + 1
    const cropH = maxY - minY + 1

    // Create a small output canvas — cap at 320×120 logical pixels
    const MAX_W = 320
    const MAX_H = 120
    const scale = Math.min(1, MAX_W / cropW, MAX_H / cropH)
    const outW = Math.round(cropW * scale)
    const outH = Math.round(cropH * scale)

    const out = document.createElement("canvas")
    out.width = outW
    out.height = outH
    const outCtx = out.getContext("2d")
    if (!outCtx) return canvas.toDataURL("image/jpeg", 0.75)

    // White background
    outCtx.fillStyle = "#ffffff"
    outCtx.fillRect(0, 0, outW, outH)

    // Draw cropped + scaled region
    outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, outW, outH)

    // JPEG at 0.75 quality — signatures are black-on-white, JPEG works great
    return out.toDataURL("image/jpeg", 0.75)
}

export function SignaturePad({ onSignature, className }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasSignature, setHasSignature] = useState(false)
    const [history, setHistory] = useState<ImageData[]>([])

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * window.devicePixelRatio
        canvas.height = rect.height * window.devicePixelRatio
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

        ctx.strokeStyle = "#0f172a"
        ctx.lineWidth = 2.5
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, rect.width, rect.height)
    }, [])

    const getCoordinates = useCallback(
        (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
            const canvas = canvasRef.current
            if (!canvas) return null
            const rect = canvas.getBoundingClientRect()
            let clientX: number, clientY: number
            if ("touches" in e) {
                if (e.touches.length === 0) return null
                clientX = e.touches[0].clientX
                clientY = e.touches[0].clientY
            } else {
                clientX = e.clientX
                clientY = e.clientY
            }
            return { x: clientX - rect.left, y: clientY - rect.top }
        },
        []
    )

    const startDrawing = useCallback(
        (e: React.MouseEvent | React.TouchEvent) => {
            const canvas = canvasRef.current
            const ctx = canvas?.getContext("2d")
            const coords = getCoordinates(e)
            if (!ctx || !coords || !canvas) return
            const rect = canvas.getBoundingClientRect()
            const imageData = ctx.getImageData(0, 0, rect.width, rect.height)
            setHistory(prev => [...prev.slice(-10), imageData])
            ctx.beginPath()
            ctx.moveTo(coords.x, coords.y)
            setIsDrawing(true)
        },
        [getCoordinates]
    )

    const draw = useCallback(
        (e: React.MouseEvent | React.TouchEvent) => {
            if (!isDrawing) return
            const ctx = canvasRef.current?.getContext("2d")
            const coords = getCoordinates(e)
            if (!ctx || !coords) return
            ctx.lineTo(coords.x, coords.y)
            ctx.stroke()
            setHasSignature(true)
        },
        [isDrawing, getCoordinates]
    )

    const stopDrawing = useCallback(() => setIsDrawing(false), [])

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return
        const rect = canvas.getBoundingClientRect()
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, rect.width, rect.height)
        setHasSignature(false)
        setHistory([])
    }, [])

    const undo = useCallback(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!ctx || history.length === 0) return
        ctx.putImageData(history[history.length - 1], 0, 0)
        setHistory(prev => prev.slice(0, -1))
        if (history.length <= 1) setHasSignature(false)
    }, [history])

    const confirmSignature = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas || !hasSignature) return
        // Export as compact JPEG — typically 3–15 KB
        const dataUrl = exportCompactSignature(canvas)
        onSignature(dataUrl)
    }, [hasSignature, onSignature])

    return (
        <div className={cn("space-y-3", className)}>
            <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-white">
                <canvas
                    ref={canvasRef}
                    className="w-full h-[180px] cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-muted-foreground/40 text-sm">Sign here</p>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={clearCanvas} disabled={!hasSignature}>
                        <Eraser className="h-4 w-4 mr-1" />
                        Clear
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={undo} disabled={history.length === 0}>
                        <Undo2 className="h-4 w-4 mr-1" />
                        Undo
                    </Button>
                </div>
                <Button type="button" onClick={confirmSignature} disabled={!hasSignature} size="sm">
                    <Check className="h-4 w-4 mr-1" />
                    Confirm Signature
                </Button>
            </div>
        </div>
    )
}

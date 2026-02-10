"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Eraser, Check, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SignaturePadProps {
    onSignature: (dataUrl: string) => void
    className?: string
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

        // Set canvas size
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * window.devicePixelRatio
        canvas.height = rect.height * window.devicePixelRatio
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

        // Set drawing styles
        ctx.strokeStyle = "#0f172a"
        ctx.lineWidth = 2.5
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        // Fill with white background
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

            return {
                x: clientX - rect.left,
                y: clientY - rect.top,
            }
        },
        []
    )

    const startDrawing = useCallback(
        (e: React.MouseEvent | React.TouchEvent) => {
            const canvas = canvasRef.current
            const ctx = canvas?.getContext("2d")
            const coords = getCoordinates(e)
            if (!ctx || !coords || !canvas) return

            // Save state for undo
            const rect = canvas.getBoundingClientRect()
            const imageData = ctx.getImageData(0, 0, rect.width, rect.height)
            setHistory((prev) => [...prev.slice(-10), imageData])

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

    const stopDrawing = useCallback(() => {
        setIsDrawing(false)
    }, [])

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

        const lastState = history[history.length - 1]
        ctx.putImageData(lastState, 0, 0)
        setHistory((prev) => prev.slice(0, -1))

        if (history.length <= 1) {
            setHasSignature(false)
        }
    }, [history])

    const confirmSignature = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas || !hasSignature) return

        // Get the signature as a data URL
        const dataUrl = canvas.toDataURL("image/png")
        onSignature(dataUrl)
    }, [hasSignature, onSignature])

    return (
        <div className={cn("space-y-3", className)}>
            <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-white">
                <canvas
                    ref={canvasRef}
                    className="w-full h-[200px] cursor-crosshair touch-none"
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
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearCanvas}
                        disabled={!hasSignature}
                    >
                        <Eraser className="h-4 w-4 mr-1" />
                        Clear
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={undo}
                        disabled={history.length === 0}
                    >
                        <Undo2 className="h-4 w-4 mr-1" />
                        Undo
                    </Button>
                </div>

                <Button
                    type="button"
                    onClick={confirmSignature}
                    disabled={!hasSignature}
                    size="sm"
                >
                    <Check className="h-4 w-4 mr-1" />
                    Confirm Signature
                </Button>
            </div>
        </div>
    )
}

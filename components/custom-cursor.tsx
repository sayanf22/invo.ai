"use client"

import { useEffect, useState } from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"

export function CustomCursor() {
    const cursorX = useMotionValue(-100)
    const cursorY = useMotionValue(-100)

    // Smoother spring configuration
    const springConfig = { damping: 20, stiffness: 400, mass: 0.5 }
    const cursorXSpring = useSpring(cursorX, springConfig)
    const cursorYSpring = useSpring(cursorY, springConfig)

    const [isHovering, setIsHovering] = useState(false)
    const [isVisible, setIsVisible] = useState(false)
    const [isClicking, setIsClicking] = useState(false)

    useEffect(() => {
        const moveCursor = (e: MouseEvent) => {
            cursorX.set(e.clientX)
            cursorY.set(e.clientY)
            if (!isVisible) setIsVisible(true)
        }

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            // Expanded interactive elements check
            if (
                target.tagName === 'BUTTON' ||
                target.tagName === 'A' ||
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.closest('button') ||
                target.closest('a') ||
                target.closest('[role="button"]') ||
                target.classList.contains('cursor-pointer')
            ) {
                setIsHovering(true)
            } else {
                setIsHovering(false)
            }
        }

        const handleMouseDown = () => setIsClicking(true)
        const handleMouseUp = () => setIsClicking(false)
        const handleMouseLeave = () => setIsVisible(false)
        const handleMouseEnter = () => setIsVisible(true)

        window.addEventListener("mousemove", moveCursor, { passive: true })
        window.addEventListener("mouseover", handleMouseOver, { passive: true })
        window.addEventListener("mousedown", handleMouseDown)
        window.addEventListener("mouseup", handleMouseUp)
        document.body.addEventListener("mouseleave", handleMouseLeave)
        document.body.addEventListener("mouseenter", handleMouseEnter)

        return () => {
            window.removeEventListener("mousemove", moveCursor)
            window.removeEventListener("mouseover", handleMouseOver)
            window.removeEventListener("mousedown", handleMouseDown)
            window.removeEventListener("mouseup", handleMouseUp)
            document.body.removeEventListener("mouseleave", handleMouseLeave)
            document.body.removeEventListener("mouseenter", handleMouseEnter)
        }
    }, [cursorX, cursorY, isVisible])

    // Increased visibility: Orange dot with border ring, no blend mode issues
    return (
        <motion.div
            className="fixed top-0 left-0 pointer-events-none z-[9999] flex items-center justify-center"
            style={{
                translateX: cursorXSpring,
                translateY: cursorYSpring,
                x: "-50%",
                y: "-50%",
                opacity: isVisible ? 1 : 0,
            }}
        >
            {/* Main Dot */}
            <motion.div
                className="bg-[var(--landing-amber)] rounded-full"
                animate={{
                    width: isHovering ? 8 : 12,
                    height: isHovering ? 8 : 12,
                }}
            />

            {/* Outer Ring */}
            <motion.div
                className="absolute border border-[var(--landing-text-dark)] rounded-full opacity-40"
                animate={{
                    width: isHovering ? 48 : 24,
                    height: isHovering ? 48 : 24,
                    scale: isClicking ? 0.8 : 1,
                    borderColor: isHovering ? "var(--landing-amber)" : "var(--landing-text-dark)"
                }}
                transition={{ duration: 0.15 }}
            />
        </motion.div>
    )
}

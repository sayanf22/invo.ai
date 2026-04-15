"use client"

import { useEffect } from "react"
import { LandingNavbar } from "./landing-navbar"
import { LandingFooter } from "./landing-footer"
import { DownloadModalProvider } from "./download-modal"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import { SmoothScroller } from "@/components/smooth-scroller"

const pageVariants = {
    initial: { opacity: 0, y: 20 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }
}

export function LandingLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    return (
        <DownloadModalProvider>
            <SmoothScroller>
                <div className="min-h-screen bg-[var(--landing-cream)] text-[var(--landing-text-dark)] font-sans antialiased selection:bg-[var(--landing-amber)] selection:text-white">
                    <LandingNavbar />
                    <AnimatePresence mode="wait">
                        <motion.main
                            key={pathname}
                            variants={pageVariants}
                            initial="initial"
                            animate="enter"
                            exit="exit"
                            className="flex-1 pt-24"
                        >
                            {children}
                        </motion.main>
                    </AnimatePresence>
                    <LandingFooter />
                </div>
            </SmoothScroller>
        </DownloadModalProvider>
    )
}

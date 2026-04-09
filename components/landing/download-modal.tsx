"use client"

import Link from "next/link"
import { createContext, useContext, useState, ReactNode } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { motion, AnimatePresence } from "framer-motion"
import { X, Apple, Monitor, Smartphone, Check } from "lucide-react"

interface DownloadModalContextType {
    isOpen: boolean
    openModal: () => void
    closeModal: () => void
}

const DownloadModalContext = createContext<DownloadModalContextType | undefined>(undefined)

export function useDownloadModal() {
    const context = useContext(DownloadModalContext)
    if (!context) {
        throw new Error("useDownloadModal must be used within a DownloadModalProvider")
    }
    return context
}

export function DownloadModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)

    const openModal = () => setIsOpen(true)
    const closeModal = () => setIsOpen(false)

    return (
        <DownloadModalContext.Provider value={{ isOpen, openModal, closeModal }}>
            {children}
            <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
                <AnimatePresence>
                    {isOpen && (
                        <Dialog.Portal forceMount>
                            <Dialog.Overlay asChild>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                                />
                            </Dialog.Overlay>
                            <Dialog.Content asChild>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    transition={{ type: "spring", duration: 0.5 }}
                                    className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-[2.5rem] bg-white p-8 shadow-2xl focus:outline-none"
                                >
                                    <div className="flex items-center justify-between mb-8">
                                        <Dialog.Title className="text-2xl font-display font-medium text-[var(--landing-text-dark)]">
                                            Get Clorefy Flow
                                        </Dialog.Title>
                                        <Dialog.Close className="p-2 rounded-full hover:bg-stone-100 transition-colors">
                                            <X size={20} />
                                        </Dialog.Close>
                                    </div>

                                    <div className="space-y-4">
                                        <button className="w-full group flex items-center justify-between p-4 rounded-2xl border-2 border-[var(--landing-text-dark)] bg-[var(--landing-text-dark)] text-white hover:bg-[var(--landing-text-dark)]/90 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                                    <Apple size={20} />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-bold">Download for Mac</div>
                                                    <div className="text-xs text-white/60">Apple Silicon & Intel</div>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-white text-[var(--landing-text-dark)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                                                <Check size={16} />
                                            </div>
                                        </button>

                                        <button className="w-full group flex items-center justify-between p-4 rounded-2xl border border-stone-200 hover:border-[var(--landing-amber)] hover:bg-[var(--landing-amber)]/5 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-[var(--landing-amber)]/10 group-hover:text-[var(--landing-amber)] transition-colors">
                                                    <Monitor size={20} />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-bold text-[var(--landing-text-dark)]">Windows</div>
                                                    <div className="text-xs text-[var(--landing-text-muted)]">Waitlist</div>
                                                </div>
                                            </div>
                                        </button>

                                        <button className="w-full group flex items-center justify-between p-4 rounded-2xl border border-stone-200 hover:border-[var(--landing-amber)] hover:bg-[var(--landing-amber)]/5 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-[var(--landing-amber)]/10 group-hover:text-[var(--landing-amber)] transition-colors">
                                                    <Smartphone size={20} />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-bold text-[var(--landing-text-dark)]">iOS & Android</div>
                                                    <div className="text-xs text-[var(--landing-text-muted)]">Waitlist</div>
                                                </div>
                                            </div>
                                        </button>
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-stone-100 text-center">
                                        <p className="text-sm text-[var(--landing-text-muted)]">
                                            By downloading, you agree to our <Link href="/terms" className="underline hover:text-[var(--landing-dark)]">Terms</Link> and <Link href="/privacy" className="underline hover:text-[var(--landing-dark)]">Privacy Policy</Link>.
                                        </p>
                                    </div>
                                </motion.div>
                            </Dialog.Content>
                        </Dialog.Portal>
                    )}
                </AnimatePresence>
            </Dialog.Root>
        </DownloadModalContext.Provider>
    )
}

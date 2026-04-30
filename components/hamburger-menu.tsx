"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon"
import {
    User, Settings, FileText, HelpCircle, Shield, Info, LogOut,
    Home, FileCheck, History, Bell, CreditCard, Lock, Mail, BookOpen, ChevronRight, Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

export function HamburgerMenu() {
    const { user, supabase, isLoading } = useAuth()
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [visibleOpen, setVisibleOpen] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const [buttonRect, setButtonRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const handleOpen = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setButtonRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
        }
        setIsOpen(true)
        requestAnimationFrame(() => requestAnimationFrame(() => setVisibleOpen(true)))
    }, [])

    const handleClose = useCallback(() => {
        setVisibleOpen(false)
        setTimeout(() => setIsOpen(false), 350)
    }, [])

    const toggle = useCallback(() => {
        if (isOpen) handleClose(); else handleOpen()
    }, [isOpen, handleOpen, handleClose])

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape" && isOpen) handleClose() }
        document.addEventListener("keydown", handleEscape)
        return () => document.removeEventListener("keydown", handleEscape)
    }, [isOpen, handleClose])

    const handleSignOut = async () => {
        handleClose()
        await supabase.auth.signOut()
        router.push("/auth/login")
        router.refresh()
    }

    const navigate = (path: string) => {
        handleClose()
        setTimeout(() => router.push(path), 360)
    }

    const email = user?.email || ""
    const fullName = user?.user_metadata?.full_name || ""
    const initials = fullName
        ? fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
        : email.charAt(0).toUpperCase()

    useEffect(() => {
        // Don't lock body scroll — scrollbars are hidden globally so no layout shift occurs
        // Just prevent touch scroll on mobile when menu is open
        if (isOpen) {
            document.body.style.touchAction = "none"
        } else {
            document.body.style.touchAction = ""
        }
        return () => { document.body.style.touchAction = "" }
    }, [isOpen])

    return (
        <div className="relative">
            {/* Toggle button — NEVER moves, always in its original position. Hidden when portal is open so the clone can take over */}
            <button
                ref={buttonRef}
                type="button"
                onClick={toggle}
                className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200 shrink-0",
                    isOpen ? "opacity-0 pointer-events-none" : "hover:bg-secondary/50 opacity-100"
                )}
                aria-expanded={isOpen}
                aria-label={isOpen ? "Close menu" : "Open menu"}
            >
                <MenuToggleIcon open={false} className="w-9 h-9" strokeWidth={3} duration={350} />
            </button>

            {/* Render Overlay and Panel in a Portal to escape stacking contexts (e.g. backdrop-filter) */}
            {mounted && createPortal(
                <div className="hamburger-menu-portal">
                    {/* Cloned toggle button that sits ABOVE the overlay */}
                    {isOpen && buttonRect && (
                        <button
                            type="button"
                            onClick={handleClose}
                            className="fixed flex items-center justify-center rounded-xl hover:bg-secondary/50 transition-colors duration-200 shrink-0 z-[120]"
                            style={{
                                top: buttonRect.top,
                                left: buttonRect.left,
                                width: buttonRect.width,
                                height: buttonRect.height,
                            }}
                            aria-label="Close menu"
                        >
                            <MenuToggleIcon open={visibleOpen} className="w-9 h-9" strokeWidth={3} duration={350} />
                        </button>
                    )}
                    {/* Overlay */}
                    <div
                        className={cn(
                            "fixed inset-0 z-[100] transition-opacity duration-300",
                            isOpen ? "pointer-events-auto" : "pointer-events-none",
                            visibleOpen ? "opacity-100" : "opacity-0"
                        )}
                        style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(3px)" }}
                        onClick={handleClose}
                    />

                    {/* Panel */}
                    <div
                        className={cn(
                            "fixed top-0 right-0 h-full w-[380px] max-w-[calc(100vw-16px)] z-[110] flex flex-col",
                            "transition-transform ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
                            visibleOpen ? "translate-x-0" : "translate-x-full",
                            !isOpen && !visibleOpen && "invisible"
                        )}
                        style={{
                            transitionDuration: "350ms",
                            backgroundColor: "#FBF7F0",
                            borderRadius: "20px 0 0 20px",
                            boxShadow: "-16px 0 48px -8px rgba(0,0,0,0.14), -2px 0 8px -2px rgba(0,0,0,0.06)",
                            borderLeft: "1px solid hsl(var(--border)/0.5)",
                        }}
                    >
                        {/* User header */}
                        {user ? (
                            <div className="px-6 pt-6 pb-5 shrink-0 border-b border-border/50">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-primary/10 shrink-0"
                                        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                                    >
                                        <span className="text-sm font-bold text-primary">{initials}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">{fullName || "User"}</p>
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">{email}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-4 shrink-0" />
                        )}

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-5 space-y-5">

                            <MenuSection label="Navigation">
                                <MenuItem icon={Home} label="Home" onClick={() => navigate("/")} />
                                {user && <>
                                    <MenuItem icon={FileText} label="My Documents" onClick={() => navigate("/documents")} divider />
                                    <MenuItem icon={Users} label="Clients" onClick={() => navigate("/clients")} divider />
                                    <MenuItem icon={History} label="History" onClick={() => navigate("/history")} divider />
                                </>}
                            </MenuSection>

                            {user && (
                                <MenuSection label="Account">
                                    <MenuItem icon={User} label="Business Profile" onClick={() => navigate("/profile")} />
                                    <MenuItem icon={Settings} label="Settings" onClick={() => navigate("/settings")} divider />
                                    <MenuItem icon={Bell} label="Notifications" onClick={() => navigate("/notifications")} divider />
                                    <MenuItem icon={CreditCard} label="Billing & Plans" onClick={() => navigate("/billing")} divider />
                                </MenuSection>
                            )}

                            <MenuSection label="Support & Legal">
                                <MenuItem icon={HelpCircle} label="Support Center" onClick={() => navigate("/support")} />
                                <MenuItem icon={BookOpen} label="Blog" onClick={() => navigate("/blog")} divider />
                                <MenuItem icon={Mail} label="Contact Us" onClick={() => navigate("/contact")} divider />
                                <MenuItem icon={Info} label="About Us" onClick={() => navigate("/about")} divider />
                                <MenuItem icon={Shield} label="Privacy Policy" onClick={() => navigate("/privacy")} divider />
                                <MenuItem icon={FileCheck} label="Terms & Conditions" onClick={() => navigate("/terms")} divider />
                                <MenuItem icon={Lock} label="Refund Policy" onClick={() => navigate("/refund-policy")} divider />
                            </MenuSection>

                            {user && (
                                <MenuSection>
                                    <MenuItem icon={LogOut} label="Sign Out" onClick={handleSignOut} variant="danger" />
                                </MenuSection>
                            )}

                            {!user && !isLoading && (
                                <button onClick={() => navigate("/auth/login")}
                                    className="w-full py-3.5 rounded-2xl font-semibold text-sm bg-primary text-primary-foreground transition-all active:scale-[0.98] hover:opacity-90"
                                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                                >
                                    Sign In
                                </button>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 py-3 px-6 border-t border-border/50">
                            <p className="text-[11px] text-center text-muted-foreground/50">Clorefy © 2026 · v1.0.0</p>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}

function MenuSection({ label, children }: { label?: string; children: React.ReactNode }) {
    return (
        <div>
            {label && (
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-1 mb-2">{label}</p>
            )}
            <div className="rounded-2xl overflow-hidden bg-card border border-border/50 shadow-sm"
                style={{
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px -4px rgba(0,0,0,0.07)",
                }}
            >
                {children}
            </div>
        </div>
    )
}

interface MenuItemProps {
    icon: React.ElementType
    label: string
    onClick: () => void
    variant?: "default" | "danger"
    divider?: boolean
}

function MenuItem({ icon: Icon, label, onClick, variant = "default", divider = false }: MenuItemProps) {
    return (
        <>
            {divider && (
                <div className="mx-4 h-px bg-border/50" />
            )}
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    "flex items-center gap-3.5 w-full px-4 py-3.5 text-sm font-medium transition-all duration-150 active:bg-secondary/60 bg-card",
                    variant === "default" ? "text-foreground hover:bg-secondary/40" : "text-destructive hover:bg-destructive/5"
                )}
            >
                <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                    variant === "default" ? "bg-secondary/70" : "bg-destructive/8"
                )}>
                    <Icon className={cn(
                        "w-[17px] h-[17px]",
                        variant === "default" ? "text-foreground/60" : "text-destructive"
                    )} strokeWidth={1.5} />
                </div>
                <span className="flex-1 text-left">{label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
            </button>
        </>
    )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon"
import {
    User, Settings, FileText, HelpCircle, Shield, Info, LogOut,
    Home, FileCheck, History, Bell, CreditCard, Lock, Mail, BookOpen, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

export function HamburgerMenu() {
    const { user, supabase, isLoading } = useAuth()
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [visibleOpen, setVisibleOpen] = useState(false)

    const handleOpen = useCallback(() => {
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
    const avatarUrl = user?.user_metadata?.avatar_url || ""

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : ""
        return () => { document.body.style.overflow = "" }
    }, [isOpen])

    return (
        <div className="relative">
            <button
                type="button"
                onClick={toggle}
                className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-xl hover:bg-secondary/50 transition-colors duration-200 shrink-0",
                    isOpen && "fixed top-3 right-4 z-[60]"
                )}
                aria-expanded={isOpen}
                aria-label={isOpen ? "Close menu" : "Open menu"}
            >
                <MenuToggleIcon open={visibleOpen} className="w-9 h-9" strokeWidth={3} duration={350} />
            </button>

            {/* Overlay */}
            <div
                className={cn(
                    "fixed inset-0 z-40 transition-opacity duration-300",
                    isOpen ? "pointer-events-auto" : "pointer-events-none",
                    visibleOpen ? "opacity-100" : "opacity-0"
                )}
                style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(3px)" }}
                onClick={handleClose}
            />

            {/* Panel */}
            <div
                className={cn(
                    "fixed top-0 right-0 h-full w-[380px] max-w-[calc(100vw-16px)] z-50 flex flex-col",
                    "transition-transform ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
                    visibleOpen ? "translate-x-0" : "translate-x-full",
                    !isOpen && !visibleOpen && "invisible"
                )}
                style={{
                    transitionDuration: "350ms",
                    background: "hsl(36 33% 97%)",
                    borderRadius: "20px 0 0 20px",
                    boxShadow: "-16px 0 48px -8px rgba(0,0,0,0.14), -2px 0 8px -2px rgba(0,0,0,0.06)",
                    borderLeft: "1px solid hsl(36 20% 90%)",
                }}
            >
                {/* User header */}
                {user ? (
                    <div className="px-6 pt-14 pb-5 shrink-0" style={{ borderBottom: "1px solid hsl(36 20% 90%)" }}>
                        <div className="flex items-center gap-3.5">
                            {avatarUrl ? (
                                <Image src={avatarUrl} alt={fullName || email} width={44} height={44}
                                    className="w-11 h-11 rounded-2xl object-cover"
                                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
                                />
                            ) : (
                                <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-primary/10"
                                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                                >
                                    <span className="text-sm font-bold text-primary">{initials}</span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{fullName || "User"}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{email}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-16 shrink-0" />
                )}

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-5 space-y-5">

                    <MenuSection label="Navigation">
                        <MenuItem icon={Home} label="Home" onClick={() => navigate("/")} />
                        {user && <>
                            <MenuItem icon={FileText} label="My Documents" onClick={() => navigate("/documents")} divider />
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
                        <MenuItem icon={HelpCircle} label="Help Center" onClick={() => navigate("/contact")} />
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
                <div className="shrink-0 py-3 px-6" style={{ borderTop: "1px solid hsl(36 20% 90%)" }}>
                    <p className="text-[11px] text-center text-muted-foreground/50">Clorefy © 2026 · v1.0.0</p>
                </div>
            </div>
        </div>
    )
}

function MenuSection({ label, children }: { label?: string; children: React.ReactNode }) {
    return (
        <div>
            {label && (
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-1 mb-2">{label}</p>
            )}
            <div className="rounded-2xl overflow-hidden bg-card"
                style={{
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px -4px rgba(0,0,0,0.07)",
                    border: "1px solid hsl(36 20% 90%)",
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
                <div className="mx-4" style={{ height: "1px", background: "hsl(36 20% 90%)" }} />
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

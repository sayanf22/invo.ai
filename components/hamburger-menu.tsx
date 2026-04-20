"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon"
import {
    User,
    Settings,
    FileText,
    HelpCircle,
    Shield,
    Info,
    LogOut,
    Home,
    FileCheck,
    History,
    Bell,
    CreditCard,
    Lock,
    Mail,
    BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

export function HamburgerMenu() {
    const { user, supabase, isLoading } = useAuth()
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    // visibleOpen controls the MenuToggleIcon's `open` prop.
    // It is set to true AFTER the panel has started sliding in (so the morph animates),
    // and set to false BEFORE the panel starts sliding out (so the reverse morph animates).
    const [visibleOpen, setVisibleOpen] = useState(false)

    const handleOpen = useCallback(() => {
        setIsOpen(true)
        // Let the browser paint the panel at translate-x-full first,
        // then on the next frame trigger the slide-in + icon morph together
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setVisibleOpen(true)
            })
        })
    }, [])

    const handleClose = useCallback(() => {
        // Start icon morph and panel slide-out together
        setVisibleOpen(false)
        // Wait for the slide-out animation to finish before unmounting overlay
        setTimeout(() => {
            setIsOpen(false)
        }, 350)
    }, [])

    const toggle = useCallback(() => {
        if (isOpen) handleClose()
        else handleOpen()
    }, [isOpen, handleOpen, handleClose])

    // Close on escape key
    useEffect(() => {
        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape" && isOpen) handleClose()
        }
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
        // Delay navigation until close animation finishes to prevent race conditions
        setTimeout(() => {
            router.push(path)
        }, 360)
    }

    // Get user info
    const email = user?.email || ""
    const fullName = user?.user_metadata?.full_name || ""
    const initials = fullName
        ? fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
        : email.charAt(0).toUpperCase()
    const avatarUrl = user?.user_metadata?.avatar_url || ""

    // Lock body scroll when menu is open (keep locked during close animation)
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        }
        if (!isOpen && !visibleOpen) {
            document.body.style.overflow = ""
        }
        return () => { document.body.style.overflow = "" }
    }, [isOpen, visibleOpen])

    return (
        <div className="relative">
            {/*
              SINGLE animated toggle button — always fixed at top-right of viewport.
              z-[60] so it floats above the panel (z-50) and overlay (z-40).
              Same component instance means the `visibleOpen` prop transition
              drives the SVG morph animation in both directions.
            */}
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
                <MenuToggleIcon
                    open={visibleOpen}
                    className="w-9 h-9"
                    strokeWidth={3}
                    duration={350}
                />
            </button>

            {/* Overlay */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300",
                    isOpen ? "pointer-events-auto" : "pointer-events-none",
                    visibleOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={handleClose}
            />

            {/* Slide-out menu panel */}
            <div
                className={cn(
                    "fixed top-0 right-0 h-full w-[340px] max-w-[calc(100vw-16px)] z-50 flex flex-col",
                    "transition-transform ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
                    visibleOpen ? "translate-x-0" : "translate-x-full",
                    !isOpen && !visibleOpen && "invisible"
                )}
                style={{
                    transitionDuration: "350ms",
                    background: "var(--background)",
                    borderLeft: "1px solid rgba(0,0,0,0.06)",
                    borderRadius: "20px 0 0 20px",
                    boxShadow: "-12px 0 40px -8px rgba(0,0,0,0.18), -2px 0 8px -2px rgba(0,0,0,0.08)",
                }}
            >
                {/* Header with user info */}
                {user && (
                    <div className="px-5 pt-6 pb-5 shrink-0"
                        style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
                    >
                        <div className="flex items-center gap-3.5 pr-12">
                            {avatarUrl ? (
                                <Image
                                    src={avatarUrl}
                                    alt={fullName || email}
                                    width={48}
                                    height={48}
                                    className="w-12 h-12 rounded-2xl object-cover"
                                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center"
                                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                                >
                                    <span className="text-sm font-bold text-primary">{initials}</span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">{fullName || "User"}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{email}</p>
                            </div>
                        </div>
                    </div>
                )}

                {!user && <div className="h-[68px] shrink-0" />}

                {/* Menu sections */}
                <div className="flex-1 overflow-y-auto py-3">

                    {/* Main Navigation */}
                    <div className="px-4 mb-1">
                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2 mb-2">
                            Navigation
                        </p>
                        <div className="rounded-2xl overflow-hidden"
                            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 12px -4px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.05)" }}
                        >
                            <MenuItem icon={Home} label="Home" onClick={() => navigate("/")} />
                            {user && (
                                <>
                                    <MenuItem icon={FileText} label="My Documents" onClick={() => navigate("/documents")} divider />
                                    <MenuItem icon={History} label="History" onClick={() => navigate("/history")} divider />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Account Section */}
                    {user && (
                        <div className="px-4 mt-4 mb-1">
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2 mb-2">
                                Account
                            </p>
                            <div className="rounded-2xl overflow-hidden"
                                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 12px -4px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.05)" }}
                            >
                                <MenuItem icon={User} label="Business Profile" onClick={() => navigate("/profile")} />
                                <MenuItem icon={Settings} label="Settings" onClick={() => navigate("/settings")} divider />
                                <MenuItem icon={Bell} label="Notifications" onClick={() => navigate("/notifications")} divider />
                                <MenuItem icon={CreditCard} label="Billing & Plans" onClick={() => navigate("/billing")} divider />
                            </div>
                        </div>
                    )}

                    {/* Support & Legal */}
                    <div className="px-4 mt-4 mb-1">
                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2 mb-2">
                            Support & Legal
                        </p>
                        <div className="rounded-2xl overflow-hidden"
                            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 12px -4px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.05)" }}
                        >
                            <MenuItem icon={HelpCircle} label="Help Center" onClick={() => navigate("/contact")} />
                            <MenuItem icon={BookOpen} label="Blog" onClick={() => navigate("/blog")} divider />
                            <MenuItem icon={Mail} label="Contact Us" onClick={() => navigate("/contact")} divider />
                            <MenuItem icon={Info} label="About Us" onClick={() => navigate("/about")} divider />
                            <MenuItem icon={Shield} label="Privacy Policy" onClick={() => navigate("/privacy")} divider />
                            <MenuItem icon={FileCheck} label="Terms & Conditions" onClick={() => navigate("/terms")} divider />
                            <MenuItem icon={Lock} label="Refund Policy" onClick={() => navigate("/refund-policy")} divider />
                        </div>
                    </div>

                    {/* Sign out */}
                    {user && (
                        <div className="px-4 mt-4">
                            <div className="rounded-2xl overflow-hidden"
                                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 12px -4px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.05)" }}
                            >
                                <MenuItem icon={LogOut} label="Sign Out" onClick={handleSignOut} variant="danger" />
                            </div>
                        </div>
                    )}

                    {/* Sign in (if not logged in) */}
                    {!user && !isLoading && (
                        <div className="px-4 mt-4">
                            <button
                                onClick={() => navigate("/auth/login")}
                                className="w-full px-4 py-3.5 bg-primary text-primary-foreground rounded-2xl font-semibold hover:bg-primary/90 transition-colors active:scale-[0.98]"
                                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                            >
                                Sign In
                            </button>
                        </div>
                    )}

                    <div className="h-6" />
                </div>

                {/* Footer */}
                <div className="shrink-0 px-5 py-4"
                    style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
                >
                    <p className="text-[11px] text-center text-muted-foreground/60">Clorefy © 2026 · v1.0.0</p>
                </div>
            </div>
        </div>
    )
}

// Menu Item Component
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
            {divider && <div style={{ height: "1px", background: "rgba(0,0,0,0.05)", margin: "0 14px" }} />}
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    "flex items-center gap-3.5 w-full px-4 py-3.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] bg-card",
                    variant === "default" && "text-foreground hover:bg-secondary/40",
                    variant === "danger" && "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                )}
            >
                <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                    variant === "default" ? "bg-secondary/60" : "bg-red-50 dark:bg-red-950/30"
                )}>
                    <Icon className={cn(
                        "w-4 h-4",
                        variant === "default" ? "text-foreground/70" : "text-red-500"
                    )} />
                </div>
                <span className="truncate">{label}</span>
            </button>
        </>
    )
}

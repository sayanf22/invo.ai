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
                    "fixed top-0 right-0 h-full w-[420px] max-w-[calc(100vw-16px)] bg-background border-l border-border shadow-[-8px_0_30px_-5px_rgba(0,0,0,0.15)] z-50 flex flex-col",
                    "transition-transform ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
                    visibleOpen ? "translate-x-0" : "translate-x-full",
                    !isOpen && !visibleOpen && "invisible"
                )}
                style={{ transitionDuration: "350ms" }}
            >
                {/* Header with user info */}
                {user && (
                    <div className="p-6 pt-5 border-b border-border bg-gradient-to-br from-primary/5 to-primary/10">
                        <div className="flex items-center gap-4 pr-14">
                            {avatarUrl ? (
                                <Image
                                    src={avatarUrl}
                                    alt={fullName || email}
                                    width={56}
                                    height={56}
                                    className="w-14 h-14 rounded-full object-cover border-2 border-primary/20"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                                    <span className="text-base font-semibold text-primary">
                                        {initials}
                                    </span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-base font-semibold text-foreground truncate">
                                    {fullName || "User"}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                    {email}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Spacer for toggle button area when no user header */}
                {!user && <div className="h-[68px] shrink-0" />}

                {/* Menu sections */}
                <div className="flex-1 overflow-y-auto py-2 pb-20">
                    {/* Main Navigation */}
                    <div className="px-3 py-3">
                        <p className="px-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Navigation
                        </p>
                        <MenuItem icon={Home} label="Home" onClick={() => navigate("/")} />
                        {user && (
                            <>
                                <MenuItem icon={FileText} label="My Documents" onClick={() => navigate("/documents")} />
                                <MenuItem icon={History} label="History" onClick={() => navigate("/history")} />
                            </>
                        )}
                    </div>

                    {/* Account Section */}
                    {user && (
                        <div className="px-3 py-3 border-t border-border">
                            <p className="px-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Account
                            </p>
                            <MenuItem icon={User} label="Business Profile" onClick={() => navigate("/profile")} />
                            <MenuItem icon={Settings} label="Settings" onClick={() => navigate("/settings")} />
                            <MenuItem icon={Bell} label="Notifications" onClick={() => navigate("/notifications")} />
                            <MenuItem icon={CreditCard} label="Billing & Plans" onClick={() => navigate("/billing")} />
                        </div>
                    )}

                    {/* Legal & Support */}
                    <div className="px-3 py-3 border-t border-border">
                        <p className="px-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Support & Legal
                        </p>
                        <MenuItem icon={HelpCircle} label="Help Center" onClick={() => navigate("/contact")} />
                        <MenuItem icon={BookOpen} label="Blog" onClick={() => navigate("/blog")} />
                        <MenuItem icon={Mail} label="Contact Us" onClick={() => navigate("/contact")} />
                        <MenuItem icon={Info} label="About Us" onClick={() => navigate("/about")} />
                        <MenuItem icon={Shield} label="Privacy Policy" onClick={() => navigate("/privacy")} />
                        <MenuItem icon={FileCheck} label="Terms & Conditions" onClick={() => navigate("/terms")} />
                        <MenuItem icon={Lock} label="Refund Policy" onClick={() => navigate("/refund-policy")} />
                    </div>

                    {/* Sign out */}
                    {user && (
                        <div className="px-3 py-3 border-t border-border">
                            <MenuItem icon={LogOut} label="Sign Out" onClick={handleSignOut} variant="danger" />
                        </div>
                    )}

                    {/* Sign in (if not logged in) */}
                    {!user && !isLoading && (
                        <div className="px-3 py-3 border-t border-border">
                            <button
                                onClick={() => navigate("/auth/login")}
                                className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
                            >
                                Sign In
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 p-4 border-t border-border bg-muted/30">
                    <p className="text-xs text-center text-muted-foreground">Clorefy © 2026</p>
                    <p className="text-xs text-center text-muted-foreground mt-1">v1.0.0</p>
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
}

function MenuItem({ icon: Icon, label, onClick, variant = "default" }: MenuItemProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex items-center gap-4 w-full px-4 py-3.5 rounded-lg text-base transition-all duration-200 active:scale-[0.97]",
                variant === "default" && "text-foreground hover:bg-secondary/50 hover:text-foreground",
                variant === "danger" && "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            )}
        >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="truncate">{label}</span>
        </button>
    )
}

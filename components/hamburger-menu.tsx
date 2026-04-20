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
                style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
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
                    boxShadow: "-20px 0 60px -10px rgba(0,0,0,0.2), -4px 0 16px -4px rgba(0,0,0,0.08)",
                }}
            >
                {/* User header */}
                {user ? (
                    <div className="px-5 pt-14 pb-5 shrink-0"
                        style={{
                            background: "linear-gradient(135deg, hsl(18 60% 44%) 0%, hsl(24 70% 38%) 100%)",
                            borderRadius: "20px 0 0 0",
                        }}
                    >
                        <div className="flex items-center gap-3.5">
                            {avatarUrl ? (
                                <Image src={avatarUrl} alt={fullName || email} width={48} height={48}
                                    className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/30"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center ring-2 ring-white/30"
                                    style={{ background: "rgba(255,255,255,0.2)" }}
                                >
                                    <span className="text-base font-bold text-white">{initials}</span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">{fullName || "User"}</p>
                                <p className="text-xs text-white/70 truncate mt-0.5">{email}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-16 shrink-0" style={{ borderRadius: "20px 0 0 0", background: "linear-gradient(135deg, hsl(18 60% 44%) 0%, hsl(24 70% 38%) 100%)" }} />
                )}

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

                    {/* Navigation */}
                    <MenuSection label="Navigation">
                        <MenuItem icon={Home} iconBg="#3b82f6" label="Home" onClick={() => navigate("/")} />
                        {user && <>
                            <MenuItem icon={FileText} iconBg="#8b5cf6" label="My Documents" onClick={() => navigate("/documents")} divider />
                            <MenuItem icon={History} iconBg="#06b6d4" label="History" onClick={() => navigate("/history")} divider />
                        </>}
                    </MenuSection>

                    {/* Account */}
                    {user && (
                        <MenuSection label="Account">
                            <MenuItem icon={User} iconBg="#f97316" label="Business Profile" onClick={() => navigate("/profile")} />
                            <MenuItem icon={Settings} iconBg="#6b7280" label="Settings" onClick={() => navigate("/settings")} divider />
                            <MenuItem icon={Bell} iconBg="#ef4444" label="Notifications" onClick={() => navigate("/notifications")} divider />
                            <MenuItem icon={CreditCard} iconBg="#10b981" label="Billing & Plans" onClick={() => navigate("/billing")} divider />
                        </MenuSection>
                    )}

                    {/* Support */}
                    <MenuSection label="Support & Legal">
                        <MenuItem icon={HelpCircle} iconBg="#f59e0b" label="Help Center" onClick={() => navigate("/contact")} />
                        <MenuItem icon={BookOpen} iconBg="#8b5cf6" label="Blog" onClick={() => navigate("/blog")} divider />
                        <MenuItem icon={Mail} iconBg="#3b82f6" label="Contact Us" onClick={() => navigate("/contact")} divider />
                        <MenuItem icon={Info} iconBg="#6b7280" label="About Us" onClick={() => navigate("/about")} divider />
                        <MenuItem icon={Shield} iconBg="#10b981" label="Privacy Policy" onClick={() => navigate("/privacy")} divider />
                        <MenuItem icon={FileCheck} iconBg="#6b7280" label="Terms & Conditions" onClick={() => navigate("/terms")} divider />
                        <MenuItem icon={Lock} iconBg="#6b7280" label="Refund Policy" onClick={() => navigate("/refund-policy")} divider />
                    </MenuSection>

                    {/* Sign out */}
                    {user && (
                        <MenuSection>
                            <MenuItem icon={LogOut} iconBg="#ef4444" label="Sign Out" onClick={handleSignOut} variant="danger" />
                        </MenuSection>
                    )}

                    {/* Sign in */}
                    {!user && !isLoading && (
                        <button onClick={() => navigate("/auth/login")}
                            className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
                            style={{ background: "linear-gradient(135deg, hsl(18 60% 44%), hsl(24 70% 38%))", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                        >
                            Sign In
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 py-3 px-5" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <p className="text-[11px] text-center text-stone-400">Clorefy © 2026 · v1.0.0</p>
                </div>
            </div>
        </div>
    )
}

function MenuSection({ label, children }: { label?: string; children: React.ReactNode }) {
    return (
        <div>
            {label && (
                <p className="text-[10px] font-bold uppercase tracking-widest px-1 mb-1.5" style={{ color: "hsl(18 60% 48% / 0.7)" }}>{label}</p>
            )}
            <div className="rounded-2xl overflow-hidden bg-white"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px -4px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.04)" }}
            >
                {children}
            </div>
        </div>
    )
}

interface MenuItemProps {
    icon: React.ElementType
    iconBg: string
    label: string
    onClick: () => void
    variant?: "default" | "danger"
    divider?: boolean
}

function MenuItem({ icon: Icon, iconBg, label, onClick, variant = "default", divider = false }: MenuItemProps) {
    return (
        <>
            {divider && <div className="mx-[52px]" style={{ height: "0.5px", background: "rgba(0,0,0,0.08)" }} />}
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    "flex items-center gap-3 w-full px-3.5 py-3 text-sm font-medium transition-all duration-150 active:opacity-60 bg-white",
                    variant === "danger" ? "text-red-500" : "text-stone-800"
                )}
            >
                {/* Colored icon badge */}
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                    style={{ background: variant === "danger" ? "#ef4444" : iconBg }}
                >
                    <Icon className="w-[17px] h-[17px] text-white" />
                </div>
                <span className="flex-1 text-left">{label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-stone-300 shrink-0" />
            </button>
        </>
    )
}

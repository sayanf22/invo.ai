"use client"

import { useState, useRef, useEffect } from "react"
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
    const menuRef = useRef<HTMLDivElement>(null)

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Close on escape key
    useEffect(() => {
        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") setIsOpen(false)
        }
        document.addEventListener("keydown", handleEscape)
        return () => document.removeEventListener("keydown", handleEscape)
    }, [])

    const handleSignOut = async () => {
        setIsOpen(false)
        await supabase.auth.signOut()
        router.push("/auth/login")
        router.refresh()
    }

    const navigate = (path: string) => {
        setIsOpen(false)
        router.push(path)
    }

    // Get user info
    const email = user?.email || ""
    const fullName = user?.user_metadata?.full_name || ""
    const initials = fullName
        ? fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
        : email.charAt(0).toUpperCase()
    const avatarUrl = user?.user_metadata?.avatar_url || ""

    return (
        <div className="relative" ref={menuRef}>
            {/* Hamburger toggle button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center w-12 h-12 rounded-xl hover:bg-secondary/50 transition-all duration-200 btn-icon-bounce"
                aria-expanded={isOpen}
                aria-label="Menu"
            >
                <MenuToggleIcon
                    open={isOpen}
                    className="w-9 h-9"
                    strokeWidth={3}
                    duration={400}
                />
            </button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Slide-out menu */}
            <div
                className={cn(
                    "fixed top-0 right-0 h-full w-[420px] max-w-[calc(100vw-16px)] bg-background border-l border-border shadow-[-8px_0_30px_-5px_rgba(0,0,0,0.15)] z-50 transform transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Close button inside panel */}
                <div className="flex items-center justify-end px-4 pt-4 pb-0">
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        aria-label="Close menu"
                        className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-secondary/50 transition-all duration-200"
                    >
                        <MenuToggleIcon open={true} className="w-7 h-7" strokeWidth={3} duration={400} />
                    </button>
                </div>

                {/* Header with user info */}
                {user && (
                    <div className="p-6 pt-2 border-b border-border bg-gradient-to-br from-primary/5 to-primary/10">
                        <div className="flex items-center gap-4">
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

                {/* Menu sections */}
                <div className="flex-1 overflow-y-auto py-2 pb-20">
                    {/* Main Navigation */}
                    <div className="px-3 py-3">
                        <p className="px-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Navigation
                        </p>
                        <MenuItem
                            icon={Home}
                            label="Home"
                            onClick={() => navigate("/")}
                        />
                        {user && (
                            <>
                                <MenuItem
                                    icon={FileText}
                                    label="My Documents"
                                    onClick={() => navigate("/documents")}
                                />
                                <MenuItem
                                    icon={History}
                                    label="History"
                                    onClick={() => navigate("/history")}
                                />
                            </>
                        )}
                    </div>

                    {/* Account Section */}
                    {user && (
                        <div className="px-3 py-3 border-t border-border">
                            <p className="px-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Account
                            </p>
                            <MenuItem
                                icon={User}
                                label="Business Profile"
                                onClick={() => navigate("/profile")}
                            />
                            <MenuItem
                                icon={Settings}
                                label="Settings"
                                onClick={() => navigate("/settings")}
                            />
                            <MenuItem
                                icon={Bell}
                                label="Notifications"
                                onClick={() => navigate("/notifications")}
                            />
                            <MenuItem
                                icon={CreditCard}
                                label="Billing & Plans"
                                onClick={() => navigate("/billing")}
                            />
                        </div>
                    )}

                    {/* Legal & Support */}
                    <div className="px-3 py-3 border-t border-border">
                        <p className="px-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Support & Legal
                        </p>
                        <MenuItem
                            icon={HelpCircle}
                            label="Help Center"
                            onClick={() => navigate("/help")}
                        />
                        <MenuItem
                            icon={BookOpen}
                            label="Documentation"
                            onClick={() => navigate("/docs")}
                        />
                        <MenuItem
                            icon={Mail}
                            label="Contact Us"
                            onClick={() => navigate("/contact")}
                        />
                        <MenuItem
                            icon={Info}
                            label="About Us"
                            onClick={() => navigate("/about")}
                        />
                        <MenuItem
                            icon={Shield}
                            label="Privacy Policy"
                            onClick={() => navigate("/privacy")}
                        />
                        <MenuItem
                            icon={FileCheck}
                            label="Terms & Conditions"
                            onClick={() => navigate("/terms")}
                        />
                        <MenuItem
                            icon={Lock}
                            label="Security"
                            onClick={() => navigate("/security")}
                        />
                    </div>

                    {/* Sign out */}
                    {user && (
                        <div className="px-3 py-3 border-t border-border">
                            <MenuItem
                                icon={LogOut}
                                label="Sign Out"
                                onClick={handleSignOut}
                                variant="danger"
                            />
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
                    <p className="text-xs text-center text-muted-foreground">
                        Invo.ai © 2026
                    </p>
                    <p className="text-xs text-center text-muted-foreground mt-1">
                        v1.0.0
                    </p>
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
                variant === "default" &&
                "text-foreground hover:bg-secondary/50 hover:text-foreground",
                variant === "danger" &&
                "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            )}
        >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="truncate">{label}</span>
        </button>
    )
}

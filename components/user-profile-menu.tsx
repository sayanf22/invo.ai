"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { LogOut, User, Settings, ChevronDown } from "lucide-react"

export function UserProfileMenu() {
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

    // Loading state — show skeleton
    if (isLoading) {
        return (
            <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
        )
    }

    // Not logged in — show sign in button
    if (!user) {
        return (
            <button
                type="button"
                onClick={() => router.push("/auth/login")}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-border bg-background hover:bg-accent text-foreground transition-colors"
            >
                <User className="w-4 h-4" />
                Sign in
            </button>
        )
    }

    // Get user initials for avatar
    const email = user.email || ""
    const fullName = user.user_metadata?.full_name || ""
    const initials = fullName
        ? fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
        : email.charAt(0).toUpperCase()
    const avatarUrl = user.user_metadata?.avatar_url || ""

    return (
        <div className="relative" ref={menuRef}>
            {/* Profile trigger button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-accent transition-colors group"
                aria-expanded={isOpen}
                aria-haspopup="true"
                id="user-profile-menu-trigger"
            >
                {/* Avatar */}
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={fullName || email}
                        className="w-8 h-8 rounded-full object-cover border-2 border-border group-hover:border-primary/30 transition-colors"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-border group-hover:border-primary/30 transition-colors flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                            {initials}
                        </span>
                    </div>
                )}

                {/* Name (hidden on mobile) */}
                <span className="text-sm font-medium text-foreground hidden sm:inline max-w-[120px] truncate">
                    {fullName || email.split("@")[0]}
                </span>

                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 hidden sm:block ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div
                    className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-card shadow-lg shadow-black/5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                    role="menu"
                    aria-labelledby="user-profile-menu-trigger"
                >
                    {/* User info section */}
                    <div className="px-4 py-3 border-b border-border">
                        <p className="text-sm font-semibold text-foreground truncate">
                            {fullName || "User"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {email}
                        </p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1.5">
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false)
                                // Profile page (future)
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                            role="menuitem"
                        >
                            <User className="w-4 h-4 text-muted-foreground" />
                            Profile
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false)
                                // Settings page (future)
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                            role="menuitem"
                        >
                            <Settings className="w-4 h-4 text-muted-foreground" />
                            Settings
                        </button>
                    </div>

                    {/* Sign out */}
                    <div className="border-t border-border py-1.5">
                        <button
                            type="button"
                            onClick={handleSignOut}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            role="menuitem"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

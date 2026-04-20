"use client"

import Link from "next/link"
import { useState, useEffect, useRef, useCallback } from "react"
import { Menu, X, ArrowRight, ChevronDown, Sparkles, FileText, Shield, Briefcase, GraduationCap, Scale, Palette, Users, TrendingUp, BookOpen, HelpCircle, MessageCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import { ClorefyLogo } from "@/components/clorefy-logo"

type DropdownItem = { label: string; desc: string; href: string; icon: any }

const productItems: DropdownItem[] = [
    { label: "Features", desc: "All the tools you need", href: "/features", icon: Sparkles },
    { label: "Pricing", desc: "Plans for every team", href: "/pricing", icon: FileText },
    { label: "Privacy & Security", desc: "Your data, your control", href: "/privacy", icon: Shield },
]

const useCaseItems: DropdownItem[] = [
    { label: "Freelancers", desc: "Get paid faster", href: "/use-cases/freelancers", icon: Briefcase },
    { label: "Agencies", desc: "Scale client ops", href: "/use-cases/agencies", icon: Palette },
    { label: "Lawyers", desc: "Draft with precision", href: "/use-cases/lawyers", icon: Scale },
    { label: "Students", desc: "Professional docs free", href: "/use-cases/students", icon: GraduationCap },
    { label: "Sales", desc: "Close deals faster", href: "/use-cases/sales", icon: TrendingUp },
    { label: "Teams", desc: "One platform for all", href: "/use-cases/teams", icon: Users },
]

const resourceItems: DropdownItem[] = [
    { label: "Blog", desc: "Tips and guides", href: "/blog", icon: BookOpen },
    { label: "Resources", desc: "Guides and tutorials", href: "/resources", icon: HelpCircle },
    { label: "Contact Support", desc: "We're here to help", href: "/contact", icon: MessageCircle },
]

// Animation variants for the dropdown container
const dropdownVariants = {
    hidden: { opacity: 0, y: -6, scale: 0.97 },
    visible: {
        opacity: 1, y: 0, scale: 1,
        transition: {
            duration: 0.22,
            ease: [0.22, 1, 0.36, 1],
            staggerChildren: 0.055,
            delayChildren: 0.04,
        },
    },
    exit: {
        opacity: 0, y: -6, scale: 0.97,
        transition: {
            duration: 0.16,
            ease: [0.22, 1, 0.36, 1],
            staggerChildren: 0.03,
            staggerDirection: -1,
        },
    },
}

const itemVariants = {
    hidden: { opacity: 0, y: -8, x: -4 },
    visible: { opacity: 1, y: 0, x: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, y: -4, transition: { duration: 0.12, ease: "easeIn" } },
}

// Each NavDropdown manages its own close timer independently.
// This prevents the "move from Product to Use Cases" bug where a shared
// close timer would fire and close the newly opened dropdown.
function NavDropdown({ label, items, isOpen, onOpen, onClose }: {
    label: string
    items: DropdownItem[]
    isOpen: boolean
    onOpen: () => void
    onClose: () => void
}) {
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const scheduleClose = useCallback(() => {
        closeTimer.current = setTimeout(onClose, 100)
    }, [onClose])

    const cancelClose = useCallback(() => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current)
            closeTimer.current = null
        }
    }, [])

    const handleEnter = useCallback(() => {
        cancelClose()
        onOpen()
    }, [cancelClose, onOpen])

    const handleLeave = useCallback(() => {
        scheduleClose()
    }, [scheduleClose])

    // Cleanup on unmount
    useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

    return (
        <div
            className="relative"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            <button
                className={`flex items-center gap-1 px-2.5 lg:px-3 py-2 rounded-full text-sm lg:text-base font-bold transition-all duration-200 whitespace-nowrap ${isOpen ? 'text-black' : 'text-stone-600 hover:text-black'}`}
            >
                {label}
                <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={dropdownVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        style={{ width: items.length > 4 ? 300 : 280 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 p-2 rounded-2xl bg-white/95 backdrop-blur-xl border border-stone-200/50 shadow-xl shadow-black/8"
                        onMouseEnter={handleEnter}
                        onMouseLeave={handleLeave}
                    >
                        {/* Arrow pointer */}
                        <div className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-stone-200/50 rotate-45 rounded-tl-sm" />

                        {items.map((item) => (
                            <motion.div key={item.label} variants={itemVariants}>
                                <Link
                                    href={item.href}
                                    className="group flex items-start gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors"
                                    onClick={onClose}
                                >
                                    <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-[var(--landing-amber)] shrink-0 group-hover:scale-110 transition-transform">
                                        <item.icon size={18} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-[var(--landing-text-dark)]">{item.label}</div>
                                        <div className="text-xs text-[var(--landing-text-muted)]">{item.desc}</div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export function LandingNavbar() {
    const [scrolled, setScrolled] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)
    const pathname = usePathname()

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener("scroll", onScroll, { passive: true })
        return () => window.removeEventListener("scroll", onScroll)
    }, [])

    useEffect(() => {
        setMobileOpen(false)
        setOpenDropdown(null)
    }, [pathname])

    // onOpen immediately sets the open dropdown — no delay, no shared timer
    const openMenu = useCallback((name: string) => setOpenDropdown(name), [])
    // onClose only closes if this dropdown is still the active one
    const closeMenu = useCallback((name: string) => {
        setOpenDropdown(prev => prev === name ? null : prev)
    }, [])

    return (
        <>
            {/* Desktop Navbar */}
            <nav className={`hidden md:flex fixed top-6 left-1/2 -translate-x-1/2 z-[100] items-center gap-0.5 lg:gap-1 px-2 py-2 rounded-full transition-all duration-500 ${scrolled ? 'glass-nav shadow-lg shadow-black/5 border border-stone-200/30' : 'bg-transparent'}`}>
                {/* Logo */}
                <Link href="/" className="flex items-center px-2 lg:px-3 mr-1 lg:mr-2">
                    <ClorefyLogo size={42} />
                </Link>

                <NavDropdown label="Product" items={productItems} isOpen={openDropdown === "product"} onOpen={() => openMenu("product")} onClose={() => closeMenu("product")} />
                <NavDropdown label="Use Cases" items={useCaseItems} isOpen={openDropdown === "usecases"} onOpen={() => openMenu("usecases")} onClose={() => closeMenu("usecases")} />
                <Link href="/business" className="px-2.5 lg:px-3 py-2 rounded-full text-sm lg:text-base font-bold text-stone-600 hover:text-black transition-colors whitespace-nowrap">Business</Link>
                <NavDropdown label="Resources" items={resourceItems} isOpen={openDropdown === "resources"} onOpen={() => openMenu("resources")} onClose={() => closeMenu("resources")} />

                <div className="flex items-center gap-1.5 lg:gap-2 ml-1.5 lg:ml-2 pl-1.5 lg:pl-2 border-l border-stone-200/50">
                    <Link href="/auth/login" className="px-3 lg:px-4 py-2 rounded-full text-sm lg:text-base font-bold text-stone-600 hover:text-black transition-colors whitespace-nowrap">Log in</Link>
                    <Link href="/auth/signup" className="group flex items-center gap-1.5 px-4 lg:px-5 py-2 lg:py-2.5 rounded-full bg-[var(--landing-dark)] text-white text-sm lg:text-base font-bold hover:scale-105 active:scale-95 transition-all shadow-md hover:shadow-lg whitespace-nowrap">
                        Get Started
                        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </div>
            </nav>

            {/* Mobile Navbar */}
            <nav className="md:hidden fixed top-4 left-4 right-4 z-50">
                {/* Top bar — always visible */}
                <div
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all duration-300 ${
                        mobileOpen
                            ? "border-stone-200/50 shadow-lg"
                            : scrolled
                                ? "border-stone-200/40 shadow-md"
                                : "border-transparent shadow-none"
                    }`}
                    style={{
                        background: mobileOpen
                            ? "rgba(251,247,240,0.95)"
                            : scrolled
                                ? "rgba(251,247,240,0.82)"
                                : "rgba(251,247,240,0.15)",
                        backdropFilter: "blur(28px) saturate(1.8)",
                        WebkitBackdropFilter: "blur(28px) saturate(1.8)",
                        transition: "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
                    }}
                >
                    <Link href="/" className="flex items-center">
                        <ClorefyLogo size={42} />
                    </Link>
                    <motion.button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-black/5 transition-colors"
                        whileTap={{ scale: 0.9 }}
                    >
                        <motion.div
                            animate={{ rotate: mobileOpen ? 90 : 0 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        >
                            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                        </motion.div>
                    </motion.button>
                </div>

                {/* Dropdown panel */}
                <AnimatePresence>
                    {mobileOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
                            exit={{ opacity: 0, y: -6, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
                            className="mt-2 rounded-2xl border border-stone-200/40 shadow-2xl overflow-hidden"
                            style={{
                                transformOrigin: "top center",
                                background: "rgba(251, 247, 240, 0.97)",
                                backdropFilter: "blur(40px) saturate(2.2)",
                                WebkitBackdropFilter: "blur(40px) saturate(2.2)",
                            }}
                        >
                            <div className="p-3 space-y-0.5">
                                {[
                                    { label: "Features", href: "/features" },
                                    { label: "Pricing", href: "/pricing" },
                                    { label: "Business", href: "/business" },
                                    { label: "Blog", href: "/blog" },
                                    { label: "Resources", href: "/resources" },
                                ].map((link, i) => (
                                    <motion.div
                                        key={link.label}
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            delay: i * 0.045,
                                            duration: 0.3,
                                            ease: [0.16, 1, 0.3, 1],
                                        }}
                                    >
                                        <Link
                                            href={link.href}
                                            onClick={() => setMobileOpen(false)}
                                            className="block px-4 py-3 rounded-xl text-sm font-semibold text-[var(--landing-text-dark)] hover:bg-black/5 active:bg-black/8 transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>

                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.22, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                className="px-3 pb-3 grid grid-cols-2 gap-2 border-t border-stone-200/50 pt-3 mx-3 mb-0"
                            >
                                <Link
                                    href="/auth/login"
                                    className="px-4 py-3 rounded-xl text-center text-sm font-bold border border-stone-200/80 bg-white/60 hover:bg-white transition-colors"
                                >
                                    Log in
                                </Link>
                                <Link
                                    href="/auth/signup"
                                    className="px-4 py-3 rounded-xl text-center text-sm font-bold bg-[var(--landing-dark)] text-white active:scale-95 transition-transform"
                                >
                                    Get Started
                                </Link>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>
        </>
    )
}

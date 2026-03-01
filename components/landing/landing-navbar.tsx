"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { Menu, X, ArrowRight, ChevronDown, Sparkles, FileText, Shield, Code2, Briefcase, GraduationCap, Scale, Palette, Users, TrendingUp, BookOpen, HelpCircle, MessageCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"

type DropdownItem = { label: string; desc: string; href: string; icon: any }

const productItems: DropdownItem[] = [
    { label: "Features", desc: "All the tools you need", href: "/features", icon: Sparkles },
    { label: "Pricing", desc: "Plans for every team", href: "/pricing", icon: FileText },
    { label: "Privacy & Security", desc: "Your data, your control", href: "/privacy", icon: Shield },
]

const useCaseItems: DropdownItem[] = [
    { label: "Freelancers", desc: "Get paid faster", href: "/use-cases/freelancers", icon: Briefcase },
    { label: "Developers", desc: "API-first integration", href: "/developers", icon: Code2 },
    { label: "Agencies", desc: "Scale client ops", href: "/use-cases/agencies", icon: Palette },
    { label: "Lawyers", desc: "Draft with precision", href: "/use-cases/lawyers", icon: Scale },
    { label: "Students", desc: "Professional docs free", href: "/use-cases/students", icon: GraduationCap },
    { label: "Sales", desc: "Close deals faster", href: "/use-cases/sales", icon: TrendingUp },
    { label: "Teams", desc: "One platform for all", href: "/use-cases/teams", icon: Users },
]

const resourceItems: DropdownItem[] = [
    { label: "Resources", desc: "Guides and tutorials", href: "/resources", icon: BookOpen },
    { label: "Help Center", desc: "Find answers fast", href: "#", icon: HelpCircle },
    { label: "Talk to Support", desc: "We're here to help", href: "#", icon: MessageCircle },
    { label: "API Docs", desc: "Developer reference", href: "/developers", icon: Code2 },
]

function NavDropdown({ label, items, isOpen, onToggle }: { label: string; items: DropdownItem[]; isOpen: boolean; onToggle: () => void }) {
    const ref = useRef<HTMLDivElement>(null)

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={onToggle}
                className={`flex items-center gap-1 px-3 py-2 rounded-full text-lg font-extrabold transition-all duration-200 ${isOpen ? 'text-black' : 'text-stone-600 hover:text-black'}`}
            >
                {label}
                <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[280px] p-2 rounded-2xl bg-white/95 backdrop-blur-xl border border-stone-200/50 shadow-xl shadow-black/5"
                    >
                        {items.map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="group flex items-start gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors"
                            >
                                <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-[var(--landing-amber)] shrink-0 group-hover:scale-110 transition-transform">
                                    <item.icon size={18} />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-[var(--landing-text-dark)]">{item.label}</div>
                                    <div className="text-xs text-[var(--landing-text-muted)]">{item.desc}</div>
                                </div>
                            </Link>
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
    const navRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener("scroll", onScroll, { passive: true })
        return () => window.removeEventListener("scroll", onScroll)
    }, [])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) {
                setOpenDropdown(null)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    // Close mobile menu on route change
    useEffect(() => {
        setMobileOpen(false)
        setOpenDropdown(null)
    }, [pathname])

    const toggleDropdown = (name: string) => {
        setOpenDropdown(openDropdown === name ? null : name)
    }

    return (
        <>
            {/* Desktop Navbar */}
            <nav
                ref={navRef}
                className={`hidden md:flex fixed top-6 left-1/2 -translate-x-1/2 z-[100] items-center gap-1 px-2 py-2 rounded-full transition-all duration-500 ${scrolled
                    ? 'glass-nav shadow-lg shadow-black/5 border border-stone-200/30'
                    : 'bg-transparent'
                    }`}
            >
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 px-3 mr-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--landing-amber)] to-[var(--landing-amber-light)] flex items-center justify-center text-white font-bold text-sm shadow-md">
                        I
                    </div>
                    <span className="font-bold text-[var(--landing-text-dark)] text-sm tracking-tight">Invo.ai</span>
                </Link>

                {/* Navigation */}
                <NavDropdown label="Product" items={productItems} isOpen={openDropdown === "product"} onToggle={() => toggleDropdown("product")} />
                <NavDropdown label="Use Cases" items={useCaseItems} isOpen={openDropdown === "usecases"} onToggle={() => toggleDropdown("usecases")} />
                <Link href="/business" className="px-3 py-2 rounded-full text-lg font-extrabold text-stone-600 hover:text-black transition-colors">
                    Business
                </Link>
                <NavDropdown label="Resources" items={resourceItems} isOpen={openDropdown === "resources"} onToggle={() => toggleDropdown("resources")} />

                {/* CTA */}
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-stone-200/50">
                    <Link href="/auth/login" className="px-4 py-2 rounded-full text-lg font-extrabold text-stone-600 hover:text-black transition-colors">
                        Log in
                    </Link>
                    <Link
                        href="/auth/register"
                        className="group flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[var(--landing-dark)] text-white text-base font-bold hover:scale-105 active:scale-95 transition-all shadow-md hover:shadow-lg"
                    >
                        Get Started
                        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </div>
            </nav>

            {/* Mobile Navbar */}
            <nav className="md:hidden fixed top-4 left-4 right-4 z-50">
                <div className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 ${scrolled || mobileOpen ? 'glass-nav shadow-lg border border-stone-200/30' : 'bg-transparent'}`}>
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--landing-amber)] to-[var(--landing-amber-light)] flex items-center justify-center text-white font-bold text-sm shadow-md">
                            I
                        </div>
                        <span className="font-bold text-[var(--landing-text-dark)] text-sm">Invo.ai</span>
                    </Link>
                    <button onClick={() => setMobileOpen(!mobileOpen)} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-stone-100 transition-colors">
                        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                <AnimatePresence>
                    {mobileOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="mt-2 p-4 rounded-2xl glass-nav border border-stone-200/30 shadow-xl overflow-hidden"
                        >
                            <div className="space-y-1">
                                {[
                                    { label: "Features", href: "/features" },
                                    { label: "Pricing", href: "/pricing" },
                                    { label: "Business", href: "/business" },
                                    { label: "Developers", href: "/developers" },
                                    { label: "Resources", href: "/resources" },
                                ].map((link) => (
                                    <Link
                                        key={link.label}
                                        href={link.href}
                                        onClick={() => setMobileOpen(false)}
                                        className="block px-4 py-3 rounded-xl text-sm font-semibold text-[var(--landing-text-dark)] hover:bg-stone-100 transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                            <div className="pt-4 mt-4 border-t border-stone-200/50 grid grid-cols-2 gap-3">
                                <Link href="/auth/login" className="px-4 py-3 rounded-xl text-center text-sm font-bold border border-stone-200 hover:bg-stone-50 transition-colors">
                                    Log in
                                </Link>
                                <button
                                    onClick={() => { setMobileOpen(false); window.location.href = "/auth/register" }}
                                    className="px-4 py-3 rounded-xl text-center text-sm font-bold bg-[var(--landing-dark)] text-white hover:scale-105 transition-all"
                                >
                                    Get Started
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>
        </>
    )
}

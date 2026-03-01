"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

const footerLinks = {
    Product: [
        { label: "Features", href: "/features" },
        { label: "Pricing", href: "/pricing" },
        { label: "Business", href: "/business" },
        { label: "Developers", href: "/developers" },
    ],
    "Use Cases": [
        { label: "Freelancers", href: "/use-cases/freelancers" },
        { label: "Agencies", href: "/use-cases/agencies" },
        { label: "Lawyers", href: "/use-cases/lawyers" },
        { label: "Sales", href: "/use-cases/sales" },
        { label: "Students", href: "/use-cases/students" },
        { label: "Teams", href: "/use-cases/teams" },
    ],
    Resources: [
        { label: "Help Center", href: "#" },
        { label: "API Docs", href: "/developers" },
        { label: "Templates", href: "/resources" },
        { label: "Blog", href: "#" },
    ],
    Company: [
        { label: "About", href: "#" },
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Contact Sales", href: "/contact-sales" },
    ],
}

export function LandingFooter() {

    return (
        <footer className="bg-[var(--landing-dark)] text-[var(--landing-cream)] pt-20 pb-10 px-6 sm:px-10">
            <div className="max-w-7xl mx-auto">
                {/* Top CTA strip */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-16 mb-16 border-b border-white/10">
                    <div>
                        <h3 className="font-display text-3xl sm:text-4xl font-bold mb-2">
                            Ready to get started?
                        </h3>
                        <p className="text-[var(--landing-text-dim)] text-lg">
                            Professional documents, generated in seconds.
                        </p>
                    </div>
                    <Link
                        href="/auth/register"
                        className="group shrink-0 flex items-center gap-2 px-8 py-4 rounded-full bg-[var(--landing-cream)] text-[var(--landing-dark)] font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                        Get Started Free
                        <ArrowRight className="transition-transform group-hover:translate-x-1" size={18} />
                    </Link>
                </div>

                {/* Links Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
                    {Object.entries(footerLinks).map(([group, links]) => (
                        <div key={group}>
                            <h4 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-6">{group}</h4>
                            <ul className="space-y-3">
                                {links.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-[var(--landing-text-dim)] hover:text-[var(--landing-cream)] transition-colors duration-200"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/10">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--landing-amber)] to-[var(--landing-amber-light)] flex items-center justify-center text-white font-bold text-xs shadow-md">
                            I
                        </div>
                        <span className="font-bold text-sm">Invo.ai</span>
                    </div>
                    <p className="text-xs text-white/30">
                        © {new Date().getFullYear()} Invo.ai. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    )
}

"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { ClorefyLogo } from "@/components/clorefy-logo"

const footerLinks = {
    Product: [
        { label: "Features", href: "/features" },
        { label: "Pricing", href: "/pricing" },
        { label: "Business", href: "/business" },
        { label: "Use Cases", href: "/use-cases/freelancers" },
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
        { label: "Help Center", href: "/contact" },
        { label: "Templates", href: "/resources" },
        { label: "Blog", href: "#" },
    ],
    Company: [
        { label: "About Us", href: "/about" },
        { label: "Contact Us", href: "/contact" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms & Conditions", href: "/terms" },
        { label: "Refund Policy", href: "/refund-policy" },
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
                        href="/auth/signup"
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
                    <div className="flex items-center gap-2.5">
                        <ClorefyLogo size={28} />
                        <span className="font-bold text-sm">Clorefy</span>
                    </div>
                    <p className="text-xs text-white/30">
                        © {new Date().getFullYear()} Clorefy. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    )
}

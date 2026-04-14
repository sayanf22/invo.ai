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
    Tools: [
        { label: "Invoice Generator India", href: "/tools/invoice-generator/india" },
        { label: "Invoice Generator USA", href: "/tools/invoice-generator/usa" },
        { label: "Contract Generator USA", href: "/tools/contract-generator/usa" },
        { label: "Contract Generator UK", href: "/tools/contract-generator/uk" },
        { label: "Quotation Generator India", href: "/tools/quotation-generator/india" },
        { label: "Proposal Generator USA", href: "/tools/proposal-generator/usa" },
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
        { label: "Blog", href: "/blog" },
        { label: "Help Center", href: "/contact" },
        { label: "Templates", href: "/resources" },
        { label: "Developers", href: "/developers" },
    ],
    Company: [
        { label: "About Us", href: "/about" },
        { label: "Contact Us", href: "/contact" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms & Conditions", href: "/terms" },
        { label: "Refund Policy", href: "/refund-policy" },
    ],
}

// Top cities per country for the Locations section (representative set)
const locationLinks = [
    { label: "Mumbai", href: "/tools/invoice-generator/india/mumbai" },
    { label: "Delhi", href: "/tools/invoice-generator/india/delhi" },
    { label: "Bangalore", href: "/tools/invoice-generator/india/bangalore" },
    { label: "New York", href: "/tools/invoice-generator/usa/new-york" },
    { label: "Los Angeles", href: "/tools/invoice-generator/usa/los-angeles" },
    { label: "London", href: "/tools/invoice-generator/uk/london" },
    { label: "Manchester", href: "/tools/invoice-generator/uk/manchester" },
    { label: "Toronto", href: "/tools/invoice-generator/canada/toronto" },
    { label: "Sydney", href: "/tools/invoice-generator/australia/sydney" },
    { label: "Dubai", href: "/tools/invoice-generator/uae/dubai" },
    { label: "Singapore", href: "/tools/invoice-generator/singapore/central" },
    { label: "Berlin", href: "/tools/invoice-generator/germany/berlin" },
]

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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
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

                {/* Locations section */}
                <div className="mb-12 pt-10 border-t border-white/10">
                    <h4 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-6">Locations</h4>
                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                        {locationLinks.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="text-sm text-[var(--landing-text-dim)] hover:text-[var(--landing-cream)] transition-colors duration-200"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
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
                    <Link
                        href="/clorefy-alternative-spellings"
                        className="text-xs text-white/20 hover:text-white/40 transition-colors duration-200"
                    >
                        Alternative spellings
                    </Link>
                </div>
            </div>
        </footer>
    )
}

"use client"

import Link from "next/link"
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

// One section: countries with their cities grouped together
const countryGroups = [
    {
        flag: "🇮🇳", name: "India", tax: "GST",
        cities: [
            { label: "Mumbai", href: "/tools/invoice-generator/india/mumbai" },
            { label: "Delhi", href: "/tools/invoice-generator/india/delhi" },
            { label: "Bangalore", href: "/tools/invoice-generator/india/bangalore" },
            { label: "Chennai", href: "/tools/invoice-generator/india/chennai" },
        ],
    },
    {
        flag: "🇺🇸", name: "USA", tax: "Sales Tax",
        cities: [
            { label: "New York", href: "/tools/invoice-generator/usa/new-york" },
            { label: "Los Angeles", href: "/tools/invoice-generator/usa/los-angeles" },
            { label: "Chicago", href: "/tools/invoice-generator/usa/chicago" },
        ],
    },
    {
        flag: "🇬🇧", name: "UK", tax: "VAT",
        cities: [
            { label: "London", href: "/tools/invoice-generator/uk/london" },
            { label: "Manchester", href: "/tools/invoice-generator/uk/manchester" },
            { label: "Birmingham", href: "/tools/invoice-generator/uk/birmingham" },
        ],
    },
    {
        flag: "🇩🇪", name: "Germany", tax: "USt",
        cities: [
            { label: "Berlin", href: "/tools/invoice-generator/germany/berlin" },
            { label: "Munich", href: "/tools/invoice-generator/germany/munich" },
        ],
    },
    {
        flag: "🇨🇦", name: "Canada", tax: "GST/HST",
        cities: [
            { label: "Toronto", href: "/tools/invoice-generator/canada/toronto" },
            { label: "Vancouver", href: "/tools/invoice-generator/canada/vancouver" },
        ],
    },
    {
        flag: "🇦🇺", name: "Australia", tax: "GST",
        cities: [
            { label: "Sydney", href: "/tools/invoice-generator/australia/sydney" },
            { label: "Melbourne", href: "/tools/invoice-generator/australia/melbourne" },
        ],
    },
    {
        flag: "🇸🇬", name: "Singapore", tax: "GST",
        cities: [
            { label: "Singapore", href: "/tools/invoice-generator/singapore/central" },
        ],
    },
    {
        flag: "🇦🇪", name: "UAE", tax: "VAT",
        cities: [
            { label: "Dubai", href: "/tools/invoice-generator/uae/dubai" },
            { label: "Abu Dhabi", href: "/tools/invoice-generator/uae/abu-dhabi" },
        ],
    },
    {
        flag: "🇵🇭", name: "Philippines", tax: "VAT",
        cities: [
            { label: "Manila", href: "/tools/invoice-generator/philippines/manila" },
            { label: "Cebu", href: "/tools/invoice-generator/philippines/cebu" },
        ],
    },
    {
        flag: "🇫🇷", name: "France", tax: "TVA",
        cities: [
            { label: "Paris", href: "/tools/invoice-generator/france/paris" },
            { label: "Lyon", href: "/tools/invoice-generator/france/lyon" },
        ],
    },
    {
        flag: "🇳🇱", name: "Netherlands", tax: "BTW",
        cities: [
            { label: "Amsterdam", href: "/tools/invoice-generator/netherlands/amsterdam" },
            { label: "Rotterdam", href: "/tools/invoice-generator/netherlands/rotterdam" },
        ],
    },
]

export function LandingFooter() {
    return (
        <footer className="bg-[var(--landing-cream)] text-[var(--landing-text-dark)] pt-16 px-6 sm:px-10 overflow-hidden">
            <div className="max-w-7xl mx-auto flex flex-col min-h-full">
                {/* Links Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
                    {Object.entries(footerLinks).map(([group, links]) => (
                        <div key={group}>
                            <h4 className="font-display text-lg sm:text-xl text-[var(--landing-text-dark)] mb-5">{group}</h4>
                            <ul className="space-y-2.5">
                                {links.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="text-sm font-medium text-[var(--landing-text-dark)]/70 hover:text-[var(--landing-amber)] transition-colors duration-200"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Countries & Cities — single merged section */}
                <div className="pt-8 mb-10 border-t border-black/10">
                    <h4 className="font-display text-lg text-[var(--landing-text-dark)] mb-5">
                        Available Worldwide
                    </h4>
                    <div className="space-y-4">
                        {countryGroups.map((country) => (
                            <div key={country.name} className="flex flex-wrap items-baseline gap-x-1 gap-y-1">
                                {/* Country label */}
                                <span className="text-xs text-[var(--landing-text-dark)] font-bold mr-2 shrink-0">
                                    {country.flag} {country.name} · {country.tax}
                                </span>
                                {/* City links */}
                                {country.cities.map((city, i) => (
                                    <span key={city.label} className="flex items-center">
                                        <Link
                                            href={city.href}
                                            className="text-sm font-medium text-[var(--landing-text-dark)]/70 hover:text-[var(--landing-amber)] transition-colors duration-200"
                                        >
                                            {city.label}
                                        </Link>
                                        {i < country.cities.length - 1 && (
                                            <span className="text-black/20 mx-1.5 text-xs">·</span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Massive Animated Logo */}
                <div className="w-full flex justify-center mt-auto mb-8">
                    <svg
                        className="w-full h-auto text-[var(--landing-dark)]"
                        viewBox="0 0 1000 300"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        preserveAspectRatio="xMidYMid meet"
                    >
                        <text
                            x="50%"
                            y="75%"
                            textAnchor="middle"
                            fontFamily="system-ui, -apple-system, sans-serif"
                            fontWeight="900"
                            fontSize="260"
                            letterSpacing="-0.05em"
                            fill="currentColor"
                        >
                            Clorefy
                        </text>
                    </svg>
                </div>

                {/* Bottom bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-t border-black/10">
                    <div className="flex items-center gap-2.5">
                        <ClorefyLogo size={24} />
                        <span className="font-bold text-sm">Clorefy</span>
                    </div>
                    <p className="text-xs font-medium text-[var(--landing-text-dark)]/60">
                        © {new Date().getFullYear()} Clorefy. All rights reserved.
                    </p>
                    <Link
                        href="/clorefy-alternative-spellings"
                        className="text-xs font-medium text-[var(--landing-text-dark)]/60 hover:text-[var(--landing-amber)] transition-colors duration-200"
                    >
                        Alternative spellings
                    </Link>
                </div>
            </div>
        </footer>
    )
}

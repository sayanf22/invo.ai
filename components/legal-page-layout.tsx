"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { HamburgerMenu } from "@/components/hamburger-menu"

interface LegalPageLayoutProps {
    title: string
    lastUpdated: string
    children: React.ReactNode
}

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
    return (
        <div className="min-h-screen bg-background">
            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="w-8 h-8 flex items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div className="hidden sm:flex items-center gap-2">
                            <ClorefyLogo size={24} />
                            <span className="font-semibold text-sm">{title}</span>
                        </div>
                    </div>
                    <HamburgerMenu />
                </div>
            </div>
            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">{title}</h1>
                <p className="text-sm text-muted-foreground mb-10">Last updated: {lastUpdated}</p>
                <div className="prose prose-stone dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-p:leading-relaxed prose-li:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
                    {children}
                </div>
            </main>
            <footer className="border-t py-8 px-4 sm:px-6">
                <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
                    <p>© {new Date().getFullYear()} Clorefy. All rights reserved.</p>
                    <div className="flex gap-4">
                        <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                        <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                        <Link href="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
                        <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}

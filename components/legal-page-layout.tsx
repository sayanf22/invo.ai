"use client"

import Link from "next/link"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { LandingFooter } from "@/components/landing/landing-footer"
import { DownloadModalProvider } from "@/components/landing/download-modal"
import { SmoothScroller } from "@/components/smooth-scroller"

interface LegalPageLayoutProps {
    title: string
    lastUpdated: string
    children: React.ReactNode
}

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
    return (
        <DownloadModalProvider>
            <SmoothScroller>
                <div className="min-h-screen bg-[var(--landing-cream)] text-[var(--landing-text-dark)] font-sans antialiased">
                    <LandingNavbar />
                    <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-32 pb-20">
                        {/* Page header */}
                        <div className="mb-10 pb-8 border-b-[2px] border-[var(--landing-dark)]">
                            <h1
                                className="font-display text-4xl sm:text-5xl font-semibold tracking-tighter text-[var(--landing-text-dark)] mb-2 leading-[1.05]"
                                style={{ textShadow: "2px 2px 0px rgba(26,26,26,0.06)" }}
                            >
                                {title}
                            </h1>
                            <p className="text-sm text-[var(--landing-text-muted)]">Last updated: {lastUpdated}</p>
                        </div>
                        <div className="prose max-w-none text-[var(--landing-text-dark)]
                            [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-[var(--landing-text-dark)]
                            [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-[var(--landing-text-dark)]
                            [&_p]:text-[var(--landing-text-muted)] [&_p]:leading-relaxed [&_p]:mb-4 [&_p]:text-sm
                            [&_li]:text-[var(--landing-text-muted)] [&_li]:leading-relaxed [&_li]:text-sm
                            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:mb-4
                            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_ol]:mb-4
                            [&_a]:text-[var(--landing-amber)] [&_a]:font-semibold hover:[&_a]:underline
                            [&_strong]:text-[var(--landing-text-dark)] [&_strong]:font-semibold
                        ">
                            {children}
                        </div>
                    </main>
                    <LandingFooter />
                </div>
            </SmoothScroller>
        </DownloadModalProvider>
    )
}

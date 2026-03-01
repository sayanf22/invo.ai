"use client"

import { useEffect } from "react"
import { LandingNavbar } from "./landing-navbar"
import { HeroSection } from "./hero-section"
import { StatsSection } from "./stats-section"
import { PersonaTabs } from "./persona-tabs"
import { AIShowcase } from "./ai-showcase"
import { FeaturesSection } from "./features-section"
import { MultiDeviceSection } from "./multi-device"
import { TestimonialsSection } from "./testimonials-section"
import { CTASection } from "./cta-section"
import { LandingFooter } from "./landing-footer"
import { SmoothScroller } from "@/components/smooth-scroller"
import { CustomCursor } from "@/components/custom-cursor"

export function LandingPage() {
    // Add landing-page class to body for custom cursor CSS
    useEffect(() => {
        document.body.classList.add("landing-page")
        return () => {
            document.body.classList.remove("landing-page")
        }
    }, [])

    return (
        <SmoothScroller>
            <CustomCursor />
            <div className="min-h-screen bg-[var(--landing-cream)] text-[var(--landing-text-dark)] font-sans antialiased selection:bg-[var(--landing-amber)] selection:text-white">
                <LandingNavbar />
                <HeroSection />
                <StatsSection />
                <PersonaTabs />
                <AIShowcase />
                <FeaturesSection />
                <MultiDeviceSection />
                <TestimonialsSection />
                <CTASection />
                <LandingFooter />
            </div>
        </SmoothScroller>
    )
}

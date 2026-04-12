"use client"

import { LandingNavbar } from "./landing-navbar"
import { HeroSection } from "./hero-section"
import { StatsSection } from "./stats-section"
import { WhyNotChatGPT } from "./why-not-chatgpt"
import { PersonaTabs } from "./persona-tabs"
import { AIShowcase } from "./ai-showcase"
import { FeaturesSection } from "./features-section"
import { MultiDeviceSection } from "./multi-device"
import { TestimonialsSection } from "./testimonials-section"
import { CTASection } from "./cta-section"
import { LandingFooter } from "./landing-footer"
import { SmoothScroller } from "@/components/smooth-scroller"

export function LandingPage() {

    return (
        <SmoothScroller>
            <div className="min-h-screen bg-[var(--landing-cream)] text-[var(--landing-text-dark)] font-sans antialiased selection:bg-[var(--landing-amber)] selection:text-white">
                <LandingNavbar />
                <HeroSection />
                <StatsSection />
                <WhyNotChatGPT />
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

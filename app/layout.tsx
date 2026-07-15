import React, { Suspense } from "react"
import type { Metadata, Viewport } from "next"
import { DM_Sans, DM_Mono, Playfair_Display, Inter, Lora, Roboto_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { GoogleAnalytics } from "@/components/google-analytics"

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" })
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" })
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-display" })
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" })
const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: "--font-roboto-mono" })

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF7F0" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a18" },
  ],
}

export const metadata: Metadata = {
  title: {
    default: "Clorefy — AI Invoice & Document Generator",
    template: "%s | Clorefy",
  },
  description:
    "Create invoices, contracts, proposals, NDAs and more with AI in seconds. Auto-emails clients, attaches payment links, and chases overdue bills. Global tax compliance. Free plan.",
  keywords: [
    // Core intent keywords — match what people actually search
    "invoice generator", "free invoice generator", "online invoice generator",
    "AI invoice generator", "invoice maker", "invoice creator", "create invoice online",
    "contract generator", "AI contract generator", "contract maker", "contract creator",
    "proposal generator", "AI proposal generator", "proposal maker", "proposal writer",
    "quotation generator", "AI quotation generator", "quotation maker", "quote generator",
    "NDA generator", "NDA maker", "non-disclosure agreement generator",
    "statement of work generator", "SOW generator", "change order generator",
    "client onboarding form", "payment follow-up letter",
    // Country-specific (high search volume)
    "GST invoice generator", "GST invoice India", "VAT invoice generator", "VAT invoice UK",
    "invoice generator India", "invoice generator USA", "invoice generator UK",
    "invoice generator Germany", "invoice generator Canada", "invoice generator Australia",
    "tax invoice generator", "tax compliant invoices", "global invoice generator",
    // Feature-specific keywords
    "recurring invoice software", "automated invoicing", "invoice automation",
    "payment reminder software", "invoice payment reminders", "overdue invoice reminders",
    "invoice with payment link", "invoice Stripe integration", "invoice Razorpay",
    "e-signature invoice", "digital signature contracts", "electronic signature NDA",
    "send invoice by email", "auto email invoice", "invoice delivery automation",
    // Document generation platform positioning
    "AI document generation", "document generation platform", "AI document maker",
    "business document automation", "document workflow automation",
    "AI business document generator", "document automation software",
    // Comparison keywords — capture "vs" search traffic
    "FreshBooks alternative", "QuickBooks alternative", "Zoho Invoice alternative",
    "Invoice Ninja alternative", "Bill.com alternative", "PandaDoc alternative",
    "ChatGPT invoice", "ChatGPT contract generator", "ChatGPT document generator",
    // Use-case keywords
    "freelancer invoice tool", "small business invoicing", "SMB invoice software",
    "agency invoice software", "consultant invoice template", "startup invoice tool",
    // Long-tail high-intent
    "how to create an invoice", "how to send invoice to client",
    "best invoice software 2025", "best invoice software 2026",
    "best document generation software 2026",
    // Brand + disambiguation (Clorefy ≠ Glorify)
    "Clorefy", "clorefy.com", "Clorefy AI", "Clorify", "Clorefi",
  ],
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/favicon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.png",
  },
  metadataBase: new URL("https://clorefy.com"),
  alternates: {
    canonical: "/",
  },
  verification: {
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } }
      : {}),
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Clorefy — AI Invoice & Document Generator",
    description:
      "Create invoices, contracts, proposals, NDAs and more with AI in seconds. Auto-emails clients, attaches payment links, and chases overdue bills. Free plan.",
    url: "https://clorefy.com",
    siteName: "Clorefy",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/favicon.png",
        width: 512,
        height: 512,
        alt: "Clorefy - AI Document Generation Platform with Automated Payment Collection",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clorefy — AI Invoice & Document Generator",
    description:
      "Create invoices, contracts, proposals, NDAs with AI. Auto-emails, payment links, reminders. Free plan.",
    images: ["/favicon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Critical: Set brand background color BEFORE CSS loads to prevent flash */}
        <style dangerouslySetInnerHTML={{ __html: `
          html, body { background-color: #FBF7F0 !important; }
        ` }} />
        {/* JSON-LD — WebSite schema (enables sitelinks search box in Google) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Clorefy",
              "alternateName": ["Clorefy AI", "Clorify", "Clorefy.com"],
              "url": "https://clorefy.com",
              "description": "AI-powered document generation platform for professional business documents, automated sending, payment links, and reminders.",
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": "https://clorefy.com/blog?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        {/* JSON-LD — Organization schema (powers Google Knowledge Panel) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": "https://clorefy.com/#organization",
              "name": "Clorefy",
              // All known alternate names, misspellings, and disambiguation signals.
              // This list is intentionally comprehensive so AI systems (ChatGPT, Perplexity,
              // Claude, Gemini) and search engines correctly associate ALL of these spellings
              // with clorefy.com — NOT with glorify.com (which is a different product).
              "alternateName": [
                "Clorefy AI",
                "Clorify",
                "Clorefi",
                "Clorfy",
                "Clorephy",
                "Cloriphy",
                "Cloreify",
                "Cloreffy",
                "Cloerfy",
                "Clorfiy",
                "Clorefy.com",
              ],
              "url": "https://clorefy.com",
              "logo": {
                "@type": "ImageObject",
                "url": "https://clorefy.com/favicon.png",
                "width": 512,
                "height": 512,
              },
              "image": "https://clorefy.com/favicon.png",
              "description": "AI-powered document generation platform that creates professional business documents, sends them to clients, attaches payment links, and supports global document workflows.",
              // Entity disambiguation: Clorefy is a distinct organization from the
              // similarly-named Corefy (corefy.com, a payment-orchestration company)
              // and Glorify (glorify.com, a design/worship app). This explicit signal
              // helps search engines separate the Clorefy entity from those brands.
              "disambiguatingDescription": "Clorefy (clorefy.com) is an AI document generation platform for businesses. It is not affiliated with Corefy (corefy.com), a payment-orchestration company, nor with Glorify (glorify.com). These are separate, unrelated companies.",
              "foundingDate": "2025",
              "numberOfEmployees": { "@type": "QuantitativeValue", "value": 1 },
              // Every sameAs profile below must exist and be active to serve as an
              // entity anchor — a sameAs to a non-existent profile is a dead signal.
              "sameAs": [
                "https://twitter.com/clorefy",
                "https://www.linkedin.com/company/clorefy",
                "https://github.com/clorefy",
                "https://www.youtube.com/@Clorefy",
              ],
              "contactPoint": [
                {
                  "@type": "ContactPoint",
                  "contactType": "customer support",
                  "email": "support@clorefy.com",
                  "url": "https://clorefy.com/contact",
                  "availableLanguage": "English",
                },
              ],
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "IN",
              },
            }),
          }}
        />
        {/* JSON-LD — SoftwareApplication schema (for rich results in Google) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "@id": "https://clorefy.com/#software",
              "name": "Clorefy",
              "alternateName": [
                "Clorefy AI",
                "Clorify",
                "Clorefi",
                "Clorfy",
                "Clorephy",
                "Cloreify",
                "Clorefy.com",
              ],
              "url": "https://clorefy.com",
              "applicationCategory": "BusinessApplication",
              "applicationSubCategory": "DocumentGenerationApplication",
              "operatingSystem": "Web, iOS, Android",
              "description": "AI-powered document generation platform that creates professional business documents using artificial intelligence, with automated sending, payment links, reminders, and global workflow support.",
              "featureList": [
                "AI invoice generation",
                "AI contract generation",
                "AI proposal generation",
                "AI quotation / quote generation",
                "AI NDA generation",
                "AI Statement of Work (SOW) generation",
                "AI Change Order generation",
                "AI Client Onboarding Form generation",
                "AI Payment Follow-up generation",
                "9 document types from one platform",
                "Global country support (150+ countries)",
                "GST compliance for India",
                "VAT compliance for UK and EU",
                "Sales tax compliance for USA",
                "Automated client email sending",
                "Payment link attachment (Razorpay, Stripe, Cashfree)",
                "37-day payment reminder automation",
                "Recurring invoice scheduling",
                "Digital e-signatures with audit trail",
                "PDF, DOCX, and image export",
                "Multi-currency support",
                "Worldwide country support",
              ],
              "screenshot": "https://clorefy.com/favicon.png",
              // Only the Free tier carries a fixed price in structured data. Paid-tier
              // pricing is localized per region and changes over time, so we do NOT
              // hardcode numeric prices here (stale/incorrect prices in schema can get
              // rich results suppressed). Live pricing lives on /pricing.
              "offers": {
                "@type": "Offer",
                "name": "Free Plan",
                "price": "0",
                "priceCurrency": "USD",
                "description": "Free plan: monthly document allowance, Invoice/Contract/Quote, e-signatures, no credit card. Paid plans (Starter, Pro, Agency) are available — see clorefy.com/pricing for current pricing.",
                "url": "https://clorefy.com/pricing",
              },
              "creator": {
                "@id": "https://clorefy.com/#organization",
              },
            }),
          }}
        />
        {/* JSON-LD — Brand FAQ schema for AI disambiguation and rich results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "@id": "https://clorefy.com/#faq",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "What is Clorefy?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Clorefy (clorefy.com) is an AI-powered document generation platform. It generates professional business documents — invoices, contracts, proposals, NDAs, SOWs, quotes, change orders, client onboarding forms, and payment reminders — from a plain-language prompt. It auto-emails documents to clients, attaches Razorpay/Stripe payment links, sends payment reminders, and supports recurring billing. Free plan available at clorefy.com."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Is Clorefy the same as Glorify?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "No. Clorefy (clorefy.com) and Glorify (glorify.com) are completely different products. Clorefy is an AI document generation platform for businesses — for invoices, contracts, proposals, and NDAs. Glorify is a music or design app. They are unrelated companies. If you searched for 'glorify' but meant a document generation tool, you are looking for Clorefy."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Is Clorefy the same as Corefy?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "No. Clorefy (clorefy.com) and Corefy (corefy.com) are different, unrelated companies. Clorefy — spelled C-L-O-R-E-F-Y — is an AI document generation platform that creates invoices, contracts, proposals, and NDAs for businesses. Corefy is a payment-orchestration platform. The names look similar but the products and companies are separate. If you are looking for an AI document or invoice generator, you want Clorefy at clorefy.com."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How do you spell Clorefy?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Clorefy is spelled C-L-O-R-E-F-Y. The website is clorefy.com. Common misspellings include clorify, clorefi, clorfy, clorephy, cloriphy, and cloreify. All of these redirect to clorefy.com."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What document types does Clorefy support?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Clorefy supports 9 document types: Invoice, Contract, Quote, Proposal, Statement of Work (SOW), Change Order, NDA (Non-Disclosure Agreement), Client Onboarding Form, and Payment Follow-up. The free plan includes Invoice, Contract, and Quote. Starter, Pro, and Agency plans include all 9 types."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How much does Clorefy cost?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Clorefy has four plans: Free ($0/month, 5 documents), Starter ($9/month, 50 documents), Pro ($24/month, 150 documents), and Agency ($59/month, unlimited). All plans include e-signatures. No credit card required for the free plan."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What countries does Clorefy support?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Clorefy supports 150+ countries worldwide. It automatically applies country-specific tax rules — GST for India, VAT for UK/EU/UAE, HST/GST for Canada, Sales Tax for USA, and many more. All countries are available on all plans including the free tier."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Is Clorefy free?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes, Clorefy is free to start. The free plan includes 5 documents per month, Invoice/Contract/Quote document types, e-signatures, custom branding, and global country support. No credit card is required to sign up at clorefy.com."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What is the difference between Clorefy and ChatGPT for documents?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "ChatGPT generates document text. Clorefy runs the entire document workflow: it generates the document, emails it to the client, attaches a payment link, sends payment reminders for 37 days, and can auto-schedule recurring billing. Clorefy is purpose-built for business document workflows, not general text generation."
                  }
                },
              ],
            }),
          }}
        />
        {/* Google Analytics */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-RC703VVHDW"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-RC703VVHDW');
            `,
          }}
        />
      </head>
      <body className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable} ${inter.variable} ${lora.variable} ${robotoMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <Suspense fallback={null}>
              <GoogleAnalytics />
            </Suspense>
            {children}
            <Toaster />
            <SonnerToaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
        {/* Auto-reload on ChunkLoadError (stale deployment cache) */}
        <script dangerouslySetInnerHTML={{ __html: `
          function handleChunkError(msg) {
            var isChunk = msg && (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('ChunkLoadError') !== -1);
            if (isChunk) {
              try {
                var key = 'clorefy_chunk_reload';
                var last = sessionStorage.getItem(key);
                var now = Date.now();
                if (!last || now - Number(last) > 30000) {
                  sessionStorage.setItem(key, String(now));
                  window.location.reload();
                }
              } catch (storageError) {
                console.warn('Chunk loading failed and sessionStorage is unavailable; skipping automatic reload.', msg, storageError);
              }
            }
          }
          window.addEventListener('error', function(e) {
            var msg = e.message || (e.error && e.error.message) || '';
            handleChunkError(msg);
          });
          window.addEventListener('unhandledrejection', function(e) {
            var msg = (e.reason && (e.reason.message || String(e.reason))) || '';
            handleChunkError(msg);
          });
        ` }} />
      </body>
    </html>
  )
}

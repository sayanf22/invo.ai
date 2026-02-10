import React from "react"
import type { Metadata } from "next"
import { DM_Sans, DM_Mono } from "next/font/google"

import "./globals.css"
import { AuthProvider } from "@/components/auth-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" })
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Invo.ai - Intelligent Business Documents",
  description:
    "Create invoices, contracts, NDAs, and agreements with AI-powered precision. Fast, calm, and trustworthy.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${dmMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster position="bottom-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

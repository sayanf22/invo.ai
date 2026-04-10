import { LegalPageLayout } from "@/components/legal-page-layout"

export const metadata = { title: "About Us" }

export default function AboutPage() {
    return (
        <LegalPageLayout title="About Clorefy" lastUpdated="April 10, 2026">
            <h2>Who We Are</h2>
            <p>Clorefy is an AI-powered document generation platform that helps businesses create professional invoices, contracts, quotations, and proposals in seconds. Instead of spending hours formatting documents manually, users simply describe what they need in plain language, and our AI generates complete, compliant documents ready for review, editing, and export.</p>

            <h2>What We Do</h2>
            <p>We serve businesses of all sizes — freelancers, agencies, lawyers, sales teams, and enterprises — across 11 countries with country-specific tax compliance and legal formatting. Our platform supports:</p>
            <ul>
                <li><strong>Invoices</strong> with automatic tax calculations (GST, VAT, sales tax) for India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, and Netherlands</li>
                <li><strong>Contracts</strong> including service agreements, employment contracts, and NDAs</li>
                <li><strong>Quotations</strong> for price quotes, estimates, and bids</li>
                <li><strong>Proposals</strong> for business proposals, project proposals, and pitches</li>
            </ul>

            <h2>How It Works</h2>
            <ol>
                <li><strong>Sign up</strong> and complete a quick onboarding to set up your business profile</li>
                <li><strong>Describe your document</strong> in natural language — tell the AI what you need</li>
                <li><strong>Review and edit</strong> the generated document using our built-in editor</li>
                <li><strong>Export</strong> as PDF, DOCX, or image, or share via link for e-signatures</li>
            </ol>

            <h2>Our Mission</h2>
            <p>We believe every business deserves professional documentation without the overhead of expensive software or legal consultants. Clorefy democratizes access to compliant, well-formatted business documents through the power of AI.</p>

            <h2>Technology</h2>
            <p>Clorefy is built with modern, secure technology:</p>
            <ul>
                <li>AI-powered document generation using advanced language models</li>
                <li>Secure data storage with row-level security and encryption</li>
                <li>PCI-DSS compliant payment processing through Razorpay</li>
                <li>Global CDN for fast access worldwide</li>
            </ul>

            <h2>Contact</h2>
            <p>Have questions? Reach out to us:</p>
            <ul>
                <li>Email: <a href="mailto:support@clorefy.com">support@clorefy.com</a></li>
                <li>Website: <a href="https://clorefy.com">clorefy.com</a></li>
            </ul>
        </LegalPageLayout>
    )
}

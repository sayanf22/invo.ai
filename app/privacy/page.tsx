import { LegalPageLayout } from "@/components/legal-page-layout"

export const metadata = { title: "Privacy Policy" }

export default function PrivacyPage() {
    return (
        <LegalPageLayout title="Privacy Policy" lastUpdated="April 10, 2026">
            <h2>1. Introduction</h2>
            <p>Clorefy (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered document generation platform at <a href="https://clorefy.com">clorefy.com</a>.</p>

            <h2>2. Information We Collect</h2>
            <h3>2.1 Information You Provide</h3>
            <ul>
                <li><strong>Account Information:</strong> Name, email address, password when you create an account</li>
                <li><strong>Business Profile:</strong> Business name, type, address, tax IDs, contact details collected during onboarding</li>
                <li><strong>Document Content:</strong> Information you provide in prompts and the documents generated therefrom</li>
                <li><strong>Payment Information:</strong> Billing details processed securely through Razorpay (we do not store card details)</li>
            </ul>
            <h3>2.2 Information Collected Automatically</h3>
            <ul>
                <li><strong>Usage Data:</strong> Pages visited, features used, document types generated, session duration</li>
                <li><strong>Device Information:</strong> Browser type, operating system, IP address</li>
                <li><strong>Cookies:</strong> Authentication tokens and session management cookies</li>
            </ul>

            <h2>3. How We Use Your Information</h2>
            <ul>
                <li>To provide and maintain the Service, including AI document generation</li>
                <li>To personalize your experience and pre-fill business details in documents</li>
                <li>To process payments and manage subscriptions</li>
                <li>To communicate with you about your account, updates, and support</li>
                <li>To improve our AI models and Service quality (using anonymized, aggregated data only)</li>
                <li>To detect and prevent fraud, abuse, and security threats</li>
                <li>To comply with legal obligations</li>
            </ul>

            <h2>4. Data Storage and Security</h2>
            <p>Your data is stored securely on Supabase (PostgreSQL) with the following protections:</p>
            <ul>
                <li>Row Level Security (RLS) ensuring users can only access their own data</li>
                <li>Encrypted data transmission (TLS/SSL)</li>
                <li>Server-side JWT validation for all API requests</li>
                <li>Rate limiting to prevent abuse</li>
                <li>Regular security audits</li>
            </ul>

            <h2>5. Data Sharing</h2>
            <p>We do not sell your personal information. We may share data with:</p>
            <ul>
                <li><strong>Payment Processors:</strong> Razorpay for processing payments (subject to their privacy policy)</li>
                <li><strong>AI Service Providers:</strong> DeepSeek for document generation (prompts are processed but not stored by the provider)</li>
                <li><strong>Infrastructure Providers:</strong> Supabase for database hosting, Cloudflare for content delivery</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or government request</li>
            </ul>

            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information via your profile settings</li>
                <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
                <li><strong>Export:</strong> Download your documents in PDF, DOCX, or image format</li>
                <li><strong>Withdraw Consent:</strong> Opt out of non-essential data processing</li>
            </ul>
            <p>To exercise these rights, contact us at <a href="mailto:privacy@clorefy.com">privacy@clorefy.com</a>.</p>

            <h2>7. Cookies</h2>
            <p>We use essential cookies for authentication and session management. These are necessary for the Service to function and cannot be disabled. We do not use third-party tracking or advertising cookies.</p>

            <h2>8. Data Retention</h2>
            <p>We retain your data for as long as your account is active. Upon account deletion, we remove your personal data within 30 days, except where retention is required by law. Anonymized, aggregated data may be retained indefinitely for analytics.</p>

            <h2>9. Children&apos;s Privacy</h2>
            <p>The Service is not intended for users under 18 years of age. We do not knowingly collect personal information from children.</p>

            <h2>10. International Data Transfers</h2>
            <p>Your data may be processed in servers located outside your country of residence. We ensure appropriate safeguards are in place for such transfers.</p>

            <h2>11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically. We will notify you of material changes via email or through the Service.</p>

            <h2>12. Contact</h2>
            <p>For privacy-related inquiries, contact us at <a href="mailto:privacy@clorefy.com">privacy@clorefy.com</a> or visit our <a href="/contact">Contact page</a>.</p>
        </LegalPageLayout>
    )
}

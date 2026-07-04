import { LegalPageLayout } from "@/components/legal-page-layout"

export const metadata = { title: "Privacy Policy" }

export default function PrivacyPage() {
    return (
        <LegalPageLayout title="Privacy Policy" lastUpdated="July 5, 2026">
            <h2>1. Introduction</h2>
            <p>Clorefy (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is a global AI-powered document generation platform, used by businesses in India, the United States, the United Kingdom, the European Union, Canada, Australia, Singapore, the UAE, and many other countries. This Privacy Policy applies to all users of <a href="https://clorefy.com">clorefy.com</a> worldwide and explains how we collect, use, disclose, and safeguard your information. Section 11 sets out additional rights that apply if you are located in specific regions, such as the EEA/UK, California, or India.</p>

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
            <p>We do not sell or share your personal information for cross-context behavioral advertising. We may share data with:</p>
            <ul>
                <li><strong>Payment Processors:</strong> Razorpay for processing payments (subject to their privacy policy)</li>
                <li><strong>AI Service Providers:</strong> We generate documents using the DeepSeek and Kimi (Moonshot AI) foundation models, accessed through Amazon Web Services&apos; Amazon Bedrock service. Per AWS&apos;s published policy, Amazon Bedrock does not share your prompts or outputs with the underlying model providers and does not use them to train or improve any foundation model.</li>
                <li><strong>Infrastructure Providers:</strong> Supabase for database hosting, Amazon Web Services (Amazon Bedrock) for AI model hosting, and Cloudflare for hosting and content delivery</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or government request</li>
            </ul>

            <h2>6. Your Rights</h2>
            <p>Wherever you are located, you have the right to:</p>
            <ul>
                <li><strong>Access:</strong> Request a summary and copy of the personal data we hold about you</li>
                <li><strong>Correction:</strong> Update or correct inaccurate or incomplete information via your profile settings</li>
                <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
                <li><strong>Export:</strong> Download your documents in PDF, DOCX, or image format</li>
                <li><strong>Withdraw Consent:</strong> Withdraw your consent to data processing at any time — this is as easy as giving it</li>
            </ul>
            <p>To exercise these rights, contact us at <a href="mailto:info@clorefy.com">info@clorefy.com</a>. We respond to verified requests within the timelines required by applicable law. If you are in the EEA/UK, California, or India, Section 11 describes additional rights specific to your region.</p>

            <h2>7. Cookies</h2>
            <p>We use essential cookies for authentication and session management. These are necessary for the Service to function and cannot be disabled. We do not use third-party tracking or advertising cookies.</p>

            <h2>8. Data Retention</h2>
            <p>We retain your data for as long as your account is active. Upon account deletion, we remove your personal data within 30 days, except where retention is required by law. Anonymized, aggregated data may be retained indefinitely for analytics.</p>

            <h2>9. Children&apos;s Privacy</h2>
            <p>The Service is not intended for users under 18 years of age. We do not knowingly collect personal information from children.</p>

            <h2>10. International Data Transfers</h2>
            <p>Clorefy serves users globally, and your data may be processed in servers located outside your country of residence, including in the United States (where our AI and cloud infrastructure providers operate). Where required, we rely on appropriate safeguards for such transfers, such as Standard Contractual Clauses for transfers from the EEA/UK.</p>

            <h2>11. Region-Specific Rights</h2>
            <p>The rights below are in addition to, not instead of, the global rights described in Section 6.</p>

            <h3>11.1 European Economic Area &amp; United Kingdom (GDPR / UK GDPR)</h3>
            <p>If you are located in the EEA or UK, Clorefy is the <strong>data controller</strong> of your personal data. We process your data on the following legal bases: your <strong>consent</strong> (e.g., at sign-up), <strong>performance of a contract</strong> (providing the Service you signed up for), and our <strong>legitimate interests</strong> (e.g., security and fraud prevention). In addition to Section 6, you have the right to <strong>restrict or object</strong> to certain processing and the right to <strong>data portability</strong>. You may lodge a complaint with your local data protection supervisory authority at any time.</p>

            <h3>11.2 California, USA (CCPA/CPRA)</h3>
            <p>If you are a California resident, in addition to Section 6 you have the right to know the categories of personal information we collect and disclose, and the right to <strong>non-discrimination</strong> for exercising your privacy rights. We do not sell or share personal information as defined under the CCPA/CPRA, so no opt-out is required.</p>

            <h3>11.3 India (Digital Personal Data Protection Act, 2023)</h3>
            <p>If you are located in India, Clorefy acts as the <strong>Data Fiduciary</strong> and you are the <strong>Data Principal</strong> under the DPDP Act, 2023. We process your personal data based on the consent you give at sign-up (a clear affirmative action) or, where applicable, for legitimate uses permitted under the Act. You may withdraw consent at any time — it is as easy as giving it — by deleting your account or contacting our Grievance Officer below; this does not affect the lawfulness of processing carried out before withdrawal.</p>
            <p><strong>Grievance Officer:</strong> Email <a href="mailto:info@clorefy.com">info@clorefy.com</a>. We will acknowledge and respond to your grievance within the period prescribed under the DPDP Act and its Rules. If unresolved, you may lodge a complaint with the <strong>Data Protection Board of India</strong>.</p>

            <h2>12. Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically. We will notify you of material changes via email or through the Service.</p>

            <h2>13. Contact</h2>
            <p>For privacy-related inquiries, contact us at <a href="mailto:info@clorefy.com">info@clorefy.com</a> or visit our <a href="/contact">Contact page</a>.</p>
        </LegalPageLayout>
    )
}

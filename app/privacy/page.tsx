import { LegalPageLayout } from "@/components/legal-page-layout"

export const metadata = { title: "Privacy Policy" }

export default function PrivacyPage() {
    return (
        <LegalPageLayout title="Privacy Policy" lastUpdated="July 5, 2026">
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
                <li><strong>AI Service Providers:</strong> We generate documents using the DeepSeek and Kimi (Moonshot AI) models, which we access through Amazon Web Services (Amazon Bedrock). Your prompts are processed to produce your documents; they are not stored by Amazon Bedrock and are not used to train the underlying models.</li>
                <li><strong>Infrastructure Providers:</strong> Supabase for database hosting, Amazon Web Services (Amazon Bedrock) for AI model hosting, and Cloudflare for hosting and content delivery</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or government request</li>
            </ul>

            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
                <li><strong>Access:</strong> Request a summary and copy of the personal data we hold about you</li>
                <li><strong>Correction:</strong> Update or correct inaccurate or incomplete information via your profile settings</li>
                <li><strong>Deletion:</strong> Request deletion of your account and associated data (right to erasure)</li>
                <li><strong>Export:</strong> Download your documents in PDF, DOCX, or image format</li>
                <li><strong>Withdraw Consent:</strong> Withdraw your consent to data processing at any time — this is as easy as giving it (see Section 12)</li>
                <li><strong>Grievance Redressal:</strong> Raise a complaint about how your data is handled and receive a timely response</li>
                <li><strong>Nomination:</strong> Nominate another individual to exercise your rights in the event of death or incapacity</li>
            </ul>
            <p>To exercise these rights, contact us at <a href="mailto:info@clorefy.com">info@clorefy.com</a>. We respond to verified requests within the timelines required by applicable law.</p>

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

            <h2>12. India — Digital Personal Data Protection Act, 2023 (DPDP)</h2>
            <p>If you are located in India, the following applies to our processing of your personal data. For the purposes of the DPDP Act, 2023, Clorefy acts as the <strong>Data Fiduciary</strong> and you are the <strong>Data Principal</strong>.</p>
            <h3>12.1 Notice &amp; Purpose</h3>
            <p>We collect the personal data listed in Section 2 (such as your name, email, business profile, document content, and usage/device data) for the specific purposes described in Section 3 (providing the Service, generating documents, processing payments, communication, security, and legal compliance). We only process data for these stated, lawful purposes.</p>
            <h3>12.2 Consent &amp; Legal Basis</h3>
            <p>We process your personal data based on the consent you provide when you create an account and use the Service, and, where applicable, for &quot;legitimate uses&quot; permitted under the Act (such as fulfilling a service you requested or meeting a legal obligation). Your consent is free, specific, informed, unconditional, and unambiguous, given through a clear affirmative action at sign-up.</p>
            <h3>12.3 Withdrawing Consent</h3>
            <p>You may withdraw your consent at any time — it is as easy as giving it — by deleting your account from your account settings or by contacting our Grievance Officer below. Withdrawing consent does not affect the lawfulness of processing carried out before withdrawal. Once consent is withdrawn, we will stop processing your personal data and delete it within the timelines described in Section 8, unless retention is required by law.</p>
            <h3>12.4 Grievance Officer</h3>
            <p>If you have concerns about how your personal data is handled, you may contact our Grievance Officer:</p>
            <ul>
                <li><strong>Grievance Officer, Clorefy</strong></li>
                <li>Email: <a href="mailto:info@clorefy.com">info@clorefy.com</a></li>
            </ul>
            <p>We will acknowledge and respond to your grievance within the period prescribed under the DPDP Act and its Rules.</p>
            <h3>12.5 Complaint to the Data Protection Board of India</h3>
            <p>If your grievance is not resolved to your satisfaction, you have the right to lodge a complaint with the <strong>Data Protection Board of India</strong>, the authority established under the DPDP Act, 2023.</p>

            <h2>13. Contact</h2>
            <p>For privacy-related inquiries, contact us at <a href="mailto:info@clorefy.com">info@clorefy.com</a> or visit our <a href="/contact">Contact page</a>.</p>
        </LegalPageLayout>
    )
}

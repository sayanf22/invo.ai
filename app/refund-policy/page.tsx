import { LegalPageLayout } from "@/components/legal-page-layout"

export const metadata = { title: "Refund & Cancellation Policy" }

export default function RefundPolicyPage() {
    return (
        <LegalPageLayout title="Refund & Cancellation Policy" lastUpdated="April 10, 2026">
            <h2>1. Overview</h2>
            <p>Clorefy is a subscription-based SaaS (Software as a Service) platform for AI-powered document generation. This policy outlines the terms for cancellations, refunds, and billing adjustments.</p>

            <h2>2. Digital Service Delivery</h2>
            <p>Clorefy is a digital service delivered instantly upon subscription activation. There is no physical product or shipping involved. Access to the Service is granted immediately upon successful payment.</p>

            <h2>3. Free Tier</h2>
            <p>The Free tier requires no payment and can be used indefinitely within its limits (3 documents/month). No refund applies to the Free tier.</p>

            <h2>4. Subscription Cancellation</h2>
            <ul>
                <li>You may cancel your subscription at any time through your account settings (Billing &amp; Plans section)</li>
                <li>Upon cancellation, you retain access to your paid features until the end of your current billing period</li>
                <li>After the billing period ends, your account reverts to the Free tier</li>
                <li>Your existing documents and data are preserved and remain accessible</li>
                <li>Cancellation requests are processed within 1 business day</li>
            </ul>

            <h2>5. Refund Policy</h2>
            <h3>5.1 Monthly Subscriptions</h3>
            <ul>
                <li>Refund requests made within 7 days of the initial subscription purchase will be processed in full</li>
                <li>After 7 days, no refund is available for the current billing period, but you may cancel to prevent future charges</li>
                <li>Partial-month refunds are not provided</li>
            </ul>
            <h3>5.2 Yearly Subscriptions</h3>
            <ul>
                <li>Refund requests made within 14 days of the initial yearly subscription purchase will be processed in full</li>
                <li>After 14 days, a pro-rated refund may be issued for unused full months remaining, at our discretion</li>
            </ul>
            <h3>5.3 Non-Refundable Scenarios</h3>
            <ul>
                <li>Accounts terminated for violation of our Terms &amp; Conditions</li>
                <li>Dissatisfaction with AI-generated content quality (as stated in our Terms, AI output requires human review)</li>
                <li>Failure to cancel before the renewal date</li>
                <li>Partial usage of the subscription period</li>
            </ul>

            <h2>6. Refund Processing</h2>
            <ul>
                <li>Approved refunds will be processed within 5–7 business days</li>
                <li>Refunds are credited to the original payment method used during purchase</li>
                <li>Processing time may vary depending on your bank or payment provider</li>
                <li>All refunds are processed through Razorpay&apos;s secure refund system</li>
            </ul>

            <h2>7. How to Request a Refund</h2>
            <p>To request a refund:</p>
            <ol>
                <li>Email us at <a href="mailto:billing@clorefy.com">billing@clorefy.com</a> with your account email and reason for the refund</li>
                <li>Include your payment receipt or transaction ID</li>
                <li>Our team will review and respond within 2 business days</li>
            </ol>

            <h2>8. Plan Upgrades and Downgrades</h2>
            <ul>
                <li><strong>Upgrades:</strong> Take effect immediately. You are charged the pro-rated difference for the remainder of the billing period</li>
                <li><strong>Downgrades:</strong> Take effect at the start of the next billing period. No refund for the current period</li>
            </ul>

            <h2>9. Service Interruptions</h2>
            <p>In the event of extended service outages (exceeding 24 consecutive hours) caused by us, we may offer billing credits at our discretion. This does not apply to scheduled maintenance or force majeure events.</p>

            <h2>10. Contact</h2>
            <p>For billing or refund inquiries, contact us at <a href="mailto:billing@clorefy.com">billing@clorefy.com</a> or visit our <a href="/contact">Contact page</a>.</p>
        </LegalPageLayout>
    )
}

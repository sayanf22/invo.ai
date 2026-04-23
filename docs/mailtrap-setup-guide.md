# Mailtrap Email Integration — Setup Guide

This guide walks you through setting up Mailtrap for sending transactional emails from Clorefy (invoices, quotations, contracts, proposals, payment reminders).

Mailtrap is completely separate from your Supabase Auth SMTP. Supabase handles login/signup emails. Mailtrap handles document delivery emails. They don't interfere with each other.

---

## What You Need to Do (Checklist)

- [ ] Step 1: Create a Mailtrap account
- [ ] Step 2: Add and verify your sending domain (`clorefy.com`)
- [ ] Step 3: Get your API token
- [ ] Step 4: Give me the API token so I can integrate it

---

## Step 1: Create a Mailtrap Account

1. Go to https://mailtrap.io/register
2. Sign up with your Google, GitHub, or email
3. No credit card required for the free plan
4. After signup, you'll land on the Mailtrap dashboard

---

## Step 2: Add and Verify Your Sending Domain

This is the most important step. You need to prove to Mailtrap that you own `clorefy.com` so emails sent as `invoices@clorefy.com` are trusted by Gmail, Outlook, etc.

### 2a. Add the domain in Mailtrap

1. In the Mailtrap dashboard, go to **Email Sending** in the left sidebar
2. Click **Sending Domains**
3. Click **Add Domain**
4. Type: `clorefy.com`
5. Click **Add**

### 2b. Add DNS records in Cloudflare

After adding the domain, Mailtrap will show you DNS records to add. There are typically 5 records:

| Record Type | Purpose | What It Does |
|-------------|---------|-------------|
| CNAME | Domain Verification | Proves you own the domain |
| CNAME | DKIM (2 records) | Cryptographically signs your emails so recipients know they're legit |
| TXT | DMARC | Tells email providers what to do if authentication fails |
| CNAME | Custom Tracking Domain | Tracks opens/clicks through your domain instead of Mailtrap's |

To add these in Cloudflare:

1. Go to https://dash.cloudflare.com
2. Select `clorefy.com`
3. Click **DNS** in the left sidebar
4. Click **Add Record**
5. For each record Mailtrap shows you:
   - Copy the **Type** (CNAME or TXT)
   - Copy the **Name** (the part before your domain)
   - Copy the **Value** (the long string)
   - **IMPORTANT**: Turn OFF the orange cloud (proxy) — set it to **DNS only** (grey cloud) for all Mailtrap records. Cloudflare's proxy breaks CNAME verification.
6. Repeat for all 5 records

### 2c. Verify in Mailtrap

1. Go back to Mailtrap's Sending Domains page
2. Click **Re-check DNS Records**
3. Wait a few minutes — some records verify instantly, others take up to 1 hour
4. All dots should turn green (Verified)

If a record stays "Missing" after 1 hour:
- Double-check the Name and Value are copied exactly
- Make sure the Cloudflare proxy is OFF (grey cloud, not orange)
- DNS propagation can take up to 24 hours in rare cases

---

## Step 3: Get Your API Token

1. In the Mailtrap dashboard, go to **Settings** (gear icon in left sidebar)
2. Click **API Tokens**
3. You'll see an auto-generated token for your domain
4. Click the three-dot menu next to it and select **Copy**
5. This is your `MAILTRAP_API_KEY`

Alternatively, you can find it faster:
1. Go to **Email Sending** > **Sending Domains**
2. Click on your verified domain (`clorefy.com`)
3. Click **Integrate** on the Transactional Stream
4. Toggle to **API**
5. You'll see the API Token right there

The token looks something like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

---

## Step 4: What to Give Me

Once you've completed steps 1-3, provide me with:

1. **MAILTRAP_API_KEY** — the API token from Step 3
2. **Sender email address** — what "From" address you want on emails (e.g., `invoices@clorefy.com` or `no-reply@clorefy.com`)
3. **Sender name** — what name appears next to the email (e.g., `Clorefy`)

I will add the API key to your `.env` file and build the email sending integration. The key never gets committed to GitHub — it stays in `.env` which is gitignored.

---

## What I'll Build With It

Once you provide the details, I'll implement:

- `lib/mailtrap.ts` — email sending utility using Mailtrap's REST API (plain `fetch()`, no npm package needed)
- `POST /api/emails/send-invoice` — API route to send invoice/quotation/contract/proposal emails
- "Send" button in the document preview toolbar
- Email contains: branded HTML template, document summary, Pay Now link (for invoices with payment links), PDF attachment
- Delivery webhook handler to track sent/delivered/bounced/opened status
- Email history stored in Supabase for each document

---

## Free Plan Limits (What to Expect)

| Limit | Value | What It Means |
|-------|-------|--------------|
| Emails per month | 4,000 | Total emails you can send across all your users |
| Emails per day | 150 | Max emails in a single day |
| Sending domains | 1 | Only `clorefy.com` — that's all you need |
| Dashboard users | 1 | Only you can log into Mailtrap dashboard |
| Email log retention | 3 days | Delivery logs visible for 3 days (we'll store our own in Supabase) |
| API access | Full | REST API with all features |
| Webhooks | Full | Delivery, open, click, bounce, spam tracking |

When you outgrow the free plan, the Basic plan is $15/month for 10,000 emails/month.

---

## Common Issues and How to Avoid Them

### DNS records not verifying
- Make sure Cloudflare proxy is OFF (grey cloud) for all Mailtrap DNS records
- Wait at least 1 hour before troubleshooting
- Use https://dnschecker.org to verify records are propagated

### Emails going to spam
- Make sure ALL DNS records are verified (especially DKIM and DMARC)
- Don't include promotional content in transactional emails
- Keep subject lines short and professional
- Avoid excessive images or links

### 150/day limit hit
- This only matters when you have many active users
- Mitigation: queue emails and spread across the day
- Upgrade to $15/mo Basic plan when needed

### API token not working
- Make sure the token has "Domain Admin" permission for your domain
- Check that the domain is fully verified (all green dots)
- Tokens are case-sensitive — copy exactly

---

## Architecture Overview

```
User clicks "Send Invoice"
        ↓
Next.js API route: POST /api/emails/send-invoice
        ↓
Authenticates user (Supabase JWT)
        ↓
Generates HTML email from template
        ↓
Calls Mailtrap REST API: POST https://send.api.mailtrap.io/api/send
        ↓
Mailtrap delivers email to client's inbox
        ↓
Mailtrap webhook fires → POST /api/emails/webhook
        ↓
Store delivery status in Supabase (sent/delivered/bounced/opened)
```

This is completely independent from Supabase Auth SMTP. They run on different domains, different APIs, different credentials.

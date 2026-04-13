# Cloudflare R2 Storage Setup

## CORS Configuration

The `cors.json` file at the project root defines CORS rules for the `clorefy` R2 bucket, allowing browser-based uploads via presigned URLs.

Apply the CORS configuration to the bucket:

```bash
npx wrangler r2 bucket cors set clorefy --file cors.json
```

This allows `PUT`, `GET`, and `HEAD` requests from `https://clorefy.com` and `http://localhost:3000`, with a preflight cache of 3600 seconds.

## Environment Variables

The following environment variables are required for R2 access. Add them to `.env` (local dev) and as Cloudflare Worker secrets (production):

| Variable | Description |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare Account ID — found on the R2 overview page in the Cloudflare dashboard |
| `R2_ACCESS_KEY_ID` | R2 API token access key — create an R2 API token with "Object Read & Write" permission |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret — shown once when the token is created |
| `R2_BUCKET_NAME` | R2 bucket name (e.g., `clorefy`) — created in Cloudflare Dashboard > R2 |

For production, set these as Cloudflare Worker secrets:

```bash
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put R2_BUCKET_NAME
```

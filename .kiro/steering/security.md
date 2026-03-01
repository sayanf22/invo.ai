# Security Best Practices & Guidelines

## Current Security Implementation

### ✅ Implemented Security Measures

1. **Authentication**
   - All API routes use `authenticateRequest()` helper
   - Server-side JWT validation via Supabase `getUser()` (not `getSession()`)
   - Middleware handles auth redirects for protected routes

2. **Rate Limiting**
   - Postgres-based rate limiting (survives restarts, works across instances)
   - Category-based limits: AI (10/min), Export (20/min), General (30/min)
   - User-based tracking (requires authentication first)
   - Proper 429 responses with Retry-After headers

3. **Input Validation**
   - Body size limits (10KB-500KB depending on endpoint)
   - Prompt length limits (10,000 chars for AI routes)
   - Email format validation
   - Country code validation (whitelist approach)
   - Document type validation (whitelist approach)

4. **Security Headers** (next.config.mjs)
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Strict-Transport-Security (HSTS)
   - Content-Security-Policy (CSP)
   - X-XSS-Protection

5. **Database Security**
   - Row Level Security (RLS) policies on all tables
   - Supabase handles SQL injection prevention
   - Type-safe database operations via generated types

6. **Error Handling**
   - Sanitized error messages (never expose internals)
   - Consistent error response format
   - Logging for debugging without exposing to clients

### ⚠️ Security Improvements Needed

1. **CSRF Protection**
   - **Issue**: No CSRF tokens for state-changing operations
   - **Risk**: Attackers could trick authenticated users into making unwanted requests
   - **Solution**: Implement CSRF tokens for POST/PUT/DELETE operations
   - **Priority**: HIGH (especially for financial documents)

2. **IP-Based Rate Limiting**
   - **Issue**: Rate limiting only by user ID (requires auth)
   - **Risk**: Unauthenticated endpoints vulnerable to DDoS
   - **Solution**: Add IP-based rate limiting for public endpoints
   - **Priority**: MEDIUM

3. **Request Origin Validation**
   - **Issue**: No origin validation for API requests
   - **Risk**: Requests from unauthorized domains
   - **Solution**: Validate Origin/Referer headers
   - **Priority**: MEDIUM

4. **Input Sanitization**
   - **Issue**: No HTML/script sanitization for user inputs
   - **Risk**: Stored XSS if data displayed without escaping
   - **Solution**: Sanitize all user inputs before storage
   - **Priority**: HIGH

5. **API Key Rotation**
   - **Issue**: No mechanism for rotating DeepSeek/OpenAI keys
   - **Risk**: Compromised keys remain valid indefinitely
   - **Solution**: Implement key rotation strategy
   - **Priority**: LOW (manual process acceptable)

6. **Audit Logging**
   - **Issue**: Limited audit trail for sensitive operations
   - **Risk**: Difficult to track security incidents
   - **Solution**: Log all document generation, exports, signatures
   - **Priority**: MEDIUM

7. **Cost Protection**
   - **Issue**: No per-user spending limits for AI API calls
   - **Risk**: Single user could exhaust API credits
   - **Solution**: Track and limit AI spending per user/month
   - **Priority**: HIGH (financial impact)

## OWASP API Security Top 10 Compliance

### API1: Broken Object Level Authorization (BOLA)
**Status**: ✅ PROTECTED
- RLS policies enforce user ownership
- All document queries filtered by user_id
- Signature tokens validated before access

### API2: Broken Authentication
**Status**: ✅ PROTECTED
- Supabase handles authentication
- JWT validation on every request
- No custom auth logic (reduces attack surface)

### API3: Broken Object Property Level Authorization
**Status**: ⚠️ PARTIAL
- Need to validate which fields users can update
- Add field-level permissions for sensitive data

### API4: Unrestricted Resource Consumption
**Status**: ⚠️ PARTIAL
- Rate limiting implemented
- **Missing**: Per-user cost limits for AI calls
- **Missing**: Maximum document size limits

### API5: Broken Function Level Authorization
**Status**: ✅ PROTECTED
- All routes require authentication
- Role-based access via RLS policies

### API6: Unrestricted Access to Sensitive Business Flows
**Status**: ⚠️ NEEDS IMPROVEMENT
- **Missing**: CSRF protection
- **Missing**: Transaction limits (e.g., max invoices per day)

### API7: Server Side Request Forgery (SSRF)
**Status**: ✅ PROTECTED
- No user-controlled URLs
- External API calls only to whitelisted endpoints (DeepSeek, OpenAI)

### API8: Security Misconfiguration
**Status**: ✅ GOOD
- Security headers configured
- TypeScript strict mode enabled
- Environment variables properly managed

### API9: Improper Inventory Management
**Status**: ✅ GOOD
- All API routes documented in structure.md
- Clear endpoint inventory

### API10: Unsafe Consumption of APIs
**Status**: ✅ PROTECTED
- External API responses validated
- Error handling for third-party failures
- Timeout handling implemented

## Required Security Enhancements

### 1. CSRF Protection (HIGH PRIORITY)

Add CSRF token validation for all state-changing operations:

```typescript
// lib/csrf.ts
import { randomBytes } from 'crypto'

export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex')
}

export function validateCSRFToken(token: string, sessionToken: string): boolean {
  return token === sessionToken && token.length === 64
}
```

### 2. Cost Protection (HIGH PRIORITY)

Track AI API spending per user:

```typescript
// Add to database schema
CREATE TABLE user_usage (
  user_id UUID REFERENCES auth.users(id),
  month TEXT, -- 'YYYY-MM'
  ai_requests_count INT DEFAULT 0,
  ai_tokens_used INT DEFAULT 0,
  estimated_cost_usd DECIMAL(10,4) DEFAULT 0,
  PRIMARY KEY (user_id, month)
);

// Add spending limit check before AI calls
const MONTHLY_LIMIT_USD = 50.00
```

### 3. Input Sanitization (HIGH PRIORITY)

Sanitize all user inputs:

```typescript
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  })
}
```

### 4. Audit Logging (MEDIUM PRIORITY)

Log all sensitive operations:

```typescript
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Security Testing Checklist

- [ ] Test rate limiting with automated requests
- [ ] Verify RLS policies prevent cross-user access
- [ ] Test input validation with malicious payloads
- [ ] Verify CSRF protection on all POST/PUT/DELETE
- [ ] Test authentication bypass attempts
- [ ] Verify error messages don't leak sensitive info
- [ ] Test file upload size limits
- [ ] Verify API key validation and error handling
- [ ] Test SQL injection attempts (should be blocked by Supabase)
- [ ] Verify XSS protection in document preview

## Deployment Security

### Environment Variables
- Never commit `.env` or `.env.local` files
- Use Vercel/hosting platform secrets management
- Rotate API keys quarterly
- Use different keys for dev/staging/production

### Monitoring
- Set up alerts for:
  - Rate limit violations
  - Failed authentication attempts
  - Unusual AI API spending
  - Database errors
  - 5xx error rates

### Incident Response
1. Rotate compromised API keys immediately
2. Review audit logs for unauthorized access
3. Notify affected users if data breach
4. Document incident and remediation steps

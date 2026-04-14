import { SignJWT, jwtVerify } from 'jose'

export interface AdminSessionPayload {
  email: string
  iat: number
  exp: number
}

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not set')
  return new TextEncoder().encode(secret)
}

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean)
}

/**
 * Verify the admin_session cookie JWT from a Request.
 * Returns the admin email on success, null on any failure.
 */
export async function verifyAdminSession(request: Request): Promise<string | null> {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/)
    if (!match) return null

    const token = match[1]
    const { payload } = await jwtVerify(token, getSecret())
    const email = (payload as unknown as AdminSessionPayload).email

    if (!email || !getAdminEmails().includes(email)) return null

    return email
  } catch {
    return null
  }
}

/**
 * Create a signed JWT for an admin session (1 hour TTL).
 */
export async function createAdminSessionToken(email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(getSecret())
}

/**
 * Server component helper — verifies the admin session cookie.
 * Calls notFound() if verification fails, otherwise returns the admin email.
 */
export async function requireAdmin(): Promise<string> {
  const { cookies } = await import('next/headers')
  const { notFound } = await import('next/navigation')

  const cookieStore = await cookies()
  const token = cookieStore.get('admin_session')?.value

  if (!token) return notFound()

  try {
    const { payload } = await jwtVerify(token, getSecret())
    const email = (payload as unknown as AdminSessionPayload).email

    if (!email || !getAdminEmails().includes(email)) return notFound()

    return email
  } catch {
    return notFound()
  }
}

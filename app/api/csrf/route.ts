/**
 * CSRF Token Endpoint
 * 
 * GET /api/csrf — Returns a fresh CSRF token for the authenticated user's session.
 * The token is bound to the user's session ID and expires after 1 hour.
 */

import { authenticateRequest } from "@/lib/api-auth"
import { generateCSRFResponse } from "@/lib/csrf"

export async function GET(request: Request) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { user } = auth
    return generateCSRFResponse(user.id)
}

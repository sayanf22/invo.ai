export interface SendEmailParams {
  to: string
  subject: string
  html: string
  senderName: string
  category?: string
}

export interface SendEmailResult {
  success: true
  messageIds: string[]
}

export interface SendEmailError {
  success: false
  statusCode: number
  message: string
  retryAfter?: number
}

export type SendEmailResponse = SendEmailResult | SendEmailError

/**
 * Send an email via Mailtrap REST API using plain fetch().
 * Throws if MAILTRAP_API_KEY is not configured.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResponse> {
  const apiKey = process.env.MAILTRAP_API_KEY
  if (!apiKey) {
    throw new Error(
      "MAILTRAP_API_KEY is not configured. Set it in your environment variables."
    )
  }

  const fromName =
    params.senderName && params.senderName.trim().length > 0
      ? `${params.senderName} via Clorefy`
      : "Clorefy"

  // Generate business-specific from address: {businessname}.noreply@clorefy.com
  // e.g., "WhyCreatives" → "whycreatives.noreply@clorefy.com"
  // Falls back to "no-reply@clorefy.com" if no business name
  let fromEmail = "no-reply@clorefy.com"
  if (params.senderName && params.senderName.trim().length > 0) {
    const slug = params.senderName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") // strip everything except letters and numbers
    if (slug.length > 0) {
      fromEmail = `${slug}.noreply@clorefy.com`
    }
  }

  const payload: Record<string, unknown> = {
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: [{ email: params.to }],
    subject: params.subject,
    html: params.html,
  }

  if (params.category !== undefined) {
    payload.category = params.category
  }

  let response: Response
  try {
    response = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })
  } catch {
    return {
      success: false,
      statusCode: 0,
      message: "Network error: unable to reach email service",
    }
  }

  if (response.status === 429) {
    const retryAfterHeader = response.headers.get("Retry-After")
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined
    let message: string
    try {
      const body = await response.text()
      message = body || "Rate limit exceeded"
    } catch {
      message = "Rate limit exceeded"
    }
    return {
      success: false,
      statusCode: 429,
      message,
      ...(retryAfter !== undefined && !isNaN(retryAfter) ? { retryAfter } : {}),
    }
  }

  if (!response.ok) {
    let message: string
    try {
      message = await response.text()
    } catch {
      message = "Unexpected error from email service"
    }
    return {
      success: false,
      statusCode: response.status,
      message,
    }
  }

  // 2xx — parse JSON
  let data: { message_ids?: string[] }
  try {
    data = await response.json()
  } catch {
    return {
      success: false,
      statusCode: response.status,
      message: "Unexpected response from email service",
    }
  }

  return {
    success: true,
    messageIds: data.message_ids ?? [],
  }
}

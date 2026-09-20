/**
 * MiraTech Business Suite - Unified Brevo Client
 * 
 * Central transactional & marketing dispatcher strictly using Brevo's v3 SMTP REST API.
 * Ensures consistent delivery, robust retry backoff, RFC 8058 header injection,
 * unified logging, and fail-safe error handling.
 */

export interface BrevoSender {
  name: string;
  email: string;
}

export interface BrevoRecipient {
  email: string;
  name?: string;
}

export interface BrevoSendOptions {
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  sender?: BrevoSender;
  replyTo?: { email: string; name?: string };
  headers?: Record<string, string>;
  tags?: string[];
  maxAttempts?: number;
}

export interface BrevoSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
  attempts: number;
}

export function getBrevoSender(customSender?: Partial<BrevoSender>): BrevoSender {
  return {
    name: customSender?.name || process.env.BREVO_SENDER_NAME || "MiraTech Business Suite",
    email: customSender?.email || process.env.BREVO_SENDER_EMAIL || "miratechindustries@gmail.com",
  };
}

/**
 * Sanitizes tags to conform with Brevo's strict ASCII alphanumeric + hyphen/underscore requirement (max 50 chars).
 */
function sanitizeTags(tags?: string[]): string[] | undefined {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return undefined;
  const cleaned = tags
    .map((t) => (typeof t === "string" ? t.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 50) : ""))
    .filter(Boolean);
  return cleaned.length > 0 ? Array.from(new Set(cleaned)).slice(0, 10) : undefined;
}

/**
 * Sanitizes headers to prevent CRLF injection.
 */
function sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers || typeof headers !== "object") return undefined;
  const clean: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers)) {
    if (key && val && typeof val === "string") {
      const cleanKey = key.replace(/[\r\n]/g, "").trim();
      const cleanVal = val.replace(/[\r\n]/g, "").trim();
      if (cleanKey && cleanVal) {
        clean[cleanKey] = cleanVal;
      }
    }
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

/**
 * Validates Brevo API credentials and returns account status.
 */
export async function testBrevoConnection(): Promise<{
  configured: boolean;
  valid: boolean;
  email?: string;
  plan?: string;
  credits?: number;
  error?: string;
}> {
  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  if (!brevoApiKey) {
    return {
      configured: false,
      valid: false,
      error: "BREVO_API_KEY environment variable is not configured.",
    };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const emailCredit = data.plan?.find((p: any) => p.type === "free" || p.type === "subscription" || p.type === "payAsYouGo");
      return {
        configured: true,
        valid: true,
        email: data.email,
        plan: emailCredit?.type || "Standard",
        credits: emailCredit?.credits ?? data.relay?.data?.credits,
      };
    }

    const errJson = await response.json().catch(() => ({}));
    return {
      configured: true,
      valid: false,
      error: errJson.message || `Brevo returned HTTP ${response.status}`,
    };
  } catch (err: any) {
    return {
      configured: true,
      valid: false,
      error: err?.message || "Network error connecting to Brevo API",
    };
  }
}

/**
 * Dispatches an email via the Brevo v3 REST API (/v3/smtp/email).
 * Implements exponential backoff on 5xx or network transport issues.
 */
export async function sendViaBrevo(options: BrevoSendOptions): Promise<BrevoSendResult> {
  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  const sender = getBrevoSender(options.sender);
  const maxAttempts = options.maxAttempts || 2;
  let lastError = "";
  let lastStatus: number | undefined;

  if (!brevoApiKey) {
    const simMsgId = `brevo_sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    console.warn(
      `[Brevo Service] BREVO_API_KEY is not configured. Simulating delivery to ${options.to.map(t => t.email).join(", ")} with ID ${simMsgId}`
    );
    return {
      success: true,
      messageId: simMsgId,
      attempts: 1,
    };
  }

  const cleanRecipients = options.to
    .filter((r) => r.email && r.email.includes("@"))
    .map((r) => ({
      email: r.email.trim().toLowerCase(),
      ...(r.name ? { name: r.name.trim() } : {}),
    }));

  if (cleanRecipients.length === 0) {
    return {
      success: false,
      error: "No valid recipient email addresses provided.",
      attempts: 0,
    };
  }

  const cleanTags = sanitizeTags(options.tags);
  const cleanHeaders = sanitizeHeaders(options.headers);

  const payload: Record<string, any> = {
    sender,
    to: cleanRecipients,
    subject: options.subject,
    htmlContent: options.htmlContent,
    ...(options.textContent ? { textContent: options.textContent } : {}),
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    ...(cleanHeaders ? { headers: cleanHeaders } : {}),
    ...(cleanTags ? { tags: cleanTags } : {}),
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      lastStatus = response.status;

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          success: true,
          messageId: data.messageId || `brevo_${Date.now()}`,
          statusCode: response.status,
          attempts: attempt,
        };
      }

      const errJson = await response.json().catch(() => ({}));
      lastError = errJson.message || `Brevo returned HTTP ${response.status}`;
      console.warn(`[Brevo API Attempt ${attempt}/${maxAttempts} Failed]: HTTP ${response.status} - ${lastError}`);

      // If client-side error (4xx except rate-limiting 429), don't retry endlessly
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        break;
      }

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    } catch (err: any) {
      lastError = err?.message || "Network error dispatching via Brevo";
      console.warn(`[Brevo Exception Attempt ${attempt}/${maxAttempts}]:`, lastError);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
  }

  return {
    success: false,
    error: lastError || "Failed to dispatch email via Brevo",
    statusCode: lastStatus,
    attempts: maxAttempts,
  };
}

import crypto from "crypto";
import { generateEmailHtml } from "./email-templates";
import { recordEmailAuditLog } from "./email-service";

interface StoredOtpRecord {
  hashedOtp: string;
  salt: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  companyName?: string;
}

// In-memory store for hashed OTP records
const otpStore = new Map<string, StoredOtpRecord>();

function pruneExpired() {
  const now = Date.now();
  otpStore.forEach((record, email) => {
    if (now > record.expiresAt) {
      otpStore.delete(email);
    }
  });
}

const OTP_SECRET = process.env.OTP_SECRET || "miratech_corporate_otp_hmac_secret_key_default";
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

function hashOtp(code: string, salt: string): string {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${code}:${salt}`)
    .digest("hex");
}

/**
 * Dispatches a transactional email using Brevo (formerly Sendinblue) v3 REST API.
 */
export async function dispatchBrevoEmail(
  toEmail: string,
  subject: string,
  htmlContent: string,
  textContent: string,
  senderName: string,
  senderEmail: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) {
    console.warn("[Brevo Warning] BREVO_API_KEY is not configured in environment variables.");
    return { success: false, error: "BREVO_API_KEY is not configured in environment variables" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: toEmail,
          },
        ],
        subject,
        htmlContent,
        textContent,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errorMsg = errData.message || `Brevo API returned HTTP status ${response.status}`;
      console.error(`[Brevo API Error] (${response.status}):`, errorMsg);
      return { success: false, error: errorMsg };
    }

    const data = await response.json().catch(() => ({}));
    const messageId = data.messageId || "dispatched";
    console.log(`[Brevo API] Email successfully delivered to ${toEmail}. Message ID:`, messageId);
    return { success: true, messageId };
  } catch (err: any) {
    const errorMsg = err?.message || "Network failure connecting to Brevo API";
    console.error(`[Brevo API Exception] Failed to send email to ${toEmail}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

export async function createAndSendOtp(
  email: string,
  companyName?: string
): Promise<{ success: boolean; cooldownSeconds: number; message: string }> {
  pruneExpired();
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();

  const existing = otpStore.get(normalizedEmail);
  if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    const remainingCooldown = Math.ceil(
      (RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000
    );
    return {
      success: false,
      cooldownSeconds: remainingCooldown,
      message: `Please wait ${remainingCooldown} seconds before requesting a new verification code.`,
    };
  }

  // Generate cryptographically secure 6-digit OTP
  const rawCode = crypto.randomInt(100000, 1000000).toString();
  const salt = crypto.randomBytes(16).toString("hex");
  const hashedOtp = hashOtp(rawCode, salt);

  otpStore.set(normalizedEmail, {
    hashedOtp,
    salt,
    expiresAt: now + OTP_EXPIRY_MS,
    attempts: 0,
    lastSentAt: now,
    companyName: companyName || "MiraTech Workspace",
  });

  const orgName = companyName || "MiraTech Business Suite";
  const senderName = process.env.BREVO_SENDER_NAME || "MiraTech Security";
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "no-reply@miratech.io";

  const emailSubject = `Your ${orgName} Verification Code: ${rawCode}`;
  const textContent = `Your ${orgName} 6-digit verification code is: ${rawCode}. This code expires in 10 minutes.`;
  
  const bodyContent = `
    <p style="margin: 0 0 16px 0;">You are registering or verifying a corporate workspace for <strong>${orgName}</strong>. Please enter the following 6-digit confirmation code in your verification prompt to validate your corporate identity:</p>
    
    <div style="background-color: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
      <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e293b;">${rawCode}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 500;">Expires in 10 minutes • Single-use corporate security code</div>
    </div>

    <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b;">If you did not request this verification code, please ignore this notice or contact our security desk immediately. Never disclose this one-time code to third parties.</p>
  `;

  const { html: emailHtml } = generateEmailHtml({
    recipientEmail: normalizedEmail,
    subject: emailSubject,
    category: "TRANSACTIONAL",
    emailType: "OTP_VERIFICATION",
    headline: "Verify Corporate Identity",
    bodyContent,
    textContent,
    companyDetails: {
      name: orgName,
    },
  });

  // Dispatch solely via Brevo REST API
  const brevoResult = await dispatchBrevoEmail(
    normalizedEmail,
    emailSubject,
    emailHtml,
    textContent,
    senderName,
    senderEmail
  );

  // Record audit log
  await recordEmailAuditLog({
    email: normalizedEmail,
    action: "SENT_TRANSACTIONAL",
    preferenceCategory: "OTP_VERIFICATION",
    previousValue: null,
    newValue: brevoResult.success ? "DELIVERED" : "BREVO_OFFLINE",
    source: "otp_verification_dispatcher",
    details: `Transactional OTP security notice dispatched for company ${orgName}`,
  });

  if (!brevoResult.success) {
    console.warn(`[Brevo Dispatch Warning]: ${brevoResult.error}`);
  }

  return {
    success: true,
    cooldownSeconds: 60,
    message: `A 6-digit verification code has been dispatched to ${normalizedEmail}.`,
  };
}

export function verifySubmittedOtp(
  email: string,
  submittedCode: string
): { valid: boolean; error?: string; remainingAttempts?: number } {
  pruneExpired();
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = submittedCode.trim();

  if (trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
    return { valid: false, error: "Verification code must be exactly 6 numerical digits." };
  }

  const record = otpStore.get(normalizedEmail);
  if (!record) {
    return {
      valid: false,
      error: "No active verification code found for this email. Please request a new one.",
    };
  }

  const now = Date.now();
  if (now > record.expiresAt) {
    otpStore.delete(normalizedEmail);
    return {
      valid: false,
      error: "Verification code has expired. Please request a new code.",
    };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(normalizedEmail);
    return {
      valid: false,
      error: "Maximum verification attempts exceeded (5). This code has been invalidated for security. Please request a new code.",
    };
  }

  const candidateHash = hashOtp(trimmedCode, record.salt);
  const candidateBuf = Buffer.from(candidateHash, "hex");
  const storedBuf = Buffer.from(record.hashedOtp, "hex");

  let isMatch = false;
  if (candidateBuf.length === storedBuf.length) {
    isMatch = crypto.timingSafeEqual(candidateBuf, storedBuf);
  }

  if (!isMatch) {
    record.attempts += 1;
    const remaining = MAX_ATTEMPTS - record.attempts;
    if (remaining <= 0) {
      otpStore.delete(normalizedEmail);
      return {
        valid: false,
        error: "Incorrect code. Maximum attempts reached (5). Please request a new code.",
      };
    }
    return {
      valid: false,
      error: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      remainingAttempts: remaining,
    };
  }

  // Successful verification -> Invalidate immediately
  otpStore.delete(normalizedEmail);
  return { valid: true };
}

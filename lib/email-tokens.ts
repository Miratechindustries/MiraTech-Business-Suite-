import crypto from "crypto";

const TOKEN_SECRET =
  process.env.EMAIL_TOKEN_SECRET ||
  process.env.OTP_SECRET ||
  "miratech_suite_email_token_master_encryption_key_2026_aes256";

// Derive 32-byte key for AES-256-GCM
const CIPHER_KEY = crypto.createHash("sha256").update(TOKEN_SECRET).digest();

export interface UnsubscribeTokenPayload {
  email: string;
  userId?: string;
  companyId?: string;
  category?: string;
  iat: number;
}

/**
 * Encrypts email and metadata into a secure, tamper-proof URL-safe token.
 * Raw email address is NEVER exposed in the URL.
 */
export function generateUnsubscribeToken(data: {
  email: string;
  userId?: string;
  companyId?: string;
  category?: string;
}): string {
  const normalizedEmail = data.email.trim().toLowerCase();
  const payload: UnsubscribeTokenPayload = {
    email: normalizedEmail,
    userId: data.userId || "",
    companyId: data.companyId || "",
    category: data.category || "ALL",
    iat: Date.now(),
  };

  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", CIPHER_KEY, iv);
  
  const jsonStr = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(jsonStr, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine IV (12 bytes) + Tag (16 bytes) + Encrypted Payload
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString("base64url");
}

/**
 * Decrypts and verifies a token. Throws or returns null if tampered, corrupted, or invalid.
 */
export function verifyUnsubscribeToken(token: string): UnsubscribeTokenPayload | null {
  try {
    if (!token || typeof token !== "string") return null;

    const combined = Buffer.from(token, "base64url");
    if (combined.length < 28) return null; // 12 bytes IV + 16 bytes Tag = 28 bytes minimum

    const iv = combined.subarray(0, 12);
    const tag = combined.subarray(12, 28);
    const encrypted = combined.subarray(28);

    const decipher = crypto.createDecipheriv("aes-256-gcm", CIPHER_KEY, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const payload = JSON.parse(decrypted.toString("utf8")) as UnsubscribeTokenPayload;

    if (!payload.email || typeof payload.email !== "string" || !payload.email.includes("@")) {
      return null;
    }

    return payload;
  } catch (err) {
    // Authentication tag mismatch or invalid payload
    return null;
  }
}

/**
 * Computes deterministic document ID for email preferences in Firestore.
 */
export function getEmailPreferenceDocId(email: string): string {
  const normalized = email.trim().toLowerCase();
  return crypto.createHash("sha256").update(`email_pref:${normalized}`).digest("hex").slice(0, 32);
}

/**
 * Generates all public links needed for an email footer.
 */
export function getEmailGovernanceUrls(params: {
  email: string;
  companyId?: string;
  userId?: string;
  baseUrl?: string;
}) {
  const token = generateUnsubscribeToken({
    email: params.email,
    companyId: params.companyId,
    userId: params.userId,
  });

  const base =
    params.baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://miratechsuite.com");

  // Normalized clean base url without trailing slash
  const cleanBase = base.replace(/\/+$/, "");

  return {
    token,
    unsubscribeUrl: `${cleanBase}/unsubscribe?token=${token}`,
    preferencesUrl: `${cleanBase}/email-preferences?token=${token}`,
    oneClickApiUrl: `${cleanBase}/api/email/unsubscribe?token=${token}`,
    privacyUrl: `${cleanBase}/privacy`,
    termsUrl: `${cleanBase}/terms`,
    supportEmail: "miratechindustries@gmail.com",
  };
}

import { adminDb } from "./firebase-admin";
import { getEmailPreferenceDocId, getEmailGovernanceUrls } from "./email-tokens";
import { generateEmailHtml } from "./email-templates";
import { sendViaBrevo, getBrevoSender } from "./brevo-client";
import {
  EmailCategory,
  EmailDispatchPayload,
  EmailPreferenceRecord,
  EmailSendResult,
  MarketingEmailType,
  TransactionalEmailType,
  EmailAuditLogRecord,
} from "./email-types";

const EMAIL_PREFERENCES_COLLECTION = "email_preferences";
const EMAIL_AUDIT_COLLECTION = "email_audit_logs";

/**
 * Returns default email preferences for a recipient.
 */
export function getDefaultEmailPreferences(
  email: string,
  userId?: string,
  companyId?: string
): EmailPreferenceRecord {
  const normalized = email.trim().toLowerCase();
  const now = new Date().toISOString();
  return {
    id: getEmailPreferenceDocId(normalized),
    userId: userId || "",
    companyId: companyId || "",
    email: normalized,
    marketingEnabled: true,
    productUpdatesEnabled: true,
    newsletterEnabled: true,
    featureAnnouncementsEnabled: true,
    educationalContentEnabled: true,
    promotionalOffersEnabled: true,
    unsubscribedAt: null,
    unsubscribeSource: null,
    consentTimestamp: now,
    consentSource: "implicit_commercial",
    updatedAt: now,
  };
}

/**
 * Immediately queries Firestore to retrieve the fresh, non-cached email preferences
 * for the specified email address.
 */
export async function getFreshEmailPreferences(
  email: string,
  userId?: string,
  companyId?: string
): Promise<EmailPreferenceRecord> {
  const normalized = email.trim().toLowerCase();
  const docId = getEmailPreferenceDocId(normalized);

  try {
    const docRef = adminDb.collection(EMAIL_PREFERENCES_COLLECTION).doc(docId);
    const snap = await docRef.get();

    if (snap && snap.exists && snap.data) {
      const data = snap.data();
      return {
        ...getDefaultEmailPreferences(normalized, userId, companyId),
        ...data,
        email: normalized,
        id: docId,
      };
    }

    // Also check if stored by userId if provided
    if (userId) {
      const userQuery = await adminDb
        .collection(EMAIL_PREFERENCES_COLLECTION)
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (userQuery && !userQuery.empty && userQuery.docs.length > 0) {
        const uData = userQuery.docs[0].data();
        return {
          ...getDefaultEmailPreferences(normalized, userId, companyId),
          ...uData,
          email: normalized,
          id: userQuery.docs[0].id,
        };
      }
    }
  } catch (err) {
    console.error("[EmailService Error] Failed to read email preferences:", err);
  }

  // Fallback to default preferences
  return getDefaultEmailPreferences(normalized, userId, companyId);
}

/**
 * Verifies whether a specific marketing sub-category is allowed for the recipient.
 */
export function isMarketingCategoryPermitted(
  prefs: EmailPreferenceRecord,
  emailType: MarketingEmailType
): boolean {
  if (!prefs.marketingEnabled) {
    return false;
  }

  switch (emailType) {
    case "PRODUCT_UPDATES":
      return prefs.productUpdatesEnabled;
    case "NEWSLETTER":
      return prefs.newsletterEnabled;
    case "FEATURE_ANNOUNCEMENTS":
      return prefs.featureAnnouncementsEnabled;
    case "TIPS_EDUCATIONAL":
      return prefs.educationalContentEnabled;
    case "BUSINESS_OFFERS":
    case "MARKETING_PROMOTIONAL":
      return prefs.promotionalOffersEnabled && prefs.marketingEnabled;
    default:
      return prefs.marketingEnabled;
  }
}

/**
 * Records an immutable audit log entry for preference changes and dispatch events.
 */
export async function recordEmailAuditLog(
  log: Omit<EmailAuditLogRecord, "id" | "timestamp">
): Promise<string> {
  try {
    const docData: EmailAuditLogRecord = {
      ...log,
      id: "",
      timestamp: new Date().toISOString(),
    };

    const added = await adminDb.collection(EMAIL_AUDIT_COLLECTION).add(docData);
    return added.id;
  } catch (err) {
    console.error("[EmailService Audit Error] Failed to persist audit log:", err);
    return "audit_fallback_" + Date.now();
  }
}

/**
 * Updates a recipient's email preferences in Firestore and writes an audit log record.
 */
export async function updateRecipientEmailPreferences(params: {
  email: string;
  userId?: string;
  companyId?: string;
  preferences: Partial<EmailPreferenceRecord>;
  source: "one_click_header" | "unsubscribe_link" | "preference_center" | "admin_portal";
  ipAddress?: string;
  userAgent?: string;
  adminReason?: string;
}): Promise<{ success: boolean; preferences: EmailPreferenceRecord; auditLogId: string }> {
  const normalized = params.email.trim().toLowerCase();
  const docId = getEmailPreferenceDocId(normalized);
  const now = new Date().toISOString();

  const current = await getFreshEmailPreferences(normalized, params.userId, params.companyId);

  const updated: EmailPreferenceRecord = {
    ...current,
    ...params.preferences,
    email: normalized,
    id: docId,
    updatedAt: now,
  };

  // If marketingEnabled is being set to false, record unsubscribe timestamp and source
  if (params.preferences.marketingEnabled === false && current.marketingEnabled !== false) {
    updated.unsubscribedAt = now;
    updated.unsubscribeSource = params.source;
  }

  // Persist to Firestore
  await adminDb
    .collection(EMAIL_PREFERENCES_COLLECTION)
    .doc(docId)
    .set(updated, { merge: true });

  // Record audit log
  const auditLogId = await recordEmailAuditLog({
    userId: params.userId || current.userId,
    companyId: params.companyId || current.companyId,
    email: normalized,
    action:
      params.preferences.marketingEnabled === false
        ? params.source === "one_click_header"
          ? "ONE_CLICK_UNSUBSCRIBE"
          : "UNSUBSCRIBE_ALL"
        : params.source === "admin_portal"
        ? "ADMIN_RESUBSCRIBE_CUSTOMER_INITIATED"
        : "UPDATE_PREFERENCES",
    preferenceCategory: "email_preferences",
    previousValue: {
      marketingEnabled: current.marketingEnabled,
      productUpdatesEnabled: current.productUpdatesEnabled,
      newsletterEnabled: current.newsletterEnabled,
      featureAnnouncementsEnabled: current.featureAnnouncementsEnabled,
      educationalContentEnabled: current.educationalContentEnabled,
      promotionalOffersEnabled: current.promotionalOffersEnabled,
    },
    newValue: {
      marketingEnabled: updated.marketingEnabled,
      productUpdatesEnabled: updated.productUpdatesEnabled,
      newsletterEnabled: updated.newsletterEnabled,
      featureAnnouncementsEnabled: updated.featureAnnouncementsEnabled,
      educationalContentEnabled: updated.educationalContentEnabled,
      promotionalOffersEnabled: updated.promotionalOffersEnabled,
    },
    source: params.source,
    ipAddress: params.ipAddress || "0.0.0.0",
    userAgent: params.userAgent || "Unknown",
    details: params.adminReason || `Preferences updated via ${params.source}`,
  });

  return {
    success: true,
    preferences: updated,
    auditLogId,
  };
}

/**
 * Primary dispatch function with mandatory Pre-Send Verification,
 * RFC 8058 One-Click Header injection, and Reusable Compliant Footer inclusion.
 */
export async function sendEmail(payload: EmailDispatchPayload): Promise<EmailSendResult> {
  const normalizedEmail = payload.toEmail.trim().toLowerCase();

  // 1. Resolve Recipient Preferences IMMEDIATELY before sending
  const freshPreferences = await getFreshEmailPreferences(
    normalizedEmail,
    payload.userId,
    payload.companyId
  );

  // 2. Pre-Send Marketing Gate
  if (payload.category === "MARKETING") {
    const isPermitted = isMarketingCategoryPermitted(
      freshPreferences,
      payload.emailType as MarketingEmailType
    );

    if (!isPermitted) {
      console.warn(
        `[Email Governance] Suppressed marketing dispatch to ${normalizedEmail}. Recipient is unsubscribed from ${payload.emailType}.`
      );

      // Record blocked audit event
      const auditLogId = await recordEmailAuditLog({
        userId: payload.userId,
        companyId: payload.companyId,
        email: normalizedEmail,
        action: "PRE_SEND_BLOCKED",
        preferenceCategory: payload.emailType,
        previousValue: null,
        newValue: "BLOCKED",
        source: "email_service_pre_send_gate",
        details: `Dispatched marketing email '${payload.subject}' suppressed due to active customer unsubscribe settings.`,
      });

      return {
        success: true,
        sent: false,
        blockedByPreferences: true,
        reason: `Recipient has unsubscribed from optional communications (${payload.emailType}).`,
        auditLogId,
      };
    }
  }

  // 3. Render Compliant HTML and Text with Centralized Footer
  const { html, text } = generateEmailHtml({
    recipientEmail: normalizedEmail,
    subject: payload.subject,
    category: payload.category,
    emailType: payload.emailType,
    headline: payload.headline,
    bodyContent: payload.bodyContent,
    textContent: payload.textContent,
    companyId: payload.companyId,
    userId: payload.userId,
    companyDetails: payload.companyDetails,
    extraAction: payload.extraAction,
  });

  // 4. Generate RFC 8058 / RFC 2369 Headers
  const urls = getEmailGovernanceUrls({
    email: normalizedEmail,
    companyId: payload.companyId,
    userId: payload.userId,
  });

  // RFC 8058 One-Click Unsubscribe headers (only applicable to marketing emails)
  const headersPayload: Record<string, string> = {};
  if (payload.category === "MARKETING") {
    headersPayload["List-Unsubscribe"] = `<${urls.oneClickApiUrl}>, <mailto:unsubscribe@miratechsuite.com?subject=unsubscribe>`;
    headersPayload["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  // 5. Dispatch via Brevo SMTP API Client
  const brevoResult = await sendViaBrevo({
    to: [{ email: normalizedEmail }],
    subject: payload.subject,
    htmlContent: html,
    textContent: text,
    headers: headersPayload,
    tags: [payload.category.toLowerCase(), payload.emailType.toLowerCase()],
  });

  const messageId = brevoResult.messageId || `msg_${Date.now()}`;
  const dispatchSuccess = brevoResult.success;
  const dispatchError = brevoResult.error;

  // 6. Record Dispatch Audit Log
  const auditLogId = await recordEmailAuditLog({
    userId: payload.userId,
    companyId: payload.companyId,
    email: normalizedEmail,
    action: payload.category === "MARKETING" ? "SENT_MARKETING" : "SENT_TRANSACTIONAL",
    preferenceCategory: payload.emailType,
    previousValue: null,
    newValue: dispatchSuccess ? "DELIVERED" : "FAILED",
    source: "email_dispatcher",
    details: dispatchError
      ? `Delivery failed: ${dispatchError}`
      : `Message dispatched successfully with messageId: ${messageId}`,
  });

  return {
    success: dispatchSuccess,
    sent: dispatchSuccess,
    blockedByPreferences: false,
    messageId,
    error: dispatchError,
    auditLogId,
  };
}

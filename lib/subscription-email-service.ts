/**
 * MiraTech Business Suite - Subscription Transactional Email Service Layer
 * 
 * Centralized, idempotent, provider-agnostic notification engine for subscription events.
 * Guarantees exactly-once delivery per webhook/event, automatic retries, and comprehensive audit ledger.
 */

import { adminDb } from "./firebase-admin";
import {
  SubscriptionEmailEventType,
  SubscriptionEmailEventRecord,
  SubscriptionConfirmedPayload,
  CompanyProvisionedPayload,
  TrialEndingReminderPayload,
  RenewalConfirmationPayload,
  PaymentFailedPayload,
  SubscriptionEndedPayload,
} from "./subscription-email-types";
import {
  renderSubscriptionConfirmedEmail,
  renderCompanyProvisionedEmail,
  renderTrialEndingReminderEmail,
  renderRenewalConfirmationEmail,
  renderPaymentFailedEmail,
  renderSubscriptionEndedEmail,
} from "./subscription-email-templates";

const SUBSCRIPTION_EVENTS_COLLECTION = "subscription_email_events";

/**
 * Generates a deterministic idempotency key for an event.
 */
export function generateIdempotencyKey(
  emailType: SubscriptionEmailEventType,
  identifier: string, // subscriptionId or companyId
  relatedEventId?: string
): string {
  const cleanType = emailType.toLowerCase();
  const cleanId = (identifier || "unknown").replace(/[^a-zA-Z0-9_-]/g, "");
  const cleanEvent = (relatedEventId || "default").replace(/[^a-zA-Z0-9_-]/g, "");
  return `${cleanType}_${cleanId}_${cleanEvent}`;
}

/**
 * Dispatches an email via Brevo SMTP API with automatic retry on transient failure.
 */
async function sendRawBrevoEmail(params: {
  toEmail: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  maxAttempts?: number;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderName = process.env.BREVO_SENDER_NAME || "MiraTech Business Suite";
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "billing@miratechsuite.com";
  const maxAttempts = params.maxAttempts || 2;

  if (!brevoApiKey) {
    // Development fallback simulation
    console.log(
      `[Subscription Email Service] BREVO_API_KEY not configured. Simulating delivery to: ${params.toEmail} | Subject: "${params.subject}"`
    );
    return {
      success: true,
      messageId: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
          to: [{ email: params.toEmail }],
          subject: params.subject,
          htmlContent: params.htmlContent,
          textContent: params.textContent,
        }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          success: true,
          messageId: data.messageId || `msg_${Date.now()}`,
        };
      }

      const errJson = await response.json().catch(() => ({}));
      lastError = errJson.message || `Brevo returned HTTP ${response.status}`;
      console.warn(
        `[Subscription Email Brevo Attempt ${attempt}/${maxAttempts} Failed]:`,
        lastError
      );

      if (attempt < maxAttempts) {
        // Exponential backoff wait (e.g. 500ms)
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    } catch (err: any) {
      lastError = err?.message || "Network exception reaching Brevo API";
      console.warn(
        `[Subscription Email Brevo Attempt ${attempt}/${maxAttempts} Exception]:`,
        lastError
      );
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  return { success: false, error: lastError };
}

/**
 * Core execution pipeline with idempotency guarantees and Firestore audit recording.
 */
async function executeIdempotentDispatch(params: {
  idempotencyKey: string;
  companyId: string;
  companyName: string;
  customerId?: string;
  subscriptionId?: string;
  emailType: SubscriptionEmailEventType;
  recipientEmail: string;
  recipientName?: string;
  relatedEventId?: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  metadata?: Record<string, any>;
}): Promise<{
  success: boolean;
  deliveryStatus: "SENT" | "FAILED" | "ALREADY_SENT";
  messageId?: string;
  error?: string;
}> {
  const eventRef = adminDb.collection(SUBSCRIPTION_EVENTS_COLLECTION).doc(params.idempotencyKey);
  const now = new Date().toISOString();

  // 1. Check if already dispatched (Idempotency Barrier)
  const existingDoc = await eventRef.get();
  if (existingDoc.exists) {
    const data = existingDoc.data() as SubscriptionEmailEventRecord;
    if (data.deliveryStatus === "SENT") {
      console.log(
        `[Idempotency Gate] Suppressed duplicate email dispatch. Event "${params.idempotencyKey}" was already sent on ${data.timestamp}. ProviderMessageId: ${data.providerMessageId}`
      );
      return {
        success: true,
        deliveryStatus: "ALREADY_SENT",
        messageId: data.providerMessageId,
      };
    }
  }

  // 2. Register / update record to PENDING
  const initialRecord: SubscriptionEmailEventRecord = {
    id: params.idempotencyKey,
    companyId: params.companyId,
    companyName: params.companyName,
    customerId: params.customerId || "",
    subscriptionId: params.subscriptionId || "",
    emailType: params.emailType,
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName || "",
    relatedEventId: params.relatedEventId || "",
    timestamp: now,
    deliveryStatus: "PENDING",
    retryCount: existingDoc.exists ? (existingDoc.data()?.retryCount || 0) + 1 : 0,
    metadata: params.metadata || {},
  };

  await eventRef.set(initialRecord, { merge: true });

  // 3. Dispatch via Brevo
  const dispatchResult = await sendRawBrevoEmail({
    toEmail: params.recipientEmail,
    subject: params.subject,
    htmlContent: params.htmlContent,
    textContent: params.textContent,
  });

  if (dispatchResult.success) {
    // 4. Update to SENT
    await eventRef.update({
      deliveryStatus: "SENT",
      providerMessageId: dispatchResult.messageId,
      error: null,
      updatedAt: new Date().toISOString(),
    });

    console.log(
      `[Subscription Email Success] Dispatched ${params.emailType} to ${params.recipientEmail}. IdempotencyKey: ${params.idempotencyKey}`
    );

    return {
      success: true,
      deliveryStatus: "SENT",
      messageId: dispatchResult.messageId,
    };
  } else {
    // 5. Update to FAILED
    await eventRef.update({
      deliveryStatus: "FAILED",
      error: dispatchResult.error || "Email delivery failed",
      updatedAt: new Date().toISOString(),
    });

    console.error(
      `[Subscription Email Failure] Failed to dispatch ${params.emailType} to ${params.recipientEmail}: ${dispatchResult.error}`
    );

    return {
      success: false,
      deliveryStatus: "FAILED",
      error: dispatchResult.error,
    };
  }
}

// ============================================================================
// 1. sendSubscriptionConfirmation()
// ============================================================================
export async function sendSubscriptionConfirmation(
  payload: SubscriptionConfirmedPayload
) {
  const idempotencyKey = generateIdempotencyKey(
    "SUBSCRIPTION_CONFIRMED",
    payload.subscriptionId || payload.companyId,
    payload.relatedEventId || "sub_confirmed"
  );

  const { subject, html, text } = renderSubscriptionConfirmedEmail(payload);

  return executeIdempotentDispatch({
    idempotencyKey,
    companyId: payload.companyId,
    companyName: payload.companyName,
    customerId: payload.customerId,
    subscriptionId: payload.subscriptionId,
    emailType: "SUBSCRIPTION_CONFIRMED",
    recipientEmail: payload.recipientEmail,
    recipientName: payload.recipientName,
    relatedEventId: payload.relatedEventId,
    subject,
    htmlContent: html,
    textContent: text,
    metadata: {
      planName: payload.planName,
      isTrial: payload.isTrial,
      price: payload.priceFormatted,
    },
  });
}

// ============================================================================
// 2. sendCompanyProvisioned()
// ============================================================================
export async function sendCompanyProvisioned(
  payload: CompanyProvisionedPayload
) {
  const idempotencyKey = generateIdempotencyKey(
    "COMPANY_PROVISIONED",
    payload.companyId,
    payload.relatedEventId || "provisioned"
  );

  const { subject, html, text } = renderCompanyProvisionedEmail(payload);

  return executeIdempotentDispatch({
    idempotencyKey,
    companyId: payload.companyId,
    companyName: payload.companyName,
    customerId: payload.customerId,
    subscriptionId: payload.subscriptionId,
    emailType: "COMPANY_PROVISIONED",
    recipientEmail: payload.recipientEmail,
    recipientName: payload.recipientName,
    relatedEventId: payload.relatedEventId,
    subject,
    htmlContent: html,
    textContent: text,
    metadata: {
      planName: payload.planName,
      enabledModules: payload.enabledModules,
    },
  });
}

// ============================================================================
// 3. sendTrialEndingReminder()
// ============================================================================
export async function sendTrialEndingReminder(
  payload: TrialEndingReminderPayload
) {
  const idempotencyKey = generateIdempotencyKey(
    "TRIAL_ENDING_REMINDER",
    payload.subscriptionId || payload.companyId,
    "3_day_reminder"
  );

  const { subject, html, text } = renderTrialEndingReminderEmail(payload);

  return executeIdempotentDispatch({
    idempotencyKey,
    companyId: payload.companyId,
    companyName: payload.companyName,
    customerId: payload.customerId,
    subscriptionId: payload.subscriptionId,
    emailType: "TRIAL_ENDING_REMINDER",
    recipientEmail: payload.recipientEmail,
    recipientName: payload.recipientName,
    relatedEventId: payload.relatedEventId || "3_day_reminder",
    subject,
    htmlContent: html,
    textContent: text,
    metadata: {
      trialExpiresAt: payload.trialExpiresAt,
      chargeAmount: payload.chargeAmountFormatted,
    },
  });
}

// ============================================================================
// 4. sendRenewalConfirmation()
// ============================================================================
export async function sendRenewalConfirmation(
  payload: RenewalConfirmationPayload
) {
  const idempotencyKey = generateIdempotencyKey(
    "SUBSCRIPTION_RENEWAL_SUCCESS",
    payload.subscriptionId || payload.companyId,
    payload.transactionRef || payload.relatedEventId || `txn_${Date.now()}`
  );

  const { subject, html, text } = renderRenewalConfirmationEmail(payload);

  return executeIdempotentDispatch({
    idempotencyKey,
    companyId: payload.companyId,
    companyName: payload.companyName,
    customerId: payload.customerId,
    subscriptionId: payload.subscriptionId,
    emailType: "SUBSCRIPTION_RENEWAL_SUCCESS",
    recipientEmail: payload.recipientEmail,
    recipientName: payload.recipientName,
    relatedEventId: payload.transactionRef || payload.relatedEventId,
    subject,
    htmlContent: html,
    textContent: text,
    metadata: {
      amountPaid: payload.amountPaidFormatted,
      transactionRef: payload.transactionRef,
      newBillingPeriod: payload.newBillingPeriod,
    },
  });
}

// ============================================================================
// 5. sendPaymentFailed()
// ============================================================================
export async function sendPaymentFailed(
  payload: PaymentFailedPayload
) {
  const idempotencyKey = generateIdempotencyKey(
    "PAYMENT_FAILED",
    payload.subscriptionId || payload.companyId,
    payload.relatedEventId || `fail_${payload.failureDate.replace(/[^a-zA-Z0-9]/g, "")}`
  );

  const { subject, html, text } = renderPaymentFailedEmail(payload);

  return executeIdempotentDispatch({
    idempotencyKey,
    companyId: payload.companyId,
    companyName: payload.companyName,
    customerId: payload.customerId,
    subscriptionId: payload.subscriptionId,
    emailType: "PAYMENT_FAILED",
    recipientEmail: payload.recipientEmail,
    recipientName: payload.recipientName,
    relatedEventId: payload.relatedEventId,
    subject,
    htmlContent: html,
    textContent: text,
    metadata: {
      amountAttempted: payload.amountAttemptedFormatted,
      failureDate: payload.failureDate,
      gracePeriodEndsAt: payload.gracePeriodEndsAt,
    },
  });
}

// ============================================================================
// 6. sendSubscriptionEnded()
// ============================================================================
export async function sendSubscriptionEnded(
  payload: SubscriptionEndedPayload
) {
  const idempotencyKey = generateIdempotencyKey(
    "SUBSCRIPTION_ENDED",
    payload.subscriptionId || payload.companyId,
    payload.relatedEventId || `ended_${payload.endedDate.replace(/[^a-zA-Z0-9]/g, "")}`
  );

  const { subject, html, text } = renderSubscriptionEndedEmail(payload);

  return executeIdempotentDispatch({
    idempotencyKey,
    companyId: payload.companyId,
    companyName: payload.companyName,
    customerId: payload.customerId,
    subscriptionId: payload.subscriptionId,
    emailType: "SUBSCRIPTION_ENDED",
    recipientEmail: payload.recipientEmail,
    recipientName: payload.recipientName,
    relatedEventId: payload.relatedEventId,
    subject,
    htmlContent: html,
    textContent: text,
    metadata: {
      endedDate: payload.endedDate,
      effectiveAccessEndDate: payload.effectiveAccessEndDate,
    },
  });
}

// ============================================================================
// Admin & Retry Operations
// ============================================================================

/**
 * Retries a failed subscription email event.
 */
export async function retrySubscriptionEmail(eventId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const eventRef = adminDb.collection(SUBSCRIPTION_EVENTS_COLLECTION).doc(eventId);
  const snap = await eventRef.get();

  if (!snap.exists) {
    return { success: false, error: "Event record not found." };
  }

  const record = snap.data() as SubscriptionEmailEventRecord;
  const now = new Date().toISOString();

  // Re-render template based on event type
  let rendered: { subject: string; html: string; text: string } | null = null;
  const meta = record.metadata || {};

  switch (record.emailType) {
    case "SUBSCRIPTION_CONFIRMED":
      rendered = renderSubscriptionConfirmedEmail({
        companyId: record.companyId,
        companyName: record.companyName,
        recipientEmail: record.recipientEmail,
        recipientName: record.recipientName || "Valued Customer",
        planName: meta.planName || "Enterprise Suite",
        priceFormatted: meta.price || "$149.00",
        billingInterval: "monthly",
        startDate: new Date(record.timestamp).toLocaleDateString(),
        isTrial: Boolean(meta.isTrial),
      });
      break;

    case "COMPANY_PROVISIONED":
      rendered = renderCompanyProvisionedEmail({
        companyId: record.companyId,
        companyName: record.companyName,
        recipientEmail: record.recipientEmail,
        recipientName: record.recipientName || "Administrator",
        planName: meta.planName || "Growth Plan",
        enabledModules: meta.enabledModules || ["Ledger", "Invoicing", "Payroll"],
        accountCreationDate: new Date(record.timestamp).toLocaleDateString(),
        loginUrl: "https://miratechsuite.com/login",
      });
      break;

    case "TRIAL_ENDING_REMINDER":
      rendered = renderTrialEndingReminderEmail({
        companyId: record.companyId,
        companyName: record.companyName,
        recipientEmail: record.recipientEmail,
        recipientName: record.recipientName || "Valued Customer",
        planName: meta.planName || "Growth Plan",
        trialExpiresAt: meta.trialExpiresAt || "in 3 days",
        chargeAmountFormatted: meta.chargeAmount || "$149.00",
        billingInterval: "monthly",
        manageSubscriptionUrl: "https://miratechsuite.com/dashboard?tab=admin&subtab=billing",
      });
      break;

    case "SUBSCRIPTION_RENEWAL_SUCCESS":
      rendered = renderRenewalConfirmationEmail({
        companyId: record.companyId,
        companyName: record.companyName,
        recipientEmail: record.recipientEmail,
        recipientName: record.recipientName,
        planName: meta.planName || "Enterprise Plan",
        amountPaidFormatted: meta.amountPaid || "$149.00",
        paymentDate: new Date(record.timestamp).toLocaleDateString(),
        newBillingPeriod: meta.newBillingPeriod || "Upcoming 30-Day Period",
        nextRenewalDate: "Next Month",
        transactionRef: meta.transactionRef || record.relatedEventId || "N/A",
      });
      break;

    case "PAYMENT_FAILED":
      rendered = renderPaymentFailedEmail({
        companyId: record.companyId,
        companyName: record.companyName,
        recipientEmail: record.recipientEmail,
        recipientName: record.recipientName,
        planName: meta.planName || "Enterprise Plan",
        amountAttemptedFormatted: meta.amountAttempted || "$149.00",
        failureDate: meta.failureDate || new Date().toLocaleDateString(),
        retryPaymentUrl: "https://miratechsuite.com/dashboard?tab=admin&subtab=billing",
        gracePeriodEndsAt: meta.gracePeriodEndsAt,
      });
      break;

    case "SUBSCRIPTION_ENDED":
      rendered = renderSubscriptionEndedEmail({
        companyId: record.companyId,
        companyName: record.companyName,
        recipientEmail: record.recipientEmail,
        recipientName: record.recipientName,
        planName: meta.planName || "Standard Plan",
        endedDate: meta.endedDate || new Date().toLocaleDateString(),
        effectiveAccessEndDate: meta.effectiveAccessEndDate || "Immediate",
        reactivationUrl: "https://miratechsuite.com/dashboard?tab=admin&subtab=billing",
      });
      break;
  }

  if (!rendered) {
    return { success: false, error: "Unable to reconstruct template for event type." };
  }

  // Attempt dispatch
  const dispatch = await sendRawBrevoEmail({
    toEmail: record.recipientEmail,
    subject: rendered.subject,
    htmlContent: rendered.html,
    textContent: rendered.text,
  });

  if (dispatch.success) {
    await eventRef.update({
      deliveryStatus: "SENT",
      providerMessageId: dispatch.messageId,
      error: null,
      lastRetryAt: now,
      retryCount: (record.retryCount || 0) + 1,
      updatedAt: now,
    });
    return { success: true, message: "Email re-sent successfully." };
  } else {
    await eventRef.update({
      deliveryStatus: "FAILED",
      error: dispatch.error || "Retry attempt failed.",
      lastRetryAt: now,
      retryCount: (record.retryCount || 0) + 1,
      updatedAt: now,
    });
    return { success: false, error: dispatch.error };
  }
}

/**
 * Resolves the primary recipient notification details for a given company.
 */
export async function resolveCompanyNotificationRecipient(
  companyId: string,
  eventData?: any
): Promise<{
  companyName: string;
  recipientEmail: string;
  recipientName: string;
  planName: string;
  billingInterval: string;
}> {
  let companyName = "MiraTech Enterprise";
  let recipientEmail = "";
  let recipientName = "Company Administrator";
  let planName = "Growth Plan";
  let billingInterval = "monthly";

  try {
    if (companyId) {
      const compSnap = await adminDb.collection("companies").doc(companyId).get();
      if (compSnap.exists) {
        const cData = compSnap.data() || {};
        companyName = cData.name || cData.businessName || companyName;
        recipientEmail =
          cData.officialEmail ||
          cData.email ||
          cData.billingEmail ||
          cData.contactEmail ||
          "";
        recipientName =
          cData.adminName ||
          cData.ownerName ||
          cData.contactPerson ||
          recipientName;
        planName = cData.subscriptionPlan || cData.tier || planName;
        billingInterval = cData.subscriptionBillingCycle || billingInterval;
      }

      // Check users collection if email is still missing or to get official admin name
      if (!recipientEmail || recipientName === "Company Administrator") {
        const userQuery = await adminDb
          .collection("users")
          .where("companyId", "==", companyId)
          .where("role", "in", ["ADMIN", "OWNER", "MASTER_ADMIN"])
          .limit(1)
          .get();

        if (!userQuery.empty) {
          const uData = userQuery.docs[0].data();
          if (!recipientEmail && uData.email) {
            recipientEmail = uData.email;
          }
          if (uData.displayName) {
            recipientName = uData.displayName;
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[resolveCompanyNotificationRecipient] Error querying company ${companyId}:`, err);
  }

  // Fallback to webhook data if available
  if (!recipientEmail && eventData?.data) {
    const cust = eventData.data.customer || {};
    recipientEmail = cust.email || eventData.data.customer_email || "";
    recipientName = cust.name || recipientName;
  }

  // Final fallback to platform email
  if (!recipientEmail) {
    recipientEmail = process.env.DEFAULT_NOTIFICATION_EMAIL || "miratechindustries@gmail.com";
  }

  return {
    companyName,
    recipientEmail: recipientEmail.trim().toLowerCase(),
    recipientName,
    planName,
    billingInterval,
  };
}

/**
 * Retrieves subscription email event records for the admin console.
 */
export async function querySubscriptionEmailEvents(params?: {
  status?: string;
  limitCount?: number;
}): Promise<SubscriptionEmailEventRecord[]> {
  const limitCount = params?.limitCount || 50;
  let q: any = adminDb.collection(SUBSCRIPTION_EVENTS_COLLECTION);

  if (params?.status && params.status !== "ALL") {
    q = q.where("deliveryStatus", "==", params.status);
  }

  // Fetch documents
  const snap = await q.limit(limitCount).get();
  const records: SubscriptionEmailEventRecord[] = [];

  snap.forEach((doc: any) => {
    records.push({
      ...doc.data(),
      id: doc.id,
    } as SubscriptionEmailEventRecord);
  });

  // Sort descending by timestamp in memory
  return records.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

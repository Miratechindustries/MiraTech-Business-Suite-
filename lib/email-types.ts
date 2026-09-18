/**
 * MiraTech Business Suite - Email Preference & Governance Types
 */

export interface EmailPreferenceRecord {
  id: string; // Deterministic hash of lowercase email
  userId?: string;
  companyId?: string;
  email: string; // Stored securely
  marketingEnabled: boolean; // Master marketing flag
  productUpdatesEnabled: boolean;
  newsletterEnabled: boolean;
  featureAnnouncementsEnabled: boolean;
  educationalContentEnabled: boolean;
  promotionalOffersEnabled: boolean;
  unsubscribedAt: string | null; // ISO timestamp
  unsubscribeSource:
    | "one_click_header"
    | "unsubscribe_link"
    | "preference_center"
    | "admin_portal"
    | "user_registration"
    | null;
  consentTimestamp: string;
  consentSource: "registration" | "checkout" | "manual" | "preference_center" | "implicit_commercial";
  updatedAt: string;
}

export type EmailAuditAction =
  | "UNSUBSCRIBE_ALL"
  | "UPDATE_PREFERENCES"
  | "ONE_CLICK_UNSUBSCRIBE"
  | "ADMIN_RESUBSCRIBE_CUSTOMER_INITIATED"
  | "PRE_SEND_BLOCKED"
  | "SENT_MARKETING"
  | "SENT_TRANSACTIONAL";

export interface EmailAuditLogRecord {
  id: string;
  userId?: string;
  companyId?: string;
  email: string;
  action: EmailAuditAction;
  preferenceCategory?: string;
  previousValue?: any;
  newValue?: any;
  source: string;
  timestamp: string;
  ipAddress?: string; // Anonymized where appropriate
  userAgent?: string;
  details?: string;
}

export type EmailCategory = "TRANSACTIONAL" | "MARKETING";

/**
 * Transactional emails are strictly necessary for the customer's account,
 * subscription, security, billing, or service. They cannot be disabled as marketing subscriptions.
 */
export type TransactionalEmailType =
  | "SUBSCRIPTION_CONFIRMATION"
  | "COMPANY_PROVISIONING"
  | "TRIAL_EXPIRATION"
  | "PAYMENT_RECEIPT"
  | "SUBSCRIPTION_RENEWAL"
  | "PAYMENT_FAILURE"
  | "SUBSCRIPTION_CANCELLATION"
  | "SECURITY_NOTIFICATION"
  | "PASSWORD_SECURITY"
  | "SERVICE_NOTICE"
  | "OTP_VERIFICATION"
  | "DOCUMENT_APPROVAL_REQUEST";

/**
 * Marketing and optional emails are subject to user consent and immediate unsubscribe.
 */
export type MarketingEmailType =
  | "PRODUCT_UPDATES"
  | "MARKETING_PROMOTIONAL"
  | "NEWSLETTER"
  | "FEATURE_ANNOUNCEMENTS"
  | "TIPS_EDUCATIONAL"
  | "BUSINESS_OFFERS";

export interface EmailDispatchPayload {
  toEmail: string;
  subject: string;
  category: EmailCategory;
  emailType: TransactionalEmailType | MarketingEmailType;
  headline?: string;
  bodyContent: string;
  textContent?: string;
  companyId?: string;
  userId?: string;
  companyDetails?: {
    name?: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  extraAction?: {
    label: string;
    url: string;
  };
}

export interface EmailSendResult {
  success: boolean;
  sent: boolean;
  blockedByPreferences?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
  auditLogId?: string;
}

/**
 * MiraTech Business Suite - Subscription Transactional Email Types
 * 
 * Strict schemas for the 6 core subscription lifecycle events:
 * 1. SUBSCRIPTION_CONFIRMED
 * 2. COMPANY_PROVISIONED
 * 3. TRIAL_ENDING_REMINDER
 * 4. SUBSCRIPTION_RENEWAL_SUCCESS
 * 5. PAYMENT_FAILED
 * 6. SUBSCRIPTION_ENDED
 */

export type SubscriptionEmailEventType =
  | "SUBSCRIPTION_CONFIRMED"
  | "COMPANY_PROVISIONED"
  | "TRIAL_ENDING_REMINDER"
  | "SUBSCRIPTION_RENEWAL_SUCCESS"
  | "PAYMENT_FAILED"
  | "SUBSCRIPTION_ENDED";

export type EmailDeliveryStatus = "PENDING" | "SENT" | "FAILED" | "BLOCKED";

export interface SubscriptionEmailEventRecord {
  id: string; // Idempotency key
  companyId: string;
  companyName: string;
  customerId?: string;
  subscriptionId?: string;
  emailType: SubscriptionEmailEventType;
  recipientEmail: string;
  recipientName?: string;
  relatedEventId?: string; // Webhook event ID or transaction ID
  timestamp: string; // ISO 8601
  deliveryStatus: EmailDeliveryStatus;
  providerMessageId?: string;
  error?: string;
  retryCount: number;
  lastRetryAt?: string;
  metadata?: Record<string, any>;
}

// 1. Subscription Confirmed Payload
export interface SubscriptionConfirmedPayload {
  companyId: string;
  companyName: string;
  recipientEmail: string;
  recipientName: string;
  planName: string;
  priceFormatted: string; // e.g. "$149.00"
  billingInterval: "monthly" | "annual" | string;
  startDate: string;
  nextBillingDate?: string | null;
  isTrial: boolean;
  trialDays?: number;
  trialEndsAt?: string | null;
  dashboardUrl?: string;
  supportContactEmail?: string;
  relatedEventId?: string;
  customerId?: string;
  subscriptionId?: string;
}

// 2. Company Provisioned Payload
export interface CompanyProvisionedPayload {
  companyId: string;
  companyName: string;
  recipientEmail: string;
  recipientName: string;
  planName: string;
  enabledModules: string[];
  accountCreationDate: string;
  loginUrl: string;
  relatedEventId?: string;
  customerId?: string;
  subscriptionId?: string;
}

// 3. Trial Ending Reminder Payload
export interface TrialEndingReminderPayload {
  companyId: string;
  companyName: string;
  recipientEmail: string;
  recipientName: string;
  planName: string;
  trialExpiresAt: string; // Exact expiration timestamp
  chargeAmountFormatted: string; // e.g. "$149.00"
  billingInterval: "monthly" | "annual" | string;
  manageSubscriptionUrl: string;
  dashboardUrl?: string;
  relatedEventId?: string;
  customerId?: string;
  subscriptionId?: string;
}

// 4. Renewal Confirmation Payload
export interface RenewalConfirmationPayload {
  companyId: string;
  companyName: string;
  recipientEmail: string;
  recipientName?: string;
  planName: string;
  amountPaidFormatted: string;
  paymentDate: string;
  newBillingPeriod: string; // e.g. "Oct 1, 2026 - Nov 1, 2026"
  nextRenewalDate: string;
  transactionRef: string;
  invoiceUrl?: string | null;
  dashboardUrl?: string;
  relatedEventId?: string;
  customerId?: string;
  subscriptionId?: string;
}

// 5. Payment Failed Payload
export interface PaymentFailedPayload {
  companyId: string;
  companyName: string;
  recipientEmail: string;
  recipientName?: string;
  planName: string;
  amountAttemptedFormatted: string;
  failureDate: string;
  retryPaymentUrl: string;
  gracePeriodEndsAt?: string | null; // e.g. "October 10, 2026"
  dashboardUrl?: string;
  relatedEventId?: string;
  customerId?: string;
  subscriptionId?: string;
}

// 6. Subscription Ended Payload
export interface SubscriptionEndedPayload {
  companyId: string;
  companyName: string;
  recipientEmail: string;
  recipientName?: string;
  planName: string;
  endedDate: string;
  effectiveAccessEndDate: string;
  dataRetentionPolicyText?: string;
  reactivationUrl: string;
  supportContactEmail?: string;
  relatedEventId?: string;
  customerId?: string;
  subscriptionId?: string;
}

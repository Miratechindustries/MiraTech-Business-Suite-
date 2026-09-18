/**
 * MiraTech Business Suite - Subscription Transactional Email Templates
 * 
 * High-craft, branded, responsive templates for the 6 core subscription lifecycle events.
 * Adheres to WCAG AA, anti-slop guidelines, clean layout, and statutory footer integration.
 */

import { renderEmailFooterHtml } from "./email-templates";
import { getEmailLegalConfig } from "./email-config";
import {
  SubscriptionConfirmedPayload,
  CompanyProvisionedPayload,
  TrialEndingReminderPayload,
  RenewalConfirmationPayload,
  PaymentFailedPayload,
  SubscriptionEndedPayload,
} from "./subscription-email-types";

// Helper for building clean branded container wrapper
function buildEmailWrapper(params: {
  headline: string;
  badge: { text: string; bg: string; color: string; border: string };
  bodyHtml: string;
  cta?: { text: string; url: string };
  recipientEmail: string;
  companyId?: string;
  companyName?: string;
  baseUrl?: string;
}): { html: string; text: string } {
  const config = getEmailLegalConfig({ name: params.companyName });
  const footerHtml = renderEmailFooterHtml({
    recipientEmail: params.recipientEmail,
    category: "TRANSACTIONAL",
    companyId: params.companyId,
    companyDetails: { name: params.companyName },
    baseUrl: params.baseUrl,
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.headline}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Branded Corporate Header -->
          <tr>
            <td style="padding: 28px 36px; background-color: #0f172a; border-bottom: 2px solid #2563eb;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      MiraTech <span style="color: #60a5fa; font-weight: 400;">Business Suite</span>
                    </div>
                    <div style="font-size: 11px; font-weight: 500; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">
                      Enterprise Cloud Infrastructure &amp; Billing
                    </div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 6px; background-color: ${params.badge.bg}; color: ${params.badge.color}; border: 1px solid ${params.badge.border}; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${params.badge.text}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Primary Content Body -->
          <tr>
            <td style="padding: 36px 36px 24px 36px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3; letter-spacing: -0.4px;">
                ${params.headline}
              </h1>

              <div style="font-size: 14px; line-height: 1.65; color: #334155;">
                ${params.bodyHtml}
              </div>

              ${
                params.cta
                  ? `
              <!-- CTA Button Section -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px; margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${params.cta.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                      ${params.cta.text} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              `
                  : ""
              }

              <!-- Centralized Statutory Footer -->
              ${footerHtml}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // Strip tags for clean text fallback
  const text = `
MIRA TECH BUSINESS SUITE - ${params.badge.text}
${params.headline}
----------------------------------------------------------------------

${params.bodyHtml
  .replace(/<\/p>/g, "\n\n")
  .replace(/<br\s*\/?>/g, "\n")
  .replace(/<\/tr>/g, "\n")
  .replace(/<\/td>/g, " | ")
  .replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&")
  .replace(/&rarr;/g, "->")
  .replace(/\n\s+\n/g, "\n\n")
  .trim()}

${params.cta ? `Action Link: ${params.cta.url}\n` : ""}

Support: ${config.supportEmail}
Manage Email Preferences: ${config.portalUrl}/email-preferences
----------------------------------------------------------------------
(c) ${new Date().getFullYear()} ${config.legalBusinessName}. All rights reserved.
  `.trim();

  return { html, text };
}

// 1. Template: SUBSCRIPTION CONFIRMED
export function renderSubscriptionConfirmedEmail(data: SubscriptionConfirmedPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Your MiraTech Business Suite subscription is confirmed";
  const loginUrl = data.dashboardUrl || "https://miratechsuite.com/login";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hello <strong>${data.recipientName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">
      Thank you for subscribing to <strong>MiraTech Business Suite</strong>. Your corporate subscription for <strong>${data.companyName}</strong> has been successfully authorized and activated.
    </p>

    <!-- Details Table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 13px;">
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569; width: 40%;">Organization:</td>
        <td style="padding: 10px 16px; color: #0f172a; font-weight: 600;">${data.companyName}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Selected Tier:</td>
        <td style="padding: 10px 16px; color: #2563eb; font-weight: 700;">${data.planName}</td>
      </tr>
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Rate &amp; Billing Cycle:</td>
        <td style="padding: 10px 16px; color: #0f172a;">${data.priceFormatted} / ${data.billingInterval}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Effective Start Date:</td>
        <td style="padding: 10px 16px; color: #0f172a;">${data.startDate}</td>
      </tr>
      ${
        data.isTrial
          ? `
      <tr style="background-color: #eff6ff; border-bottom: 1px solid #dbeafe;">
        <td style="padding: 10px 16px; font-weight: 700; color: #1e40af;">Trial Status:</td>
        <td style="padding: 10px 16px; color: #1e40af; font-weight: 700;">
          Active Free Trial (${data.trialDays || 14} days) &bull; Ends ${data.trialEndsAt || "in 14 days"}
        </td>
      </tr>
      `
          : ""
      }
      <tr>
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Next Renewal / Billing Date:</td>
        <td style="padding: 10px 16px; color: #0f172a; font-weight: 600;">${data.nextBillingDate || "Calculated at trial conclusion"}</td>
      </tr>
    </table>

    <p style="margin: 0 0 16px 0;">
      Your authorized administrators and invited personnel now have immediate access to your company's ledger, double-entry accounting, invoicing, payroll automation, and operational modules.
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; margin: 20px 0; font-size: 13px; color: #166534;">
      <strong>Need help getting started?</strong> Our dedicated enterprise customer support desk is available at <a href="mailto:${data.supportContactEmail || "miratechindustries@gmail.com"}" style="color: #15803d; font-weight: 600;">${data.supportContactEmail || "miratechindustries@gmail.com"}</a>.
    </div>
  `;

  const { html, text } = buildEmailWrapper({
    headline: "Subscription Confirmed & Activated",
    badge: {
      text: data.isTrial ? "Trial Activated" : "Subscription Active",
      bg: "#ecfdf5",
      color: "#047857",
      border: "#a7f3d0",
    },
    bodyHtml,
    cta: {
      text: "Launch Business Suite Dashboard",
      url: loginUrl,
    },
    recipientEmail: data.recipientEmail,
    companyId: data.companyId,
    companyName: data.companyName,
  });

  return { subject, html, text };
}

// 2. Template: COMPANY PROVISIONED
export function renderCompanyProvisionedEmail(data: CompanyProvisionedPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Your MiraTech Business Suite company is ready";

  const modulePills = data.enabledModules
    .map(
      (m) =>
        `<span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin: 2px 4px 2px 0;">${m}</span>`
    )
    .join("");

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hello <strong>${data.recipientName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">
      We are pleased to inform you that your corporate account and dedicated cloud workspace have been successfully provisioned. <strong>Your MiraTech Business Suite company workspace is ready to use.</strong>
    </p>

    <!-- Workspace Specs Table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 13px;">
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569; width: 35%;">Workspace Name:</td>
        <td style="padding: 10px 16px; color: #0f172a; font-weight: 700;">${data.companyName}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Company Identifier:</td>
        <td style="padding: 10px 16px; color: #0f172a; font-family: monospace; font-size: 12px; font-weight: 600;">${data.companyId}</td>
      </tr>
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Assigned Administrator:</td>
        <td style="padding: 10px 16px; color: #0f172a;">${data.recipientName} (${data.recipientEmail})</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Active Provisioning Plan:</td>
        <td style="padding: 10px 16px; color: #2563eb; font-weight: 700;">${data.planName}</td>
      </tr>
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Enabled Modules:</td>
        <td style="padding: 10px 16px;">${modulePills}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Provisioning Date:</td>
        <td style="padding: 10px 16px; color: #0f172a;">${data.accountCreationDate}</td>
      </tr>
    </table>

    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #334155;">
      <strong>Security Reminder:</strong> Your administrator credentials give you full control over multi-tenant data access, chart of accounts, and employee payroll profiles. You can invite team members and configure role-based access control inside the Admin Dashboard.
    </div>
  `;

  const { html, text } = buildEmailWrapper({
    headline: "Company Workspace Ready for Business",
    badge: {
      text: "Workspace Provisioned",
      bg: "#eff6ff",
      color: "#1d4ed8",
      border: "#bfdbfe",
    },
    bodyHtml,
    cta: {
      text: "Access Workspace Dashboard",
      url: data.loginUrl,
    },
    recipientEmail: data.recipientEmail,
    companyId: data.companyId,
    companyName: data.companyName,
  });

  return { subject, html, text };
}

// 3. Template: TRIAL ENDING REMINDER (3 Days)
export function renderTrialEndingReminderEmail(data: TrialEndingReminderPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Your MiraTech Business Suite trial ends in 3 days";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hello <strong>${data.recipientName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">
      This is a friendly reminder that the 14-day free trial for <strong>${data.companyName}</strong> on the <strong>${data.planName}</strong> plan will conclude in exactly <strong>3 days</strong>.
    </p>

    <!-- Expiration Card -->
    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; font-weight: 700; color: #92400e; width: 45%;">Trial Expiration Date:</td>
          <td style="padding: 6px 0; font-weight: 800; color: #b45309; font-size: 14px;">${data.trialExpiresAt}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 700; color: #92400e;">Upcoming Charge:</td>
          <td style="padding: 6px 0; font-weight: 800; color: #0f172a; font-size: 15px;">${data.chargeAmountFormatted} / ${data.billingInterval}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 700; color: #92400e;">Target Subscription Tier:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${data.planName}</td>
        </tr>
      </table>
    </div>

    <p style="margin: 0 0 16px 0;">
      To ensure continuous access to your financial reports, double-entry ledgers, and operational tools without interruption, your payment method on file will be automatically charged at the conclusion of the trial.
    </p>
    <p style="margin: 0 0 16px 0;">
      If you wish to review your billing details, update your payment method, or adjust your subscription settings, you can do so at any time before the trial ends using the link below.
    </p>
  `;

  const { html, text } = buildEmailWrapper({
    headline: "Your Free Trial Ends in 3 Days",
    badge: {
      text: "Action Recommended",
      bg: "#fffbeb",
      color: "#b45309",
      border: "#fde68a",
    },
    bodyHtml,
    cta: {
      text: "Manage Subscription & Payment Method",
      url: data.manageSubscriptionUrl,
    },
    recipientEmail: data.recipientEmail,
    companyId: data.companyId,
    companyName: data.companyName,
  });

  return { subject, html, text };
}

// 4. Template: SUBSCRIPTION RENEWAL SUCCESS
export function renderRenewalConfirmationEmail(data: RenewalConfirmationPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "MiraTech Business Suite subscription renewed successfully";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hello ${data.recipientName ? `<strong>${data.recipientName}</strong>` : "Valued Customer"},</p>
    <p style="margin: 0 0 20px 0;">
      We are pleased to confirm that your recurring subscription for <strong>${data.companyName}</strong> has been successfully renewed. Your payment has cleared and full enterprise system access remains uninterrupted.
    </p>

    <!-- Payment Receipt Table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 13px;">
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569; width: 40%;">Subscription Plan:</td>
        <td style="padding: 10px 16px; color: #2563eb; font-weight: 700;">${data.planName}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Amount Paid:</td>
        <td style="padding: 10px 16px; color: #0f172a; font-weight: 800; font-size: 15px;">${data.amountPaidFormatted}</td>
      </tr>
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Payment Date:</td>
        <td style="padding: 10px 16px; color: #0f172a;">${data.paymentDate}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Coverage Billing Period:</td>
        <td style="padding: 10px 16px; color: #0f172a; font-weight: 600;">${data.newBillingPeriod}</td>
      </tr>
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Next Scheduled Renewal:</td>
        <td style="padding: 10px 16px; color: #0f172a;">${data.nextRenewalDate}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Transaction Reference:</td>
        <td style="padding: 10px 16px; color: #64748b; font-family: monospace; font-size: 12px;">${data.transactionRef}</td>
      </tr>
    </table>

    ${
      data.invoiceUrl
        ? `
    <p style="margin: 0 0 16px 0; font-size: 13px;">
      You can download a VAT/GST-compliant tax invoice and payment receipt directly via:
      <br>
      <a href="${data.invoiceUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: 600; text-decoration: underline;">
        Download Official Payment Invoice &rarr;
      </a>
    </p>
    `
        : ""
    }
  `;

  const { html, text } = buildEmailWrapper({
    headline: "Subscription Renewed Successfully",
    badge: {
      text: "Payment Cleared",
      bg: "#ecfdf5",
      color: "#059669",
      border: "#a7f3d0",
    },
    bodyHtml,
    cta: {
      text: "View Billing & Invoices",
      url: data.dashboardUrl || "https://miratechsuite.com/dashboard",
    },
    recipientEmail: data.recipientEmail,
    companyId: data.companyId,
    companyName: data.companyName,
  });

  return { subject, html, text };
}

// 5. Template: RENEWAL / PAYMENT FAILED
export function renderPaymentFailedEmail(data: PaymentFailedPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Action required: MiraTech Business Suite payment failed";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hello ${data.recipientName ? `<strong>${data.recipientName}</strong>` : "Valued Customer"},</p>
    <p style="margin: 0 0 20px 0;">
      We were unable to process the recurring subscription renewal payment for <strong>${data.companyName}</strong> on the <strong>${data.planName}</strong> plan.
    </p>

    <!-- Alert Box -->
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; font-weight: 700; color: #991b1b; width: 40%;">Attempted Amount:</td>
          <td style="padding: 6px 0; font-weight: 800; color: #b91c1c; font-size: 15px;">${data.amountAttemptedFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 700; color: #991b1b;">Attempt Date:</td>
          <td style="padding: 6px 0; color: #7f1d1d;">${data.failureDate}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 700; color: #991b1b;">Active Grace Period Ends:</td>
          <td style="padding: 6px 0; color: #991b1b; font-weight: 700;">${data.gracePeriodEndsAt || "Within 7 business days"}</td>
        </tr>
      </table>
    </div>

    <p style="margin: 0 0 14px 0;">
      Common reasons for this failure include an expired card, insufficient funds, or international transaction restrictions enforced by your financial institution.
    </p>
    
    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #92400e;">
      <strong>Workspace Protection Notice:</strong> In accordance with our service continuity policy, your corporate workspace has <strong>not</strong> been immediately disabled or deleted. We have placed your account in an administrative grace period. However, if payment cannot be successfully authorized before the grace period ends, access to paid enterprise features may be restricted.
    </div>

    <p style="margin: 0 0 16px 0;">
      Please update your payment method or retry the transaction immediately to prevent service interruption.
    </p>
  `;

  const { html, text } = buildEmailWrapper({
    headline: "Payment Processing Failed",
    badge: {
      text: "Action Required",
      bg: "#fef2f2",
      color: "#b91c1c",
      border: "#fecaca",
    },
    bodyHtml,
    cta: {
      text: "Update Payment Method & Retry",
      url: data.retryPaymentUrl,
    },
    recipientEmail: data.recipientEmail,
    companyId: data.companyId,
    companyName: data.companyName,
  });

  return { subject, html, text };
}

// 6. Template: SUBSCRIPTION CANCELLED / EXPIRED
export function renderSubscriptionEndedEmail(data: SubscriptionEndedPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Your MiraTech Business Suite subscription has ended";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hello ${data.recipientName ? `<strong>${data.recipientName}</strong>` : "Valued Customer"},</p>
    <p style="margin: 0 0 20px 0;">
      This email confirms that your subscription for <strong>${data.companyName}</strong> on the <strong>${data.planName}</strong> plan has concluded.
    </p>

    <!-- Details Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 13px;">
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569; width: 40%;">Termination Date:</td>
        <td style="padding: 10px 16px; color: #0f172a; font-weight: 600;">${data.endedDate}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Effective Access End Date:</td>
        <td style="padding: 10px 16px; color: #b91c1c; font-weight: 700;">${data.effectiveAccessEndDate}</td>
      </tr>
      <tr>
        <td style="padding: 10px 16px; font-weight: 700; color: #475569;">Current Status:</td>
        <td style="padding: 10px 16px; color: #64748b; font-weight: 600;">Access reverted to Free Starter Tier</td>
      </tr>
    </table>

    <!-- Data Retention Notice -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 18px; margin: 20px 0; font-size: 12px; color: #475569; line-height: 1.6;">
      <strong style="color: #0f172a; font-size: 13px;">Statutory Data Retention &amp; Security Policy:</strong><br>
      ${
        data.dataRetentionPolicyText ||
        "In compliance with statutory accounting regulations and enterprise data protection standards (GDPR/POPIA), your historical financial ledgers, posted journal entries, invoices, and audit logs are safely preserved in an encrypted, read-only archive for a statutory retention period. Your data will not be immediately deleted."
      }
    </div>

    <p style="margin: 0 0 16px 0;">
      If you changed your mind or wish to re-enable advanced inventory, multi-department accounting, and payroll automation, you can reactivate your subscription at any time.
    </p>
  `;

  const { html, text } = buildEmailWrapper({
    headline: "Subscription Concluded",
    badge: {
      text: "Subscription Ended",
      bg: "#f1f5f9",
      color: "#475569",
      border: "#cbd5e1",
    },
    bodyHtml,
    cta: {
      text: "Reactivate Subscription",
      url: data.reactivationUrl,
    },
    recipientEmail: data.recipientEmail,
    companyId: data.companyId,
    companyName: data.companyName,
  });

  return { subject, html, text };
}

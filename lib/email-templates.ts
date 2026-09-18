import { getEmailLegalConfig, EmailLegalConfig } from "./email-config";
import { getEmailGovernanceUrls } from "./email-tokens";
import { EmailCategory, MarketingEmailType, TransactionalEmailType } from "./email-types";

export interface EmailRenderOptions {
  recipientEmail: string;
  subject: string;
  category: EmailCategory;
  emailType: TransactionalEmailType | MarketingEmailType;
  headline?: string;
  bodyContent: string; // HTML string for body
  textContent?: string; // Plain text fallback
  userId?: string;
  companyId?: string;
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
  baseUrl?: string;
}

/**
 * Centrally maintained, legally structured Email Footer.
 * Renders required institutional identity, unsubscribe links, preference center link,
 * registered corporate address, privacy policy, terms of service, and statutory notice.
 */
export function renderEmailFooterHtml(params: {
  recipientEmail: string;
  category: EmailCategory;
  companyId?: string;
  userId?: string;
  companyDetails?: {
    name?: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  baseUrl?: string;
}): string {
  const config = getEmailLegalConfig(params.companyDetails);
  const urls = getEmailGovernanceUrls({
    email: params.recipientEmail,
    companyId: params.companyId,
    userId: params.userId,
    baseUrl: params.baseUrl,
  });

  const isTransactional = params.category === "TRANSACTIONAL";

  const relationshipNotice = isTransactional
    ? `You are receiving this essential service or transactional email because you have an active account, corporate workspace, subscription, or commercial engagement with ${config.brandName}. Essential account, billing, security, and statutory notices cannot be opted out of.`
    : `You are receiving this email because you have an account, subscription, or relationship with ${config.brandName}.`;

  return `
  <!-- START CENTRALIZED COMPLIANT EMAIL FOOTER -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <tr>
      <td style="color: #64748b; font-size: 12px; line-height: 1.6; text-align: left;">
        <p style="margin: 0 0 14px 0; color: #475569; font-size: 12px;">
          ${relationshipNotice}
        </p>

        <!-- Preference Controls & Unsubscribe Links -->
        <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 500;">
          <a href="${urls.preferencesUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">
            Manage your email preferences
          </a>
          <span style="color: #cbd5e1; margin: 0 8px;">|</span>
          <a href="${urls.unsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="color: #dc2626; text-decoration: underline; font-weight: 600;">
            Unsubscribe from marketing emails
          </a>
        </p>

        <!-- Legal Business Identity & Physical Address -->
        <div style="margin: 14px 0; padding: 12px 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px; color: #334155;">
          <strong style="color: #0f172a; font-size: 13px;">${config.brandName}</strong><br>
          <span style="color: #64748b;">Legal Entity:</span> ${config.legalBusinessName}<br>
          <span style="color: #64748b;">Registered Address:</span> ${config.registeredAddress}<br>
          <span style="color: #64748b;">Customer Support:</span> <a href="mailto:${config.supportEmail}" style="color: #2563eb; text-decoration: none;">${config.supportEmail}</a>
          ${config.supportPhone ? ` • <span style="color: #64748b;">Phone:</span> ${config.supportPhone}` : ""}
        </div>

        <!-- Statutory Terms & Privacy Links -->
        <p style="margin: 14px 0 8px 0; font-size: 12px; color: #64748b;">
          <a href="${urls.privacyUrl}" target="_blank" rel="noopener noreferrer" style="color: #475569; text-decoration: underline;">
            Privacy Policy
          </a>
          <span style="color: #cbd5e1; margin: 0 8px;">|</span>
          <a href="${urls.termsUrl}" target="_blank" rel="noopener noreferrer" style="color: #475569; text-decoration: underline;">
            Terms of Service
          </a>
          <span style="color: #cbd5e1; margin: 0 8px;">|</span>
          <a href="mailto:${config.dpoEmail}" style="color: #475569; text-decoration: underline;">
            Data Protection Officer
          </a>
        </p>

        <!-- Copyright -->
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">
          ${config.copyrightNotice}
        </p>
      </td>
    </tr>
  </table>
  <!-- END CENTRALIZED COMPLIANT EMAIL FOOTER -->
  `;
}

/**
 * Plain text footer for multi-part email clients.
 */
export function renderEmailFooterText(params: {
  recipientEmail: string;
  category: EmailCategory;
  companyId?: string;
  userId?: string;
  companyDetails?: {
    name?: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  baseUrl?: string;
}): string {
  const config = getEmailLegalConfig(params.companyDetails);
  const urls = getEmailGovernanceUrls({
    email: params.recipientEmail,
    companyId: params.companyId,
    userId: params.userId,
    baseUrl: params.baseUrl,
  });

  const isTransactional = params.category === "TRANSACTIONAL";
  const relationshipNotice = isTransactional
    ? `You are receiving this essential service or transactional email because you have an active account, corporate workspace, subscription, or commercial engagement with ${config.brandName}. Essential account, billing, security, and statutory notices cannot be opted out of.`
    : `You are receiving this email because you have an account, subscription, or relationship with ${config.brandName}.`;

  return `
----------------------------------------------------------------------
${relationshipNotice}

Manage your email preferences:
${urls.preferencesUrl}

Unsubscribe from marketing emails:
${urls.unsubscribeUrl}

${config.brandName}
Legal Entity: ${config.legalBusinessName}
Registered Address: ${config.registeredAddress}
Support Contact: ${config.supportEmail} ${config.supportPhone ? `(${config.supportPhone})` : ""}

Privacy Policy: ${urls.privacyUrl}
Terms of Service: ${urls.termsUrl}

${config.copyrightNotice}
----------------------------------------------------------------------
`;
}

/**
 * Master Template Wrapper: Every email in the system inherits this layout,
 * ensuring legal links and company info cannot accidentally be omitted.
 */
export function generateEmailHtml(options: EmailRenderOptions): {
  html: string;
  text: string;
} {
  const footerHtml = renderEmailFooterHtml({
    recipientEmail: options.recipientEmail,
    category: options.category,
    companyId: options.companyId,
    userId: options.userId,
    companyDetails: options.companyDetails,
    baseUrl: options.baseUrl,
  });

  const footerText = renderEmailFooterText({
    recipientEmail: options.recipientEmail,
    category: options.category,
    companyId: options.companyId,
    userId: options.userId,
    companyDetails: options.companyDetails,
    baseUrl: options.baseUrl,
  });

  const config = getEmailLegalConfig(options.companyDetails);

  const actionButtonHtml = options.extraAction
    ? `
      <div style="margin: 28px 0; text-align: left;">
        <a href="${options.extraAction.url}" target="_blank" rel="noopener noreferrer" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">
          ${options.extraAction.label} &rarr;
        </a>
      </div>
    `
    : "";

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
    }
  </style>
</head>
<body style="background-color: #f1f5f9; margin: 0; padding: 32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" style="max-width: 620px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04); text-align: left;">
          <!-- Signature MiraTech Dark Slate Header with Royal Sapphire Accent -->
          <tr>
            <td style="padding: 26px 36px; background-color: #0f172a; border-bottom: 3px solid #2563eb;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      MiraTech <span style="color: #60a5fa; font-weight: 500;">Business Suite</span>
                    </div>
                    <div style="font-size: 11px; font-weight: 500; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px;">
                      Enterprise Cloud Infrastructure &amp; Communications
                    </div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 6px; background-color: ${options.category === "TRANSACTIONAL" ? "rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.3);" : "rgba(37, 99, 235, 0.25); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4);"}">
                      ${options.category === "TRANSACTIONAL" ? "Account Notice" : "Official Update"}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Primary Email Content Body -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <!-- Headline / Subject -->
                ${
                  options.headline
                    ? `
                <tr>
                  <td>
                    <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; letter-spacing: -0.3px; line-height: 1.3;">
                      ${options.headline}
                    </h1>
                  </td>
                </tr>
                `
                    : ""
                }

                <!-- Email Primary Body -->
                <tr>
                  <td style="font-size: 15px; color: #334155; line-height: 1.6;">
                    ${options.bodyContent}
                    ${actionButtonHtml}
                  </td>
                </tr>

                <!-- Reusable Legal Footer Component -->
                <tr>
                  <td>
                    ${footerHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const plainText = `
${config.brandName} - ${options.subject}
${options.headline ? `\n${options.headline}\n` : ""}
${options.textContent || options.bodyContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}

${options.extraAction ? `\n[ ${options.extraAction.label} ]: ${options.extraAction.url}\n` : ""}

${footerText}
`.trim();

  return {
    html: fullHtml,
    text: plainText,
  };
}

/**
 * MiraTech Business Suite - Centralized Email & Legal Configuration
 * Configurable legal business entities, contact points, and compliance metadata.
 */

export interface EmailLegalConfig {
  legalBusinessName: string;
  brandName: string;
  registeredAddress: string;
  supportEmail: string;
  privacyEmail: string;
  dpoEmail: string;
  billingEmail: string;
  securityEmail: string;
  supportPhone: string;
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
  refundPolicyUrl: string;
  portalUrl: string;
  copyrightNotice: string;
  regulatoryNotice: string;
}

export const DEFAULT_EMAIL_LEGAL_CONFIG: EmailLegalConfig = {
  legalBusinessName: "MiraTech Industries & Software Solutions Ltd.",
  brandName: "MiraTech Business Suite",
  registeredAddress: "Commercial Park Phase II, Mbabane / Johannesburg",
  supportEmail: "miratechindustries@gmail.com",
  privacyEmail: "privacy@miratechsuite.com",
  dpoEmail: "dpo@miratechsuite.com",
  billingEmail: "billing@miratechsuite.com",
  securityEmail: "security@miratechsuite.com",
  supportPhone: "+268 7942 7339",
  privacyPolicyUrl: "/privacy",
  termsOfServiceUrl: "/terms",
  refundPolicyUrl: "/refund",
  portalUrl: "https://miratechsuite.com",
  copyrightNotice: `© ${new Date().getFullYear()} MiraTech Business Suite. All rights reserved.`,
  regulatoryNotice:
    "Electronic communication governance configured in alignment with applicable privacy directives (including GDPR Regulation (EU) 2016/679, South African POPIA Act 4 of 2013, CAN-SPAM Act 15 U.S.C. § 7704, and RFC 8058 One-Click specifications). Specific compliance obligations depend on applicable jurisdiction, business structure, communication classification, and governing statutory authorities.",
};

/**
 * Returns merged configuration for email footers, allowing individual companies to supply
 * custom registered names while falling back to institutional defaults.
 */
export function getEmailLegalConfig(customCompany?: {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
}): EmailLegalConfig {
  if (!customCompany) {
    return DEFAULT_EMAIL_LEGAL_CONFIG;
  }

  return {
    ...DEFAULT_EMAIL_LEGAL_CONFIG,
    legalBusinessName: customCompany.name || DEFAULT_EMAIL_LEGAL_CONFIG.legalBusinessName,
    registeredAddress: customCompany.address || DEFAULT_EMAIL_LEGAL_CONFIG.registeredAddress,
    supportEmail: customCompany.email || DEFAULT_EMAIL_LEGAL_CONFIG.supportEmail,
    supportPhone: customCompany.phone || DEFAULT_EMAIL_LEGAL_CONFIG.supportPhone,
  };
}

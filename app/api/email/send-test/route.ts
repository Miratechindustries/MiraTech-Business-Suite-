import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email-service";
import { EmailCategory, MarketingEmailType, TransactionalEmailType } from "@/lib/email-types";
import { testBrevoConnection, getBrevoSender } from "@/lib/brevo-client";

export async function GET() {
  try {
    const diagnostic = await testBrevoConnection();
    const sender = getBrevoSender();

    return NextResponse.json({
      status: "online",
      brevo: diagnostic,
      senderConfig: {
        name: sender.name,
        email: sender.email,
        configured: Boolean(process.env.BREVO_API_KEY),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Brevo diagnostic check failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      toEmail,
      category = "MARKETING",
      emailType = "FEATURE_ANNOUNCEMENTS",
      subject,
      headline,
      bodyContent,
      companyName,
    } = body;

    if (!toEmail || typeof toEmail !== "string" || !toEmail.includes("@")) {
      return NextResponse.json({ error: "A valid recipient email address is required." }, { status: 400 });
    }

    const isTransactional = category === "TRANSACTIONAL";
    const defaultSubject = isTransactional
      ? `[Important] Account Notification: Workspace Security & Billing Update`
      : `MiraTech Suite: Introducing Advanced Compliance & Preference Tools`;

    const defaultHeadline = isTransactional
      ? "Essential Account & Security Notice"
      : "Discover What's New in MiraTech Business Suite";

    const defaultBody = isTransactional
      ? `
        <p style="margin: 0 0 16px 0;">This is an essential service notice confirming your recent enterprise workspace maintenance cycle and automated account security verification.</p>
        <p style="margin: 0 0 16px 0;">Your active subscriptions and high-availability endpoints remain operational under standard enterprise service level agreements.</p>
      `
      : `
        <p style="margin: 0 0 16px 0;">We are thrilled to announce new institutional governance and compliance capabilities in your MiraTech Business Suite environment.</p>
        <p style="margin: 0 0 16px 0;">You can now orchestrate granular privacy preferences, automate customer-facing compliance footers, and view cryptographically verified audit trails.</p>
      `;

    const result = await sendEmail({
      toEmail,
      category: isTransactional ? "TRANSACTIONAL" : "MARKETING",
      emailType: isTransactional
        ? (emailType as TransactionalEmailType) || "SERVICE_NOTICE"
        : (emailType as MarketingEmailType) || "FEATURE_ANNOUNCEMENTS",
      subject: subject || defaultSubject,
      headline: headline || defaultHeadline,
      bodyContent: bodyContent || defaultBody,
      companyDetails: {
        name: companyName || "MiraTech Business Suite",
      },
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("[Send Test Email Error]", error);
    return NextResponse.json(
      { error: "Failed to dispatch test notification" },
      { status: 500 }
    );
  }
}

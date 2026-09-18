import { NextRequest, NextResponse } from "next/server";
import { sendCompanyProvisioned } from "@/lib/subscription-email-service";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      companyName,
      recipientEmail,
      recipientName,
      planName,
      enabledModules,
      accountCreationDate,
      loginUrl,
    } = body;

    if (!companyId || !recipientEmail) {
      return NextResponse.json(
        { error: "companyId and recipientEmail are required" },
        { status: 400 }
      );
    }

    // Default modules if not passed
    const resolvedModules =
      Array.isArray(enabledModules) && enabledModules.length > 0
        ? enabledModules
        : [
            "Double-Entry General Ledger",
            "Multi-Currency Invoicing",
            "Executive Audit Compliance",
            "Payroll Automation",
            "Operational Analytics",
          ];

    const result = await sendCompanyProvisioned({
      companyId,
      companyName: companyName || "Corporate Workspace",
      recipientEmail: recipientEmail.trim().toLowerCase(),
      recipientName: recipientName || "Company Administrator",
      planName: planName || "Enterprise Suite",
      enabledModules: resolvedModules,
      accountCreationDate:
        accountCreationDate || new Date().toLocaleDateString(),
      loginUrl:
        loginUrl ||
        `${process.env.NEXT_PUBLIC_APP_URL || "https://miratechsuite.com"}/login`,
      relatedEventId: `provision_${companyId}`,
    });

    return NextResponse.json({
      success: result.success,
      deliveryStatus: result.deliveryStatus,
      messageId: result.messageId,
    });
  } catch (err: any) {
    console.error("[API Error] company-provisioned email handler:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process provisioning email" },
      { status: 500 }
    );
  }
}

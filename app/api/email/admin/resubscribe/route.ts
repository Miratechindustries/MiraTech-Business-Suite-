import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, verifyAdminUser } from "@/lib/firebase-admin";
import { getEmailPreferenceDocId } from "@/lib/email-tokens";
import { recordEmailAuditLog } from "@/lib/email-service";

/**
 * Guard-railed Admin Resubscribe Endpoint.
 * Strictly prevents silent overrides of customer marketing unsubscribe preferences.
 * Requires verifiable customer-initiated consent and rationale.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded || !decoded.uid) {
      return NextResponse.json({ error: "Invalid admin authentication token" }, { status: 401 });
    }

    const isAdmin = await verifyAdminUser(decoded);

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Insufficient privilege. Only authorized administrators may handle customer resubscription requests." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { targetEmail, customerInitiatedReason, confirmedCustomerConsent } = body;

    if (!targetEmail || typeof targetEmail !== "string" || !targetEmail.includes("@")) {
      return NextResponse.json({ error: "A valid target recipient email is required." }, { status: 400 });
    }

    // MANDATORY GUARDRAIL: Prevent silent overrides without documented customer request
    if (!confirmedCustomerConsent) {
      return NextResponse.json(
        {
          error:
            "Statutory Guardrail: Administrators cannot override a recipient's unsubscribe status without documented customer consent.",
        },
        { status: 400 }
      );
    }

    if (!customerInitiatedReason || customerInitiatedReason.trim().length < 10) {
      return NextResponse.json(
        {
          error:
            "A specific reason documenting the customer-initiated request (minimum 10 characters, e.g., 'Customer request via Zendesk Ticket #1042') is legally required.",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = targetEmail.trim().toLowerCase();
    const docId = getEmailPreferenceDocId(normalizedEmail);
    const now = new Date().toISOString();

    const docRef = adminDb.collection("email_preferences").doc(docId);
    const existingSnap = await docRef.get();
    const current = existingSnap.exists ? existingSnap.data() : null;

    const updatedData = {
      ...(current || {}),
      email: normalizedEmail,
      marketingEnabled: true,
      productUpdatesEnabled: true,
      newsletterEnabled: true,
      featureAnnouncementsEnabled: true,
      educationalContentEnabled: true,
      promotionalOffersEnabled: true,
      unsubscribedAt: null,
      unsubscribeSource: null,
      consentTimestamp: now,
      consentSource: "customer_initiated_support_resubscription",
      lastAdminResubscribeBy: decoded.email || decoded.uid,
      lastAdminResubscribeReason: customerInitiatedReason.trim(),
      updatedAt: now,
    };

    await docRef.set(updatedData, { merge: true });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
    const userAgent = req.headers.get("user-agent") || "Admin Dashboard";

    // Record Immutable Audit Log
    const auditLogId = await recordEmailAuditLog({
      userId: current?.userId || decoded.uid,
      companyId: current?.companyId || (decoded as any).companyId,
      email: normalizedEmail,
      action: "ADMIN_RESUBSCRIBE_CUSTOMER_INITIATED",
      preferenceCategory: "marketingEnabled",
      previousValue: current ? { marketingEnabled: current.marketingEnabled, unsubscribedAt: current.unsubscribedAt } : null,
      newValue: { marketingEnabled: true, resubscribedAt: now },
      source: "admin_portal",
      ipAddress: ip,
      userAgent,
      details: `Admin ${decoded.email} resubscribed customer upon documented customer request: "${customerInitiatedReason.trim()}"`,
    });

    return NextResponse.json({
      success: true,
      message: `Customer ${normalizedEmail} was successfully resubscribed per customer request.`,
      auditLogId,
    });
  } catch (error: any) {
    console.error("[Admin Resubscribe Error]", error);
    return NextResponse.json(
      { error: "Failed to process customer resubscribe" },
      { status: 500 }
    );
  }
}

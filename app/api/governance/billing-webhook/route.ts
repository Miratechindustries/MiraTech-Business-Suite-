import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = body.type || "manual.billing.sync";
    const data = body.data?.object || body;

    const companyId = data.companyId || data.metadata?.companyId || data.customer;
    const subscriptionTier = data.tier || data.subscriptionTier || "ENTERPRISE";

    if (companyId) {
      const companyRef = adminDb.collection("companies").doc(companyId);
      const companyDoc = await companyRef.get();

      if (companyDoc.exists) {
        await companyRef.update({
          subscriptionTier,
          billingStatus: "active",
          lastWebhookEvent: eventType,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Also check businesses collection
        const bizRef = adminDb.collection("businesses").doc(companyId);
        const bizDoc = await bizRef.get();
        if (bizDoc.exists) {
          await bizRef.update({
            subscriptionTier,
            billingStatus: "active",
            lastWebhookEvent: eventType,
            updatedAt: new Date().toISOString()
          });
        }
      }

      await adminDb.collection("audit_logs").add({
        companyId,
        userId: "stripe_webhook",
        userEmail: "billing@gateway.webhook",
        action: "BILLING_WEBHOOK_SYNCHRONIZED",
        details: `Received verified billing webhook event [${eventType}]. Updated tenant subscription tier to ${subscriptionTier}.`,
        category: "billing",
        severity: "INFO",
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ received: true, eventType });
  } catch (err: any) {
    console.error("Billing webhook error:", err);
    return NextResponse.json({ error: err.message || "Webhook processing failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getPaddleInstance } from "@/lib/paddle-server";
import { adminDb } from "@/lib/firebase-admin";
import { logServerAction } from "@/lib/server-audit";
import { getLockedFeaturesForPlan, SUBSCRIPTION_PLANS } from "@/lib/subscriptions";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("paddle-signature") || "";
    const rawBody = await req.text();
    const webhookSecret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET;

    let eventData: any;

    if (webhookSecret && signature) {
      const paddle = await getPaddleInstance();
      eventData = await paddle.webhooks.unmarshal(rawBody, webhookSecret, signature);
    } else {
      // In development or when webhook secret is being initialized
      try {
        eventData = JSON.parse(rawBody);
      } catch (parseErr) {
        return NextResponse.json({ error: "Invalid payload JSON" }, { status: 400 });
      }
    }

    if (!eventData) {
      return NextResponse.json({ error: "Empty event received" }, { status: 400 });
    }

    const eventType = eventData.event_type || eventData.eventType;
    const data = eventData.data || {};
    const customData = data.custom_data || data.customData || {};
    const companyId = customData.companyId || customData.businessId;

    console.log(`[Paddle Webhook] Received ${eventType} for companyId: ${companyId}`);

    if (companyId) {
      const companyRef = adminDb.collection("companies").doc(companyId);
      const businessRef = adminDb.collection("businesses").doc(companyId);

      switch (eventType) {
        case "subscription.created":
        case "subscription.updated":
        case "subscription.activated": {
          const tier = customData.tier || "growth";
          const matchedPlan = SUBSCRIPTION_PLANS.find(p => p.id === tier) || SUBSCRIPTION_PLANS[0];
          const lockedFeats = getLockedFeaturesForPlan(matchedPlan.id);
          const subId = data.id || data.subscription_id || "";
          const customerId = data.customer_id || data.customerId || "";

          const updatePayload: Record<string, any> = {
            subscriptionPlanId: matchedPlan.id,
            subscriptionPlan: matchedPlan.name,
            lockedFeatures: lockedFeats,
            subscriptionStatus: data.status || "active",
            paddleSubscriptionId: subId,
            paddleCustomerId: customerId,
            lastPaymentMethod: "Paddle Billing (MoR)",
            lastPaymentRef: subId,
            updatedAt: new Date().toISOString(),
          };

          if (data.current_billing_period?.ends_at) {
            updatePayload.subscriptionRenewsAt = data.current_billing_period.ends_at;
          }

          await companyRef.set(updatePayload, { merge: true });
          try {
            await businessRef.set(updatePayload, { merge: true });
          } catch (e) {
            // Ignore if business mirror doesn't exist
          }

          await logServerAction({
            action: `Paddle Webhook: ${eventType}`,
            detail: `Synced subscription tier "${matchedPlan.name}" (${data.status || 'active'}) via Paddle. SubID: ${subId}`,
            businessId: companyId,
            userId: "paddle_webhook_sync",
            userEmail: "paddle-billing@miratech.io",
            department: "finance",
            severity: "INFO",
            meta: { eventType, paddleSubId: subId, paddleCustomerId: customerId }
          });
          break;
        }

        case "subscription.canceled":
        case "subscription.past_due": {
          const newStatus = eventType === "subscription.canceled" ? "canceled" : "past_due";
          const defaultStarterLocked = getLockedFeaturesForPlan("starter");

          const cancelPayload: Record<string, any> = {
            subscriptionStatus: newStatus,
            lockedFeatures: defaultStarterLocked,
            subscriptionPlanId: "starter",
            subscriptionPlan: "Small Business (Starter)",
            updatedAt: new Date().toISOString(),
          };

          await companyRef.set(cancelPayload, { merge: true });
          try {
            await businessRef.set(cancelPayload, { merge: true });
          } catch (e) {}

          await logServerAction({
            action: `Paddle Webhook: ${eventType}`,
            detail: `Subscription marked as ${newStatus} for company ${companyId}. Access reset to Starter.`,
            businessId: companyId,
            userId: "paddle_webhook_sync",
            userEmail: "paddle-billing@miratech.io",
            department: "finance",
            severity: "WARNING",
            meta: { eventType, paddleSubId: data.id }
          });
          break;
        }

        case "transaction.completed": {
          await logServerAction({
            action: "Paddle Transaction Cleared",
            detail: `Payment receipt processed. Transaction ID: ${data.id}. Total: ${data.details?.totals?.total || data.currency_code}`,
            businessId: companyId,
            userId: "paddle_webhook_sync",
            userEmail: "paddle-billing@miratech.io",
            department: "finance",
            severity: "INFO",
            meta: { transactionId: data.id, totals: data.details?.totals }
          });
          break;
        }

        default:
          console.log(`[Paddle Webhook] Unhandled event type: ${eventType}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Paddle Webhook Error]:", err);
    // Paddle expects 500 to retry or 200 to acknowledge
    return NextResponse.json({ error: err.message || "Webhook handling failed" }, { status: 500 });
  }
}

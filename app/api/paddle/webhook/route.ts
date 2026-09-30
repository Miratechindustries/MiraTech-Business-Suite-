import { NextRequest, NextResponse } from "next/server";
import { getPaddleInstance } from "@/lib/paddle-server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { logServerAction } from "@/lib/server-audit";
import { getLockedFeaturesForPlan, SUBSCRIPTION_PLANS } from "@/lib/subscriptions";
import {
  sendSubscriptionConfirmation,
  sendRenewalConfirmation,
  sendPaymentFailed,
  sendSubscriptionEnded,
  resolveCompanyNotificationRecipient,
} from "@/lib/subscription-email-service";

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

    // Persist raw notification for admin dashboard
    await adminDb.collection("paddle_notifications").add({
      ...eventData,
      receivedAt: new Date().toISOString(),
    });

    const eventType = eventData.event_type || eventData.eventType;
    const data = eventData.data || {};
    const customData = data.custom_data || data.customData || {};
    let companyId = customData.companyId || customData.businessId;

    // Resilient fallback lookup if custom_data wasn't attached
    if (!companyId && (data.id || data.subscription_id)) {
      const subId = data.id || data.subscription_id;
      const snap = await adminDb.collection("companies").where("paddleSubscriptionId", "==", subId).limit(1).get();
      if (!snap.empty) {
        companyId = snap.docs[0].id;
      }
    }

    if (!companyId && (data.customer_id || data.customerId)) {
      const custId = data.customer_id || data.customerId;
      const snap = await adminDb.collection("companies").where("paddleCustomerId", "==", custId).limit(1).get();
      if (!snap.empty) {
        companyId = snap.docs[0].id;
      }
    }

    console.log(`[Paddle Webhook] Received ${eventType} for resolved companyId: ${companyId}`);

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
          const resolvedStatus = data.status || "active";
          const nextBillingDate = data.next_billed_at || data.current_billing_period?.ends_at || null;

          const updatePayload: Record<string, any> = {
            status: resolvedStatus,
            next_billing_date: nextBillingDate,
            subscriptionStatus: resolvedStatus,
            nextBillingDate: nextBillingDate,
            subscriptionPlanId: matchedPlan.id,
            subscriptionPlan: matchedPlan.name,
            tier: matchedPlan.id,
            plan: matchedPlan.id,
            lockedFeatures: lockedFeats,
            paddleSubscriptionId: subId,
            paddleCustomerId: customerId,
            lastPaymentMethod: "Paddle Billing (MoR)",
            lastPaymentRef: subId,
            updatedAt: new Date().toISOString(),
          };

          if (nextBillingDate) {
            updatePayload.subscriptionRenewsAt = nextBillingDate;
          }

          await companyRef.set(updatePayload, { merge: true });
          try {
            await businessRef.set(updatePayload, { merge: true });
          } catch (e) {
            // Ignore if business mirror doesn't exist
          }

          await logServerAction({
            action: `Paddle Webhook: ${eventType}`,
            detail: `Synced subscription status "${resolvedStatus}", tier "${matchedPlan.name}", next billing date: ${nextBillingDate || 'N/A'}. SubID: ${subId}`,
            businessId: companyId,
            userId: "paddle_webhook_sync",
            userEmail: "paddle-billing@miratech.io",
            department: "finance",
            severity: "INFO",
            meta: { eventType, paddleSubId: subId, paddleCustomerId: customerId, status: resolvedStatus, next_billing_date: nextBillingDate }
          });

          // Dispatch 1. SUBSCRIPTION CONFIRMED Transactional Notification
          if (eventType === "subscription.created" || eventType === "subscription.activated") {
            try {
              const recipient = await resolveCompanyNotificationRecipient(companyId, eventData);
              const isTrial = resolvedStatus === "trialing" || Boolean(data.trial_period);
              const priceStr = data.items?.[0]?.price?.unit_price?.amount
                ? `$${(Number(data.items[0].price.unit_price.amount) / 100).toFixed(2)}`
                : String(matchedPlan.price || "$149.00");

              await sendSubscriptionConfirmation({
                companyId,
                companyName: recipient.companyName,
                recipientEmail: recipient.recipientEmail,
                recipientName: recipient.recipientName,
                planName: matchedPlan.name,
                priceFormatted: priceStr,
                billingInterval: data.billing_cycle?.interval || "monthly",
                startDate: new Date().toLocaleDateString(),
                nextBillingDate: nextBillingDate ? new Date(nextBillingDate).toLocaleDateString() : null,
                isTrial,
                trialDays: 14,
                trialEndsAt: nextBillingDate ? new Date(nextBillingDate).toLocaleDateString() : null,
                relatedEventId: eventData.event_id || data.id,
                subscriptionId: subId,
                customerId,
              });
            } catch (emailErr) {
              console.error("[Paddle Webhook] Error dispatching subscription confirmation email:", emailErr);
            }
          }
          break;
        }

        case "subscription.canceled": {
          const newStatus = "canceled";
          const defaultStarterLocked = getLockedFeaturesForPlan("starter");

          const cancelPayload: Record<string, any> = {
            status: newStatus,
            next_billing_date: null,
            subscriptionStatus: newStatus,
            nextBillingDate: null,
            subscriptionRenewsAt: null,
            canceledAt: data.canceled_at || new Date().toISOString(),
            lockedFeatures: defaultStarterLocked,
            subscriptionPlanId: "starter",
            subscriptionPlan: "Small Business (Starter)",
            tier: "starter",
            plan: "starter",
            updatedAt: new Date().toISOString(),
          };

          await companyRef.set(cancelPayload, { merge: true });
          try {
            await businessRef.set(cancelPayload, { merge: true });
          } catch (e) {}

          await logServerAction({
            action: `Paddle Webhook: ${eventType}`,
            detail: `Subscription canceled in Paddle for company ${companyId}. Status updated to canceled; next_billing_date cleared. Access reset to Starter.`,
            businessId: companyId,
            userId: "paddle_webhook_sync",
            userEmail: "paddle-billing@miratech.io",
            department: "finance",
            severity: "WARNING",
            meta: { eventType, paddleSubId: data.id, status: newStatus, next_billing_date: null }
          });

          // Dispatch 6. SUBSCRIPTION CANCELLED/EXPIRED Transactional Notification
          try {
            const recipient = await resolveCompanyNotificationRecipient(companyId, eventData);
            const endedDate = new Date().toLocaleDateString();
            await sendSubscriptionEnded({
              companyId,
              companyName: recipient.companyName,
              recipientEmail: recipient.recipientEmail,
              recipientName: recipient.recipientName,
              planName: "Enterprise Plan",
              endedDate,
              effectiveAccessEndDate: endedDate,
              reactivationUrl: "https://miratechsuite.com/dashboard?tab=admin&subtab=billing",
              relatedEventId: eventData.event_id || data.id,
              subscriptionId: data.id,
            });
          } catch (emailErr) {
            console.error("[Paddle Webhook] Error dispatching subscription ended email:", emailErr);
          }
          break;
        }

        case "subscription.past_due": {
          const newStatus = "past_due";
          const nextBillingDate = data.next_billed_at || data.current_billing_period?.ends_at || null;

          const pastDuePayload: Record<string, any> = {
            status: newStatus,
            subscriptionStatus: newStatus,
            next_billing_date: nextBillingDate,
            nextBillingDate: nextBillingDate,
            updatedAt: new Date().toISOString(),
          };

          await companyRef.set(pastDuePayload, { merge: true });
          try {
            await businessRef.set(pastDuePayload, { merge: true });
          } catch (e) {}

          await logServerAction({
            action: `Paddle Webhook: ${eventType}`,
            detail: `Subscription marked as past_due for company ${companyId}. Next attempt: ${nextBillingDate || 'Pending'}.`,
            businessId: companyId,
            userId: "paddle_webhook_sync",
            userEmail: "paddle-billing@miratech.io",
            department: "finance",
            severity: "WARNING",
            meta: { eventType, paddleSubId: data.id, status: newStatus, next_billing_date: nextBillingDate }
          });

          // Dispatch 5. RENEWAL/PAYMENT FAILED Transactional Notification
          try {
            const recipient = await resolveCompanyNotificationRecipient(companyId, eventData);
            const failureDate = new Date().toLocaleDateString();
            await sendPaymentFailed({
              companyId,
              companyName: recipient.companyName,
              recipientEmail: recipient.recipientEmail,
              recipientName: recipient.recipientName,
              planName: recipient.planName,
              amountAttemptedFormatted: "$149.00",
              failureDate,
              retryPaymentUrl: "https://miratechsuite.com/dashboard?tab=admin&subtab=billing",
              gracePeriodEndsAt: nextBillingDate ? new Date(nextBillingDate).toLocaleDateString() : "7 business days",
              relatedEventId: eventData.event_id || data.id,
              subscriptionId: data.id,
            });
          } catch (emailErr) {
            console.error("[Paddle Webhook] Error dispatching payment failed email:", emailErr);
          }
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

          // Dispatch 4. SUBSCRIPTION RENEWAL SUCCESS (if recurring subscription payment)
          const isRecurring = data.origin === "subscription_recurring" || Boolean(data.subscription_id);
          if (isRecurring) {
            try {
              const recipient = await resolveCompanyNotificationRecipient(companyId, eventData);
              const totalAmount = data.details?.totals?.total
                ? `$${(Number(data.details.totals.total) / 100).toFixed(2)}`
                : "$149.00";

              await sendRenewalConfirmation({
                companyId,
                companyName: recipient.companyName,
                recipientEmail: recipient.recipientEmail,
                recipientName: recipient.recipientName,
                planName: recipient.planName,
                amountPaidFormatted: totalAmount,
                paymentDate: new Date().toLocaleDateString(),
                newBillingPeriod: "30-Day Billing Cycle",
                nextRenewalDate: "Next Month",
                transactionRef: data.id,
                invoiceUrl: data.receipt_url || data.invoice_url || null,
                relatedEventId: eventData.event_id || data.id,
                subscriptionId: data.subscription_id,
              });
            } catch (emailErr) {
              console.error("[Paddle Webhook] Error dispatching renewal confirmation email:", emailErr);
            }
          }
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

export async function GET() {
  return NextResponse.json({
    service: "Paddle Webhook Listener",
    status: "active",
    supportedEvents: [
      "subscription.created",
      "subscription.updated",
      "subscription.activated",
      "subscription.canceled",
      "subscription.past_due",
      "transaction.completed"
    ],
    monitoredFields: [
      "status",
      "next_billing_date",
      "subscriptionStatus",
      "nextBillingDate"
    ],
    timestamp: new Date().toISOString()
  });
}


import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  sendTrialEndingReminder,
  resolveCompanyNotificationRecipient,
} from "@/lib/subscription-email-service";

/**
 * Scheduled Cron Job: Trial Expiration Reminders (3 Days Prior)
 * 
 * Scans active trialing companies. Identifies companies whose trial expires
 * within 3 days (between 0 and 3.2 days remaining), ensuring that cancelled
 * or converted companies are strictly excluded.
 * 
 * Leverages deterministic idempotency to guarantee exactly one reminder per trial.
 */
export async function GET(req: NextRequest) {
  return handleTrialReminders();
}

export async function POST(req: NextRequest) {
  return handleTrialReminders();
}

async function handleTrialReminders() {
  const now = new Date();
  const nowMs = now.getTime();
  const results = {
    scanned: 0,
    eligible: 0,
    dispatched: 0,
    alreadySent: 0,
    errors: [] as string[],
    companiesProcessed: [] as string[],
  };

  try {
    // 1. Query all companies with trialing status
    const trialingSnap = await adminDb
      .collection("companies")
      .where("subscriptionStatus", "==", "trialing")
      .get();

    results.scanned = trialingSnap.size;

    for (const docSnap of trialingSnap.docs) {
      const data = docSnap.data();
      const companyId = docSnap.id;

      // Ensure subscription has not been cancelled or converted
      const currentStatus = data.subscriptionStatus || data.status;
      if (currentStatus === "canceled" || currentStatus === "active") {
        continue;
      }

      // Check trial expiration timestamp
      const trialEndStr = data.subscriptionTrialEndsAt || data.trialEndsAt;
      if (!trialEndStr) continue;

      const trialEndDate = new Date(trialEndStr);
      const trialEndMs = trialEndDate.getTime();

      if (isNaN(trialEndMs)) continue;

      const diffDays = (trialEndMs - nowMs) / (1000 * 60 * 60 * 24);

      // Trigger condition: Exactly 3 days before trial ends (within 0 to 3.2 days window)
      if (diffDays > 0 && diffDays <= 3.25) {
        results.eligible++;

        try {
          const recipient = await resolveCompanyNotificationRecipient(
            companyId,
            { data: { customer_email: data.officialEmail } }
          );

          const appUrl =
            process.env.NEXT_PUBLIC_APP_URL || "https://miratechsuite.com";

          const formattedExpiry = trialEndDate.toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
          });

          // Idempotency identifier based on trial expiration epoch day
          const epochDay = Math.floor(trialEndMs / (1000 * 60 * 60 * 24));
          const sendResult = await sendTrialEndingReminder({
            companyId,
            companyName: recipient.companyName,
            recipientEmail: recipient.recipientEmail,
            recipientName: recipient.recipientName,
            planName: recipient.planName || "Enterprise Growth Plan",
            trialExpiresAt: formattedExpiry,
            chargeAmountFormatted: data.subscriptionPrice || "$149.00",
            billingInterval: data.subscriptionBillingCycle || "monthly",
            manageSubscriptionUrl: `${appUrl}/dashboard?tab=admin&subtab=billing`,
            dashboardUrl: `${appUrl}/dashboard`,
            relatedEventId: `epoch_${epochDay}`,
            subscriptionId: data.paddleSubscriptionId || companyId,
          });

          if (sendResult.deliveryStatus === "ALREADY_SENT") {
            results.alreadySent++;
          } else if (sendResult.success) {
            results.dispatched++;
          }

          results.companiesProcessed.push(companyId);
        } catch (dispatchErr: any) {
          console.error(
            `[Trial Reminder Error] Company ${companyId}:`,
            dispatchErr
          );
          results.errors.push(`${companyId}: ${dispatchErr.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      ...results,
    });
  } catch (err: any) {
    console.error("[Trial Reminders Cron Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to execute trial reminder scan" },
      { status: 500 }
    );
  }
}

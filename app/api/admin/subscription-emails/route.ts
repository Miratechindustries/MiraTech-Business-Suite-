import { NextRequest, NextResponse } from "next/server";
import {
  querySubscriptionEmailEvents,
  retrySubscriptionEmail,
  sendSubscriptionConfirmation,
  sendCompanyProvisioned,
  sendTrialEndingReminder,
  sendRenewalConfirmation,
  sendPaymentFailed,
  sendSubscriptionEnded,
} from "@/lib/subscription-email-service";
import { SubscriptionEmailEventType } from "@/lib/subscription-email-types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";
    const limitCount = parseInt(searchParams.get("limit") || "50", 10);

    const events = await querySubscriptionEmailEvents({
      status,
      limitCount,
    });

    return NextResponse.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (err: any) {
    console.error("[API Error] query subscription email events:", err);
    return NextResponse.json(
      { error: err.message || "Failed to query subscription email events" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;

    // 1. Retry failed email
    if (action === "retry") {
      const { eventId } = body;
      if (!eventId) {
        return NextResponse.json({ error: "eventId is required" }, { status: 400 });
      }

      const retryResult = await retrySubscriptionEmail(eventId);
      return NextResponse.json(retryResult);
    }

    // 2. Dispatch simulated / test subscription email
    if (action === "test_send") {
      const emailType: SubscriptionEmailEventType = body.emailType;
      const targetEmail = body.targetEmail || "miratechindustries@gmail.com";
      const companyName = body.companyName || "Acme Logistics Global Inc.";
      const recipientName = body.recipientName || "Alexander Thorne";
      const companyId = body.companyId || `test_comp_${Date.now()}`;
      const timestampNonce = Date.now().toString().slice(-6);

      let result: any;

      switch (emailType) {
        case "SUBSCRIPTION_CONFIRMED":
          result = await sendSubscriptionConfirmation({
            companyId,
            companyName,
            recipientEmail: targetEmail,
            recipientName,
            planName: "Enterprise Tier",
            priceFormatted: "$149.00",
            billingInterval: "monthly",
            startDate: new Date().toLocaleDateString(),
            nextBillingDate: new Date(Date.now() + 14 * 86400000).toLocaleDateString(),
            isTrial: true,
            trialDays: 14,
            trialEndsAt: new Date(Date.now() + 14 * 86400000).toLocaleDateString(),
            relatedEventId: `test_confirm_${timestampNonce}`,
          });
          break;

        case "COMPANY_PROVISIONED":
          result = await sendCompanyProvisioned({
            companyId,
            companyName,
            recipientEmail: targetEmail,
            recipientName,
            planName: "Enterprise Tier",
            enabledModules: [
              "General Ledger & Audit",
              "Double-Entry Accounts",
              "Multi-Currency Invoicing",
              "Payroll Automation",
              "Compliance Center",
            ],
            accountCreationDate: new Date().toLocaleDateString(),
            loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://miratechsuite.com"}/login`,
            relatedEventId: `test_provision_${timestampNonce}`,
          });
          break;

        case "TRIAL_ENDING_REMINDER":
          result = await sendTrialEndingReminder({
            companyId,
            companyName,
            recipientEmail: targetEmail,
            recipientName,
            planName: "Growth Tier",
            trialExpiresAt: new Date(Date.now() + 3 * 86400000).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
            chargeAmountFormatted: "$149.00",
            billingInterval: "monthly",
            manageSubscriptionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://miratechsuite.com"}/dashboard?tab=admin&subtab=billing`,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://miratechsuite.com"}/dashboard`,
            relatedEventId: `test_trial_end_${timestampNonce}`,
          });
          break;

        case "SUBSCRIPTION_RENEWAL_SUCCESS":
          result = await sendRenewalConfirmation({
            companyId,
            companyName,
            recipientEmail: targetEmail,
            recipientName,
            planName: "Enterprise Tier",
            amountPaidFormatted: "$149.00",
            paymentDate: new Date().toLocaleDateString(),
            newBillingPeriod: "Next 30-Day Cycle",
            nextRenewalDate: new Date(Date.now() + 30 * 86400000).toLocaleDateString(),
            transactionRef: `tx_pad_${timestampNonce}`,
            invoiceUrl: "https://miratechsuite.com/invoices/sample-receipt.pdf",
            relatedEventId: `test_renew_${timestampNonce}`,
          });
          break;

        case "PAYMENT_FAILED":
          result = await sendPaymentFailed({
            companyId,
            companyName,
            recipientEmail: targetEmail,
            recipientName,
            planName: "Enterprise Tier",
            amountAttemptedFormatted: "$149.00",
            failureDate: new Date().toLocaleDateString(),
            retryPaymentUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://miratechsuite.com"}/dashboard?tab=admin&subtab=billing`,
            gracePeriodEndsAt: "in 7 business days",
            relatedEventId: `test_fail_${timestampNonce}`,
          });
          break;

        case "SUBSCRIPTION_ENDED":
          result = await sendSubscriptionEnded({
            companyId,
            companyName,
            recipientEmail: targetEmail,
            recipientName,
            planName: "Enterprise Tier",
            endedDate: new Date().toLocaleDateString(),
            effectiveAccessEndDate: new Date().toLocaleDateString(),
            reactivationUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://miratechsuite.com"}/dashboard?tab=admin&subtab=billing`,
            relatedEventId: `test_ended_${timestampNonce}`,
          });
          break;

        default:
          return NextResponse.json(
            { error: `Unknown emailType: ${emailType}` },
            { status: 400 }
          );
      }

      return NextResponse.json({
        success: true,
        emailType,
        result,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[API Error] subscription emails action:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process request" },
      { status: 500 }
    );
  }
}

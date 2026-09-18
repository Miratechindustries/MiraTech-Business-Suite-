import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, verifyAdminUser } from "@/lib/firebase-admin";
import { sendEmail, recordEmailAuditLog } from "@/lib/email-service";
import { generateEmailHtml } from "@/lib/email-templates";
import { MarketingEmailType } from "@/lib/email-types";

/**
 * Master Admin Marketing Email Portal API
 * 
 * Capabilities:
 * - GET: Fetch marketing campaign dispatch history & company subscriber lists
 * - POST: Compose & dispatch marketing emails to individual recipients, all active companies, or custom subscriber segments
 * - Strictly dispatches through Brevo with Miratech signature styling, RFC 8058 headers, and opt-out checking.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded || !decoded.uid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isAuthorized = await verifyAdminUser(decoded, true);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Access denied. Administrator or Marketing privileges required." }, { status: 403 });
    }

    // 1. Fetch recent marketing campaigns / audit dispatches
    const campaignsSnap = await adminDb
      .collection("marketing_campaigns")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get()
      .catch(async () => {
        // Fallback to empty if collection not yet populated
        return { docs: [] } as any;
      });

    const campaigns: any[] = [];
    campaignsSnap.docs.forEach((docSnap: any) => {
      campaigns.push({
        id: docSnap.id,
        ...docSnap.data(),
      });
    });

    // 2. Fetch companies to build audience segments
    const companiesSnap = await adminDb.collection("companies").limit(200).get();
    const companies: any[] = [];
    companiesSnap.forEach((docSnap: any) => {
      const d = docSnap.data();
      if (d.email || d.officialEmail) {
        companies.push({
          id: docSnap.id,
          name: d.name || "Unnamed Organization",
          email: d.email || d.officialEmail,
          plan: d.subscriptionPlanId || d.tier || "starter",
          status: d.subscriptionStatus || "active",
        });
      }
    });

    // 3. Count total active opt-in preferences
    const prefsSnap = await adminDb
      .collection("email_preferences")
      .where("marketingEnabled", "==", false)
      .get()
      .catch(() => ({ size: 0 }));

    return NextResponse.json({
      success: true,
      campaigns,
      companies,
      suppressedRecipientsCount: prefsSnap.size || 0,
      totalRegisteredCompanies: companies.length,
    });
  } catch (err: any) {
    console.error("[Marketing Email API Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to load marketing email portal metadata" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded || !decoded.uid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isAuthorized = await verifyAdminUser(decoded, true);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Access denied. Administrator or Marketing privileges required." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      subject,
      headline,
      bodyContent,
      marketingType = "FEATURE_ANNOUNCEMENTS",
      targetAudience = "CUSTOM", // "ALL_COMPANIES", "ACTIVE_SUBSCRIBERS", "TRIALING", "CUSTOM"
      customRecipients = [],
      actionLabel,
      actionUrl,
      companyBrandName = "MiraTech Business Suite",
    } = body;

    if (!subject || typeof subject !== "string" || subject.trim().length < 3) {
      return NextResponse.json({ error: "Subject must be at least 3 characters." }, { status: 400 });
    }

    if (!bodyContent || typeof bodyContent !== "string" || bodyContent.trim().length < 10) {
      return NextResponse.json({ error: "Email body content is required." }, { status: 400 });
    }

    // Determine recipient list
    let targetEmails: { email: string; companyName?: string; companyId?: string }[] = [];

    if (targetAudience === "CUSTOM") {
      if (!Array.isArray(customRecipients) || customRecipients.length === 0) {
        return NextResponse.json({ error: "Please supply at least one recipient email." }, { status: 400 });
      }
      targetEmails = customRecipients
        .filter((em: string) => typeof em === "string" && em.includes("@"))
        .map((em: string) => ({ email: em.trim().toLowerCase() }));
    } else {
      // Query companies from Firestore
      const companiesSnap = await adminDb.collection("companies").limit(300).get();
      companiesSnap.forEach((docSnap: any) => {
        const d = docSnap.data();
        const em = (d.email || d.officialEmail || "").trim().toLowerCase();
        if (!em || !em.includes("@")) return;

        const subStatus = d.subscriptionStatus || d.status || "active";

        if (targetAudience === "ALL_COMPANIES") {
          targetEmails.push({ email: em, companyName: d.name, companyId: docSnap.id });
        } else if (targetAudience === "ACTIVE_SUBSCRIBERS" && subStatus === "active") {
          targetEmails.push({ email: em, companyName: d.name, companyId: docSnap.id });
        } else if (targetAudience === "TRIALING" && subStatus === "trialing") {
          targetEmails.push({ email: em, companyName: d.name, companyId: docSnap.id });
        }
      });
    }

    // Deduplicate emails
    const uniqueMap = new Map<string, { email: string; companyName?: string; companyId?: string }>();
    targetEmails.forEach((item) => {
      if (!uniqueMap.has(item.email)) {
        uniqueMap.set(item.email, item);
      }
    });

    const finalRecipientList = Array.from(uniqueMap.values());

    if (finalRecipientList.length === 0) {
      return NextResponse.json(
        { error: "No valid recipient email addresses found for the chosen audience." },
        { status: 400 }
      );
    }

    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const results = {
      total: finalRecipientList.length,
      dispatched: 0,
      blockedByPreferences: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Execute dispatch sequentially or with small batching to respect Brevo rate limits
    for (const recipient of finalRecipientList) {
      try {
        const sendRes = await sendEmail({
          toEmail: recipient.email,
          category: "MARKETING",
          emailType: marketingType as MarketingEmailType,
          subject: subject.trim(),
          headline: headline?.trim() || subject.trim(),
          bodyContent: bodyContent.trim(),
          companyId: recipient.companyId,
          companyDetails: {
            name: recipient.companyName || companyBrandName,
          },
          extraAction: actionLabel && actionUrl ? { label: actionLabel.trim(), url: actionUrl.trim() } : undefined,
        });

        if (sendRes.blockedByPreferences) {
          results.blockedByPreferences++;
        } else if (sendRes.sent) {
          results.dispatched++;
        } else {
          results.failed++;
          if (sendRes.error) {
            results.errors.push(`${recipient.email}: ${sendRes.error}`);
          }
        }
      } catch (sendErr: any) {
        results.failed++;
        results.errors.push(`${recipient.email}: ${sendErr?.message || "Transmission error"}`);
      }
    }

    // Save Campaign Record in Firestore for Master Admin Audit
    await adminDb.collection("marketing_campaigns").doc(campaignId).set({
      id: campaignId,
      subject: subject.trim(),
      headline: headline?.trim() || null,
      bodyPreview: bodyContent.slice(0, 200).replace(/<[^>]+>/g, " ").trim(),
      marketingType,
      targetAudience,
      recipientCount: results.total,
      dispatchedCount: results.dispatched,
      blockedCount: results.blockedByPreferences,
      failedCount: results.failed,
      createdBy: decoded.email,
      createdAt: new Date().toISOString(),
      actionLabel: actionLabel || null,
      actionUrl: actionUrl || null,
    });

    return NextResponse.json({
      success: true,
      campaignId,
      results,
    });
  } catch (err: any) {
    console.error("[Marketing Dispatch Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to process marketing campaign dispatch" },
      { status: 500 }
    );
  }
}

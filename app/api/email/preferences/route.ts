import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email-tokens";
import { adminAuth } from "@/lib/firebase-admin";
import {
  getFreshEmailPreferences,
  updateRecipientEmailPreferences,
  getDefaultEmailPreferences,
} from "@/lib/email-service";

/**
 * Resolves current email preferences either via secure token OR authenticated session.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const authHeader = req.headers.get("authorization");

    let targetEmail: string | null = null;
    let userId: string | undefined;
    let companyId: string | undefined;

    if (token) {
      const payload = verifyUnsubscribeToken(token);
      if (payload && payload.email) {
        targetEmail = payload.email;
        userId = payload.userId;
        companyId = payload.companyId;
      }
    }

    if (!targetEmail && authHeader?.startsWith("Bearer ")) {
      const idToken = authHeader.substring(7);
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        if (decoded?.email) {
          targetEmail = decoded.email;
          userId = decoded.uid;
          companyId = (decoded as any).companyId || (decoded as any).businessId;
        }
      } catch (authErr) {
        console.warn("[Preferences API] Auth token failed:", authErr);
      }
    }

    // Account enumeration defense: If neither token nor authenticated user provided, return generic defaults
    if (!targetEmail) {
      return NextResponse.json({
        preferences: getDefaultEmailPreferences("user@example.com"),
        authenticated: false,
        maskedEmail: "Protected Contact",
      });
    }

    const prefs = await getFreshEmailPreferences(targetEmail, userId, companyId);

    // Mask email for display security (e.g. j***n@domain.com)
    const emailParts = targetEmail.split("@");
    const userPart = emailParts[0];
    const domainPart = emailParts[1] || "";
    const maskedUser =
      userPart.length <= 2
        ? userPart[0] + "***"
        : userPart[0] + "*".repeat(Math.max(1, userPart.length - 2)) + userPart[userPart.length - 1];
    const maskedEmail = `${maskedUser}@${domainPart}`;

    return NextResponse.json({
      preferences: prefs,
      authenticated: true,
      maskedEmail,
    });
  } catch (error: any) {
    console.error("[Preferences API GET Error]", error);
    return NextResponse.json(
      { error: "Failed to retrieve email preferences" },
      { status: 500 }
    );
  }
}

/**
 * Updates preferences for a customer (or unsubscribes from all optional communications).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, preferences, action } = body;
    const authHeader = req.headers.get("authorization");

    let targetEmail: string | null = null;
    let userId: string | undefined;
    let companyId: string | undefined;

    if (token) {
      const payload = verifyUnsubscribeToken(token);
      if (payload && payload.email) {
        targetEmail = payload.email;
        userId = payload.userId;
        companyId = payload.companyId;
      }
    }

    if (!targetEmail && authHeader?.startsWith("Bearer ")) {
      const idToken = authHeader.substring(7);
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        if (decoded?.email) {
          targetEmail = decoded.email;
          userId = decoded.uid;
          companyId = (decoded as any).companyId || (decoded as any).businessId;
        }
      } catch (authErr) {
        console.warn("[Preferences API] Auth token failed:", authErr);
      }
    }

    if (!targetEmail) {
      return NextResponse.json(
        { error: "Authentication or valid security token is required to modify email preferences." },
        { status: 401 }
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
    const userAgent = req.headers.get("user-agent") || "Unknown Browser";

    let updatedFields: Record<string, boolean> = {};

    if (action === "UNSUBSCRIBE_ALL") {
      updatedFields = {
        marketingEnabled: false,
        productUpdatesEnabled: false,
        newsletterEnabled: false,
        featureAnnouncementsEnabled: false,
        educationalContentEnabled: false,
        promotionalOffersEnabled: false,
      };
    } else {
      updatedFields = {
        marketingEnabled: preferences.marketingEnabled ?? true,
        productUpdatesEnabled: preferences.productUpdatesEnabled ?? true,
        newsletterEnabled: preferences.newsletterEnabled ?? true,
        featureAnnouncementsEnabled: preferences.featureAnnouncementsEnabled ?? true,
        educationalContentEnabled: preferences.educationalContentEnabled ?? true,
        promotionalOffersEnabled: preferences.promotionalOffersEnabled ?? false,
      };

      // If all sub-categories are false, marketingEnabled is also false
      if (
        !updatedFields.productUpdatesEnabled &&
        !updatedFields.newsletterEnabled &&
        !updatedFields.featureAnnouncementsEnabled &&
        !updatedFields.educationalContentEnabled &&
        !updatedFields.promotionalOffersEnabled
      ) {
        updatedFields.marketingEnabled = false;
      }
    }

    const result = await updateRecipientEmailPreferences({
      email: targetEmail,
      userId,
      companyId,
      preferences: updatedFields,
      source: "preference_center",
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message:
        action === "UNSUBSCRIBE_ALL"
          ? "You have been successfully unsubscribed from all optional communications. Essential transactional and account notices remain active."
          : "Your email communication preferences have been saved successfully.",
      preferences: result.preferences,
      auditLogId: result.auditLogId,
    });
  } catch (error: any) {
    console.error("[Preferences API POST Error]", error);
    return NextResponse.json(
      { error: "Failed to update email preferences" },
      { status: 500 }
    );
  }
}

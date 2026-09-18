import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email-tokens";
import { updateRecipientEmailPreferences } from "@/lib/email-service";

/**
 * RFC 8058 & RFC 2369 One-Click Unsubscribe Endpoint + Browser Link Handler
 *
 * Mail clients send:
 * POST /api/email/unsubscribe?token=...
 * Body: List-Unsubscribe=One-Click
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || (await req.json().catch(() => ({})))?.token;

    if (!token) {
      return NextResponse.json(
        { error: "Missing unsubscribe token" },
        { status: 400 }
      );
    }

    const payload = verifyUnsubscribeToken(token);
    if (!payload || !payload.email) {
      return NextResponse.json(
        { error: "Invalid, expired, or tampered unsubscribe token" },
        { status: 403 }
      );
    }

    // Check if this is an RFC 8058 one-click request
    const contentType = req.headers.get("content-type") || "";
    const isOneClick = contentType.includes("application/x-www-form-urlencoded");

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
    const userAgent = req.headers.get("user-agent") || "Unknown Mail Client";

    // Immediately unsubscribe from all optional marketing communications
    const result = await updateRecipientEmailPreferences({
      email: payload.email,
      userId: payload.userId,
      companyId: payload.companyId,
      preferences: {
        marketingEnabled: false,
        productUpdatesEnabled: false,
        newsletterEnabled: false,
        featureAnnouncementsEnabled: false,
        educationalContentEnabled: false,
        promotionalOffersEnabled: false,
      },
      source: isOneClick ? "one_click_header" : "unsubscribe_link",
      ipAddress: ip,
      userAgent: userAgent,
    });

    return NextResponse.json({
      success: true,
      message:
        "You have been successfully unsubscribed from MiraTech Business Suite marketing emails. You will continue to receive essential account, billing, security, and subscription-related messages.",
      unsubscribedAt: result.preferences.unsubscribedAt,
      source: result.preferences.unsubscribeSource,
    });
  } catch (error: any) {
    console.error("[Unsubscribe API Error]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while processing the unsubscribe request" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  // Redirect browser clicks directly to the customer-facing unsubscribe confirmation page
  if (token) {
    const redirectUrl = new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, req.url);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(new URL("/unsubscribe", req.url));
}

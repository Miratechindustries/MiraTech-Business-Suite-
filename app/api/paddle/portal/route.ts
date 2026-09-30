import { NextRequest, NextResponse } from "next/server";
import { getPaddleInstance } from "@/lib/paddle-server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json().catch(() => ({}));

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId parameter" }, { status: 400 });
    }

    const companyDoc = await adminDb.collection("companies").doc(companyId).get();
    if (!companyDoc.exists) {
      return NextResponse.json({ error: "Company record not found" }, { status: 404 });
    }

    const companyData = companyDoc.data() || {};
    const customerId = companyData.paddleCustomerId;
    const subscriptionId = companyData.paddleSubscriptionId;

    if (!process.env.PADDLE_API_KEY) {
      return NextResponse.json({
        error: "Paddle API Key is not configured in environment variables.",
        isConfigured: false,
      }, { status: 400 });
    }

    if (!customerId) {
      return NextResponse.json({
        error: "No Paddle customer record linked to this workspace. Complete an initial subscription checkout first."
      }, { status: 400 });
    }

    // Handle mock or sandbox customer IDs gracefully
    if (typeof customerId === "string" && (customerId.startsWith("ctm_sdbx_") || customerId.startsWith("mock_"))) {
      return NextResponse.json({
        url: "https://sandbox-vendors.paddle.com",
        notice: "Sandbox customer session active."
      });
    }

    const paddle = await getPaddleInstance();
    const session = await paddle.customerPortalSessions.create(
      customerId,
      subscriptionId ? [subscriptionId] : []
    );

    const overviewUrl = session?.urls?.general?.overview;
    return NextResponse.json({ url: overviewUrl });
  } catch (err: any) {
    console.error("Paddle portal error:", err);
    return NextResponse.json({ error: err.message || "Failed to create portal session" }, { status: 500 });
  }
}

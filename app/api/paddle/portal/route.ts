import { NextRequest, NextResponse } from "next/server";
import { getPaddleInstance } from "@/lib/paddle-server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json();

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId parameter" }, { status: 400 });
    }

    const companyDoc = await adminDb.collection("companies").doc(companyId).get();
    if (!companyDoc.exists) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyData = companyDoc.data() || {};
    const customerId = companyData.paddleCustomerId;
    const subscriptionId = companyData.paddleSubscriptionId;

    if (!customerId) {
      return NextResponse.json({
        error: "No Paddle customer record found for this company. You need to complete an initial subscription checkout first."
      }, { status: 400 });
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

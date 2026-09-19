import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, verifyAdminUser } from "@/lib/firebase-admin";

/**
 * Admin view of customer email preferences and audit history.
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
      return NextResponse.json({ error: "Invalid authentication credentials" }, { status: 401 });
    }

    const isMasterAdmin = await verifyAdminUser(req);
    const companyId = (decoded as any).companyId || (decoded as any).businessId;

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "all";
    const search = url.searchParams.get("search")?.toLowerCase().trim() || "";

    // Query email_preferences
    let prefsCol = adminDb.collection("email_preferences");
    let prefsQuery: any = prefsCol;

    if (!isMasterAdmin && companyId) {
      prefsQuery = prefsQuery.where("companyId", "==", companyId);
    }

    const prefsSnap = await prefsQuery.limit(100).get();
    let preferences: any[] = [];
    prefsSnap.forEach((doc: any) => {
      const data = doc.data();
      preferences.push({
        id: doc.id,
        ...data,
      });
    });

    if (search) {
      preferences = preferences.filter(
        (p) =>
          p.email?.toLowerCase().includes(search) ||
          p.userId?.toLowerCase().includes(search) ||
          p.unsubscribeSource?.toLowerCase().includes(search)
      );
    }

    if (filter === "unsubscribed") {
      preferences = preferences.filter((p) => p.marketingEnabled === false);
    } else if (filter === "active") {
      preferences = preferences.filter((p) => p.marketingEnabled === true);
    }

    // Query recent audit logs
    let auditCol = adminDb.collection("email_audit_logs");
    let auditQuery: any = auditCol.orderBy("timestamp", "desc").limit(50);

    const auditSnap = await auditQuery.get();
    const auditLogs: any[] = [];
    auditSnap.forEach((doc: any) => {
      auditLogs.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return NextResponse.json({
      success: true,
      preferences,
      auditLogs,
      isMasterAdmin,
    });
  } catch (error: any) {
    console.error("[Admin Email Preferences API Error]", error);
    return NextResponse.json(
      { error: "Failed to retrieve email preferences and audit logs" },
      { status: 500 }
    );
  }
}

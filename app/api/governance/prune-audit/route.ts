import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing or invalid token" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err) {
      return NextResponse.json({ error: "Unauthorized: Invalid authentication token" }, { status: 401 });
    }

    const { companyId, retentionDays } = await req.json();
    if (!companyId || !retentionDays) {
      return NextResponse.json({ error: "Missing companyId or retentionDays" }, { status: 400 });
    }

    const isMasterAdmin = decodedToken.email === "miratechindustries@gmail.com" || decodedToken.role === "MASTER_ADMIN";
    const userCompanyId = decodedToken.companyId || decodedToken.businessId;

    if (!isMasterAdmin && userCompanyId !== companyId && decodedToken.uid !== companyId) {
      return NextResponse.json({ error: "Forbidden: Unauthorized tenant scope" }, { status: 403 });
    }

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - Number(retentionDays));

    const logsRef = adminDb.collection("audit_logs");
    const snapshot = await logsRef
      .where("companyId", "==", companyId)
      .get();

    let prunedCount = 0;
    const batch = adminDb.batch();

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const timestampStr = data.timestamp || data.createdAt;
      if (timestampStr) {
        const logDate = new Date(timestampStr);
        if (logDate < thresholdDate && data.category !== "compliance") {
          batch.delete(logsRef.doc(docSnap.id));
          prunedCount++;
        }
      }
    });

    if (prunedCount > 0) {
      await batch.commit();
    }

    // Write audit record of pruning
    await logsRef.add({
      companyId,
      userId: decodedToken.uid,
      userEmail: decodedToken.email || "admin@system",
      action: "AUDIT_LOG_RETENTION_PRUNING_EXECUTED",
      details: `Server-side audit log pruning executed for retention window of ${retentionDays} days. Purged ${prunedCount} historical log entries.`,
      category: "compliance",
      severity: "MEDIUM",
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Successfully executed audit log retention policy (${retentionDays} days). Purged ${prunedCount} records server-side.`
    });
  } catch (err: any) {
    console.error("Prune audit API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

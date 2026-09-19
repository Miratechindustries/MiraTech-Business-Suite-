import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth, verifyAdminUser } from "../../../../lib/firebase-admin";
import { logServerAction } from "../../../../lib/server-audit";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication bearer token." }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1]?.trim();
    let decodedToken: any;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err: any) {
      return NextResponse.json({ error: `Unauthorized: ${err.message}` }, { status: 401 });
    }

    const isMasterAdmin = await verifyAdminUser(req);

    if (!isMasterAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrator privileges required." }, { status: 403 });
    }

    const verifiedEmail = decodedToken.email || "miratechindustries@gmail.com";

    const { 
      includeCollections = ["companies", "users", "audit_logs", "invoices", "customers", "employees", "expenses", "error_logs", "system_config"],
      backupType = "manual",
      driveFileId = null,
      driveUrl = null,
      status = "success",
      errorMessage = null
    } = await req.json().catch(() => ({}));

    // If client is just logging a backup attempt result
    if (req.headers.get("x-action") === "log-history") {
      await adminDb.collection("backup_history").add({
        backupType,
        status,
        driveFileId,
        driveUrl,
        errorMessage,
        timestamp: new Date(),
        initiatedBy: verifiedEmail
      });
      return NextResponse.json({ success: true });
    }

    const backupData: Record<string, any[]> = {};

    for (const colName of includeCollections) {
      try {
        const snapshot = await adminDb.collection(colName).get();
        backupData[colName] = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (colErr: any) {
        console.warn(`Could not read collection ${colName} during backup:`, colErr?.message);
        backupData[colName] = [];
      }
    }

    const fullBackup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      generator: "MiraTech Business Suite Data Engine",
      totalRecords: Object.values(backupData).reduce((acc, curr) => acc + curr.length, 0),
      data: backupData
    };

    await adminDb.collection("backup_history").add({
      backupType,
      status: "success",
      driveFileId,
      driveUrl,
      timestamp: new Date(),
      initiatedBy: verifiedEmail,
      recordCount: fullBackup.totalRecords
    }).catch((histErr: any) => console.warn("Failed to write to backup_history:", histErr));

    await logServerAction({
      action: "DATA_BACKUP_EXPORT",
      detail: `Exported system backup (${backupType}) with ${fullBackup.totalRecords} records across collections: ${includeCollections.join(", ")}`,
      businessId: "system",
      userId: decodedToken.uid || "master_admin",
      userEmail: verifiedEmail,
      department: "governance",
      severity: "INFO"
    });

    return NextResponse.json({
      success: true,
      timestamp: fullBackup.timestamp,
      backup: fullBackup
    });
  } catch (error: any) {
    console.error("Backup export error:", error);
    await adminDb.collection("backup_history").add({
      backupType: "manual",
      status: "failure",
      errorMessage: error?.message || "Unknown error",
      timestamp: new Date()
    }).catch(() => {});
    return NextResponse.json({ error: error?.message || "Internal server error during backup generation" }, { status: 500 });
  }
}

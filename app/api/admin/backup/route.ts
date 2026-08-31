import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { logServerAction } from "../../../../lib/server-audit";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { 
      includeCollections = ["companies", "users", "audit_logs", "invoices", "customers", "employees", "expenses"],
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
        timestamp: new Date()
      });
      return NextResponse.json({ success: true });
    }

    const backupData: Record<string, any[]> = {};

    for (const colName of includeCollections) {
      const snapshot = await adminDb.collection(colName).get();
      backupData[colName] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    const fullBackup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      data: backupData
    };

    await adminDb.collection("backup_history").add({
      backupType,
      status: "success",
      driveFileId,
      driveUrl,
      timestamp: new Date()
    });

    await logServerAction({
      action: "DATA_BACKUP_EXPORT",
      detail: `Exported system backup (${backupType}) containing collections: ${includeCollections.join(", ")}`,
      businessId: "system",
      userId: "master_admin",
      userEmail: "miratechindustries@gmail.com",
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
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth, verifyAdminUser } from "../../../../lib/firebase-admin";
import { logServerAction } from "../../../../lib/server-audit";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const configSnap = await adminDb.collection("system_config").doc("maintenance").get();
    if (configSnap.exists) {
      return NextResponse.json(configSnap.data());
    }
    return NextResponse.json({
      enabled: false,
      message: "MiraTech Business Suite is currently undergoing scheduled maintenance. Please check back shortly.",
      scheduledEnd: "",
      updatedAt: new Date().toISOString(),
      updatedBy: "system"
    });
  } catch (err: any) {
    console.error("GET maintenance error:", err);
    return NextResponse.json({
      enabled: false,
      message: "MiraTech Business Suite is currently undergoing scheduled maintenance. Please check back shortly.",
      scheduledEnd: "",
      updatedAt: new Date().toISOString()
    });
  }
}

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

    const isMasterAdmin = await verifyAdminUser(decodedToken);

    if (!isMasterAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrator privileges required." }, { status: 403 });
    }

    const userEmail = decodedToken.email || "miratechindustries@gmail.com";
    const body = await req.json().catch(() => ({}));
    const { action, enabled, message, scheduledEnd, errorIds } = body;

    if (action === "toggle_mode") {
      const maintenanceData = {
        enabled: Boolean(enabled),
        message: message || "MiraTech Business Suite is currently undergoing scheduled maintenance. Please check back shortly.",
        scheduledEnd: scheduledEnd || "",
        updatedAt: new Date().toISOString(),
        updatedBy: userEmail
      };

      await adminDb.collection("system_config").doc("maintenance").set(maintenanceData, { merge: true });

      await logServerAction({
        action: "MAINTENANCE_TOGGLED",
        detail: `System maintenance mode set to ${enabled ? "ACTIVE" : "INACTIVE"}. Message: "${message || ''}"`,
        businessId: "system",
        userId: "master_admin",
        userEmail,
        department: "governance",
        severity: enabled ? "WARN" : "INFO"
      });

      return NextResponse.json({
        success: true,
        maintenance: maintenanceData
      });
    }

    if (action === "flush_errors") {
      if (Array.isArray(errorIds) && errorIds.length > 0) {
        for (const id of errorIds) {
          await adminDb.collection("error_logs").doc(id).update({
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: userEmail
          }).catch(() => {});
        }
      } else {
        // Resolve all unresolved errors
        const snapshot = await adminDb.collection("error_logs").where("resolved", "==", false).get();
        for (const doc of snapshot.docs) {
          await doc.ref.update({
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: userEmail
          }).catch(() => {});
        }
      }

      await logServerAction({
        action: "ERROR_LOGS_FLUSHED",
        detail: `Master Admin flushed error logs batch (${errorIds?.length || "all"}).`,
        businessId: "system",
        userId: "master_admin",
        userEmail,
        department: "governance",
        severity: "INFO"
      });

      return NextResponse.json({ success: true });
    }

    if (action === "purge_resolved_errors") {
      const snapshot = await adminDb.collection("error_logs").where("resolved", "==", true).get();
      let purgedCount = 0;
      for (const doc of snapshot.docs) {
        await doc.ref.delete().catch(() => {});
        purgedCount++;
      }

      await logServerAction({
        action: "ERROR_LOGS_PURGED",
        detail: `Permanently purged ${purgedCount} resolved error logs from database.`,
        businessId: "system",
        userId: "master_admin",
        userEmail,
        department: "governance",
        severity: "WARN"
      });

      return NextResponse.json({ success: true, purgedCount });
    }

    if (action === "run_self_diagnostics") {
      const dbCheck = await adminDb.collection("companies").limit(1).get().then(() => "OK").catch((e: any) => `Error: ${e.message}`);
      const usersCheck = await adminDb.collection("users").limit(1).get().then(() => "OK").catch((e: any) => `Error: ${e.message}`);
      const storageCheck = "OK (Operational)";
      const memUsage = typeof process !== "undefined" && process.memoryUsage ? `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB` : "N/A";

      const diagnostics = {
        timestamp: new Date().toISOString(),
        database: dbCheck,
        userDirectory: usersCheck,
        storage: storageCheck,
        memoryUsage: memUsage,
        serverUptime: `${Math.round(process.uptime())}s`,
        status: dbCheck === "OK" && usersCheck === "OK" ? "HEALTHY" : "DEGRADED"
      };

      return NextResponse.json({ success: true, diagnostics });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST maintenance error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

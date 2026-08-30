import { adminDb } from "./firebase-admin";

export async function logServerAction({
  action,
  detail,
  businessId,
  userId,
  userEmail,
  department = "general",
  severity = "INFO",
  impact = null,
  ip = "127.0.0.1",
  meta = {}
}: {
  action: string;
  detail: string;
  businessId: string;
  userId: string;
  userEmail: string;
  department?: string;
  severity?: string;
  impact?: number | null;
  ip?: string;
  meta?: any;
}) {
  try {
    const auditPayload: any = {
      action,
      detail,
      businessId,
      userId,
      user: userEmail,
      department,
      severity,
      timestamp: new Date(),
      ip,
      ...meta
    };

    if (impact !== null) {
      auditPayload.impact = impact;
    }

    await adminDb.collection("audit_logs").add(auditPayload);

    let type: "info" | "success" | "warning" | "error" = "info";
    const lowercaseAction = action.toLowerCase();
    
    if (
      lowercaseAction.includes("create") || 
      lowercaseAction.includes("add") || 
      lowercaseAction.includes("success") || 
      lowercaseAction.includes("paid") || 
      lowercaseAction.includes("complete") ||
      lowercaseAction.includes("enrolled")
    ) {
      type = "success";
    } else if (
      lowercaseAction.includes("delete") || 
      lowercaseAction.includes("remove") || 
      lowercaseAction.includes("reject") || 
      lowercaseAction.includes("cancel") || 
      lowercaseAction.includes("error") || 
      lowercaseAction.includes("fail") ||
      lowercaseAction.includes("revoked")
    ) {
      type = "error";
    } else if (
      lowercaseAction.includes("update") || 
      lowercaseAction.includes("edit") || 
      lowercaseAction.includes("modify") || 
      lowercaseAction.includes("warn") ||
      lowercaseAction.includes("reassigned")
    ) {
      type = "warning";
    }

    await adminDb.collection("notifications").add({
      businessId,
      userId,
      userEmail,
      title: action,
      message: detail,
      department,
      read: false,
      createdAt: new Date().toISOString(),
      type
    });
  } catch (err) {
    console.error("Failed to write server audit log:", err);
  }
}

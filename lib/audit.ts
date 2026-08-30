import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "./firebase";

let cachedIp: string | null = null;

// Eagerly resolve client IP address in browser environment
if (typeof window !== "undefined") {
  fetch("/api/get-ip")
    .then((res) => res.json())
    .then((data) => {
      if (data.ip) cachedIp = data.ip;
    })
    .catch(() => {
      // Fallback block to public API if needed
      fetch("https://api.ipify.org?format=json")
        .then((res) => res.json())
        .then((data) => {
          if (data.ip) cachedIp = data.ip;
        })
        .catch(() => {});
    });
}

export async function logAction(
  actionOrCompanyId: string,
  detailOrUserId: string,
  businessIdOrUserEmail: string,
  impactOrAction?: number | string,
  metaOrDetail?: any,
  dept?: string,
  severity?: string
) {
  const currentUser = auth.currentUser;

  // On-demand fetch if still null
  if (!cachedIp && typeof window !== "undefined") {
    try {
      const res = await fetch("/api/get-ip");
      const data = await res.json();
      if (data.ip) cachedIp = data.ip;
    } catch {
      // Silent catch
    }
  }

  let finalAction = "";
  let finalDetail = "";
  let finalBusinessId = "";
  let finalImpact: number | null = null;
  let finalDepartment = dept || "general";
  let finalSeverity = severity || "INFO";
  let actorEmail = currentUser?.email || "Unknown";
  let actorId = currentUser?.uid || "Unknown";

  // Check if called with legacy/overloaded (companyId, userId, userEmail, action, detail, department, severity)
  if (typeof impactOrAction === "string" && typeof metaOrDetail === "string") {
    finalBusinessId = actionOrCompanyId;
    actorId = detailOrUserId || actorId;
    actorEmail = businessIdOrUserEmail || actorEmail;
    finalAction = impactOrAction;
    finalDetail = metaOrDetail;
  } else {
    // Called with (action, detail, businessId, impact?, metadata?)
    finalAction = actionOrCompanyId;
    finalDetail = detailOrUserId;
    finalBusinessId = businessIdOrUserEmail;
    if (typeof impactOrAction === "number" && !isNaN(impactOrAction)) {
      finalImpact = impactOrAction;
    }
    if (metaOrDetail && typeof metaOrDetail === "object") {
      if (metaOrDetail.department) finalDepartment = metaOrDetail.department;
      if (metaOrDetail.severity) finalSeverity = metaOrDetail.severity;
      if (metaOrDetail.role) finalSeverity = `${finalSeverity} [${metaOrDetail.role}]`;
    }
  }

  const payload: any = {
    action: finalAction,
    detail: finalDetail,
    businessId: finalBusinessId,
    department: finalDepartment,
    severity: finalSeverity,
    timestamp: serverTimestamp(),
    user: actorEmail,
    userId: actorId,
    ip: cachedIp || "127.0.0.1"
  };

  if (finalImpact !== null) {
    payload.impact = finalImpact;
  }

  try {
    await addDoc(collection(db, "audit_logs"), payload);
  } catch (err) {
    console.error("Failed to write to audit_logs:", err);
  }

  // Auto-generate a multi-tenant notification from the audit log
  try {
    let type: "info" | "success" | "warning" | "error" = "info";
    const lowercaseAction = finalAction.toLowerCase();
    
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

    await addDoc(collection(db, "notifications"), {
      businessId: finalBusinessId,
      userId: actorId,
      userEmail: actorEmail,
      title: finalAction,
      message: finalDetail,
      department: finalDepartment,
      read: false,
      createdAt: new Date().toISOString(),
      type
    });
  } catch (err) {
    console.error("Failed to write to notifications collection from audit log:", err);
  }
}

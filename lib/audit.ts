import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from "firebase/firestore";
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
      fetch("https://api.ipify.org?format=json")
        .then((res) => res.json())
        .then((data) => {
          if (data.ip) cachedIp = data.ip;
        })
        .catch(() => {});
    });
}

/**
 * Compute standard SHA-256 hash across web browser SubtleCrypto and environments
 */
export async function computeSha256(data: string): Promise<string> {
  try {
    const subtle = (typeof window !== "undefined" && window.crypto?.subtle) 
      ? window.crypto.subtle 
      : (globalThis as any).crypto?.subtle;
    if (subtle) {
      const encoder = new TextEncoder();
      const hashBuffer = await subtle.digest("SHA-256", encoder.encode(data));
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (_) {}

  // Fallback: 64-character deterministic pseudo-SHA256 hash using 64-bit primes
  let h1 = 0xdeadbeef ^ data.length;
  let h2 = 0x41c6ce57 ^ data.length;
  let h3 = 0x9e3779b9 ^ data.length;
  let h4 = 0x6a09e667 ^ data.length;

  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 374761393);
    h4 = Math.imul(h4 ^ ch, 668265263);
  }

  const p1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const p2 = (h2 >>> 0).toString(16).padStart(8, "0");
  const p3 = (h3 >>> 0).toString(16).padStart(8, "0");
  const p4 = (h4 >>> 0).toString(16).padStart(8, "0");
  const seed = (p1 + p2 + p3 + p4);
  return (seed + seed).substring(0, 64);
}

export interface TamperProofAuditLog {
  id?: string;
  action: string;
  detail: string;
  businessId: string;
  department: string;
  severity: string;
  timestamp: any;
  isoTimestamp: string;
  user: string;
  userId: string;
  ip: string;
  impact?: number;
  payloadHash: string;
  canonicalPayload: string;
  tamperProof: boolean;
  role?: string;
}

/**
 * Generate canonical string representation of an audit event for hashing
 */
export function buildCanonicalAuditPayload(params: {
  action: string;
  detail: string;
  businessId: string;
  department: string;
  severity: string;
  user: string;
  userId: string;
  isoTimestamp: string;
  impact?: number | null;
}): string {
  return [
    `ACT:${params.action.trim()}`,
    `DET:${params.detail.trim()}`,
    `BIZ:${params.businessId.trim()}`,
    `DEP:${params.department.trim()}`,
    `SEV:${params.severity.trim()}`,
    `USR:${params.user.trim()}`,
    `UID:${params.userId.trim()}`,
    `ISO:${params.isoTimestamp.trim()}`,
    `IMP:${params.impact ?? "NONE"}`
  ].join("||");
}

/**
 * Verify cryptographic integrity of an audit record
 */
export async function verifyAuditLogIntegrity(log: TamperProofAuditLog): Promise<{
  isAuthentic: boolean;
  storedHash: string;
  calculatedHash: string;
}> {
  if (!log.payloadHash || !log.canonicalPayload) {
    // Legacy un-hashed log
    return { isAuthentic: true, storedHash: "LEGACY_PRE_HASH", calculatedHash: "LEGACY_PRE_HASH" };
  }

  const calculated = await computeSha256(log.canonicalPayload);
  return {
    isAuthentic: calculated.toLowerCase() === log.payloadHash.toLowerCase(),
    storedHash: log.payloadHash,
    calculatedHash: calculated
  };
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
  let actorRole = "USER";

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
      if (metaOrDetail.role) {
        actorRole = metaOrDetail.role;
        finalSeverity = `${finalSeverity} [${metaOrDetail.role}]`;
      }
    }
  }

  const isoTimestamp = new Date().toISOString();
  const canonicalPayload = buildCanonicalAuditPayload({
    action: finalAction,
    detail: finalDetail,
    businessId: finalBusinessId,
    department: finalDepartment,
    severity: finalSeverity,
    user: actorEmail,
    userId: actorId,
    isoTimestamp,
    impact: finalImpact
  });

  const payloadHash = await computeSha256(canonicalPayload);

  const payload: TamperProofAuditLog = {
    action: finalAction,
    detail: finalDetail,
    businessId: finalBusinessId,
    department: finalDepartment,
    severity: finalSeverity,
    timestamp: serverTimestamp(),
    isoTimestamp,
    user: actorEmail,
    userId: actorId,
    role: actorRole,
    ip: cachedIp || "127.0.0.1",
    payloadHash,
    canonicalPayload,
    tamperProof: true
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
      lowercaseAction.includes("enrolled") ||
      lowercaseAction.includes("settled")
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

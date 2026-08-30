import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { logAction } from "./audit";

let cachedIp: string | null = null;

// Resolve client IP address
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
 * Logs a cross-departmental operation to the secure tenant-isolated subcollection,
 * and propagates it to the main audit ledger.
 */
export async function logDepartmentActivity(
  department: string,
  action: string,
  detail: string,
  businessId: string
) {
  const user = auth.currentUser;

  // On-demand fetch IP
  if (!cachedIp && typeof window !== "undefined") {
    try {
      const res = await fetch("/api/get-ip");
      const data = await res.json();
      if (data.ip) cachedIp = data.ip;
    } catch {
      // Silent catch
    }
  }

  const payload = {
    department: department.toUpperCase(),
    action,
    detail,
    timestamp: serverTimestamp(),
    user: user?.email || "Unknown User",
    userId: user?.uid || "Unknown ID",
    ip: cachedIp || "127.0.0.1",
  };

  try {
    // 1. Write to the tenant-isolated subcollection
    const logRef = await addDoc(
      collection(db, "companies", businessId, "department_activity_logs"),
      payload
    );

    // 2. propagate to the global non-repudiation audit_logs (and automatic notification dispatch)
    await logAction(
      `[${department.toUpperCase()}] ${action}`,
      detail,
      businessId
    );

    return logRef.id;
  } catch (err) {
    console.error("Failed to log department activity:", err);
    throw err;
  }
}

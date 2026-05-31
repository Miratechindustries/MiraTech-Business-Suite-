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

export async function logAction(action: string, detail: string, businessId: string, impact?: number) {
  const user = auth.currentUser;

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
  
  const payload: any = {
    action,
    detail,
    businessId,
    timestamp: serverTimestamp(),
    user: user?.email || "Unknown",
    userId: user?.uid || "Unknown",
    ip: cachedIp || "127.0.0.1"
  };

  // Only append impact if it is a valid defined number to prevent Firestore serialization errors
  if (impact !== undefined && !isNaN(impact)) {
    payload.impact = impact;
  } else {
    payload.impact = null;
  }

  await addDoc(collection(db, "audit_logs"), payload);
}

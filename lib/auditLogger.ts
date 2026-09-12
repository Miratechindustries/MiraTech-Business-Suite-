import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export interface AuditActionParams {
  companyId: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  details?: string;
}

export async function logAuditAction(params: AuditActionParams) {
  try {
    const auditRef = collection(db, "companies", params.companyId, "audit_logs");
    await addDoc(auditRef, {
      ...params,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to log audit action", error);
  }
}

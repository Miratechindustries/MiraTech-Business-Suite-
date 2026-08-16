import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface ApprovalNotificationParams {
  businessId: string;
  documentType: "quotation" | "invoice" | "expense";
  documentNumber: string;
  creatorName: string;
  department: string;
  totalAmount: number;
  companyName?: string;
}

/**
 * Sends in-app and email alert notifications to all authorized managers when a new document requires approval.
 */
export async function notifyManagersForApproval(params: ApprovalNotificationParams) {
  try {
    const { businessId, documentType, documentNumber, creatorName, department, totalAmount, companyName } = params;
    if (!businessId) return;

    // 1. Query users in the company who are managers or have approval rights
    const managerEmails: string[] = [];
    const managerUids: string[] = [];

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("companyId", "==", businessId));
      const userSnap = await getDocs(q);

      userSnap.forEach((docSnap) => {
        const u = docSnap.data();
        const role = (u.role || "").toUpperCase();
        const position = (u.position || "").toLowerCase();
        const userDepts = u.departments || [];

        const isManagerRole = [
          "BUSINESS_ADMIN",
          "MASTER_ADMIN",
          "GENERAL_MANAGER",
          "MANAGING_DIRECTOR",
          "COMPANY_OWNER",
          "FINANCE_MANAGER",
          "OPERATIONS_MANAGER",
          "HR"
        ].includes(role);

        const isManagerPosition = position.includes("manager") || position.includes("director") || position.includes("lead");
        const hasApprovalRight = u.approvalRights || u.canApproveQuotations || u.canApproveInvoices;
        const matchesDepartment = userDepts.length === 0 || userDepts.includes(department.toLowerCase());

        if ((isManagerRole || (isManagerPosition && matchesDepartment) || hasApprovalRight) && u.email) {
          managerEmails.push(u.email);
          managerUids.push(docSnap.id);
        }
      });
    } catch (err) {
      console.warn("Could not query manager profiles for notifications:", err);
    }

    // Always include fallback workspace email if list is empty
    if (managerEmails.length === 0) {
      managerEmails.push("miratechindustries@gmail.com");
    }

    // 2. Add In-App Notification document for each manager or team
    const notifMessage = `Approval Required: ${documentType.toUpperCase()} ${documentNumber} (E${totalAmount.toLocaleString()}) submitted by ${creatorName} in ${department.toUpperCase()}.`;

    try {
      const notifRef = collection(db, "companies", businessId, "notifications");
      await addDoc(notifRef, {
        title: `Pending ${documentType.toUpperCase()} Approval`,
        message: notifMessage,
        type: "approval_required",
        department: department,
        documentType: documentType,
        documentNumber: documentNumber,
        recipients: managerEmails,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Error creating in-app notification:", err);
    }

    // 3. Trigger Email Alert endpoint
    try {
      await fetch("/api/notify-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerEmails,
          documentType,
          documentNumber,
          creatorName,
          department,
          totalAmount,
          companyName: companyName || "MIRA SUITE"
        })
      });
    } catch (err) {
      console.warn("Error triggering notify-approval API:", err);
    }

    return {
      success: true,
      notifiedManagers: managerEmails
    };
  } catch (error) {
    console.error("Failed to notify managers for approval:", error);
    return { success: false, error };
  }
}

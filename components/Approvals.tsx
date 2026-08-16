"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useUserStore, useToastStore } from "../lib/store";
import { logDepartmentActivity } from "../lib/department";
import { logAction } from "../lib/audit";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  Receipt, 
  Coins, 
  ShieldCheck, 
  Filter, 
  Search, 
  MessageSquare, 
  AlertCircle, 
  ArrowRight, 
  Check, 
  X, 
  RotateCcw,
  RefreshCw,
  Eye,
  FileCheck,
  Building2,
  Calendar,
  User,
  History,
  ChevronRight,
  Download,
  Copy,
  ExternalLink,
  Layers,
  SlidersHorizontal,
  Briefcase
} from "lucide-react";

export interface PendingItem {
  id: string;
  type: "quotation" | "invoice" | "expense" | "purchase_order";
  number: string;
  clientName?: string;
  clientEmail?: string;
  creatorName?: string;
  department: string;
  total: number;
  date: string;
  approvalStatus: string; // 'pending_admin' | 'pending_hr' | 'pending_final' | 'approved' | 'rejected' | 'draft'
  approvalHistory?: any[];
  comments?: string;
  items?: any[];
  companyScope: string;
  rawDoc: any;
}

export interface AuditTrailRecord {
  id: string;
  documentId: string;
  documentNumber: string;
  documentType: "quotation" | "invoice" | "expense" | "purchase_order";
  department: string;
  clientName?: string;
  total: number;
  action: string; // 'approved' | 'rejected' | 'draft' | 'submitted' | 'draft_saved' | 'returned'
  actionLabel: string;
  performedBy: string;
  userRole?: string;
  userPosition?: string;
  timestamp: string;
  dateFormatted: string;
  timeFormatted: string;
  relativeTime: string;
  comments?: string;
  companyScope: string;
  itemRef: PendingItem;
}

function parseAuditTimestamp(rawTimestamp?: any, fallbackDate?: string, fallbackTime?: string) {
  let dateObj: Date | null = null;

  if (rawTimestamp) {
    if (typeof rawTimestamp === "string") {
      const d = new Date(rawTimestamp);
      if (!isNaN(d.getTime())) dateObj = d;
    } else if (rawTimestamp.toDate && typeof rawTimestamp.toDate === "function") {
      dateObj = rawTimestamp.toDate();
    } else if (rawTimestamp.seconds) {
      dateObj = new Date(rawTimestamp.seconds * 1000);
    }
  }

  if (!dateObj && fallbackDate) {
    const combined = fallbackTime ? `${fallbackDate}T${fallbackTime}` : fallbackDate;
    const d = new Date(combined);
    if (!isNaN(d.getTime())) dateObj = d;
    else {
      const d2 = new Date(fallbackDate);
      if (!isNaN(d2.getTime())) dateObj = d2;
    }
  }

  if (!dateObj) {
    dateObj = new Date();
  }

  const dateFormatted = dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  const timeFormatted = dateObj.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  // Calculate relative time
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  let relativeTime = "Just now";
  if (diffDays > 0) {
    relativeTime = diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  } else if (diffHrs > 0) {
    relativeTime = diffHrs === 1 ? "1 hour ago" : `${diffHrs} hours ago`;
  } else if (diffMin > 0) {
    relativeTime = diffMin === 1 ? "1 min ago" : `${diffMin} mins ago`;
  } else if (diffSec > 10) {
    relativeTime = `${diffSec} secs ago`;
  }

  return {
    dateFormatted,
    timeFormatted,
    relativeTime,
    iso: dateObj.toISOString(),
    ms: dateObj.getTime()
  };
}

export default function Approvals({ departmentId }: { departmentId?: string }) {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingItem[]>([]);
  
  // Primary View Mode: 'queue' or 'audit_trail'
  const [viewMode, setViewMode] = useState<"queue" | "audit_trail">("queue");
  
  // Queue Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>(departmentId || "all");
  const [statusTab, setStatusTab] = useState<string>("pending"); // 'pending' | 'draft' | 'approved' | 'rejected' | 'all'
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Audit Trail Specific Filters
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditTypeFilter, setAuditTypeFilter] = useState("all");
  const [auditDeptFilter, setAuditDeptFilter] = useState(departmentId || "all");
  const [auditSortOrder, setAuditSortOrder] = useState<"desc" | "asc">("desc");

  // Document Detail / Modal State
  const [selectedAuditItem, setSelectedAuditItem] = useState<PendingItem | null>(null);

  const rawUser = auth.currentUser;
  const businessId = currentUser?.companyId || currentUser?.businessId || (rawUser?.uid || "");

  const fetchPendingApprovals = useCallback(async () => {
    const activeBusinessId = currentUser?.companyId || currentUser?.businessId || auth.currentUser?.uid;
    if (!activeBusinessId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const fetchedItemsMap = new Map<string, PendingItem>();

      // Collect all potential company IDs to ensure no existing documents are missed
      const possibleCompanyIds = new Set<string>();
      if (activeBusinessId) possibleCompanyIds.add(activeBusinessId);
      if (currentUser?.companyId) possibleCompanyIds.add(currentUser.companyId);
      if (currentUser?.businessId) possibleCompanyIds.add(currentUser.businessId);
      if (auth.currentUser?.uid) possibleCompanyIds.add(auth.currentUser.uid);

      for (const compId of possibleCompanyIds) {
        // 1. Fetch Quotations
        try {
          const quotRef = collection(db, "companies", compId, "quotations");
          const quotSnap = await getDocs(quotRef);
          quotSnap.forEach((docSnap) => {
            const data = docSnap.data();
            const key = `quotation-${docSnap.id}`;
            if (fetchedItemsMap.has(key)) return;

            let normalizedApprovalStatus = "pending_admin";
            if (data.approvalStatus) {
              normalizedApprovalStatus = String(data.approvalStatus).toLowerCase();
            } else if (data.status === "accepted" || data.status === "approved") {
              normalizedApprovalStatus = "approved";
            } else if (data.status === "declined" || data.status === "rejected") {
              normalizedApprovalStatus = "rejected";
            } else if (data.status === "draft") {
              normalizedApprovalStatus = "draft";
            } else {
              normalizedApprovalStatus = "pending_admin";
            }

            fetchedItemsMap.set(key, {
              id: docSnap.id,
              type: "quotation",
              number: data.number || `QT-${docSnap.id.substring(0, 5)}`,
              clientName: data.clientName || data.client || "Direct Client",
              clientEmail: data.clientEmail || "",
              creatorName: data.createdByName || data.creatorEmail || "Sales Staff",
              department: data.department || "sales",
              total: Number(data.total) || 0,
              date: data.date || new Date().toISOString().split("T")[0],
              approvalStatus: normalizedApprovalStatus,
              approvalHistory: data.approvalHistory || [],
              comments: data.approvalComments || "",
              items: data.items || [],
              companyScope: compId,
              rawDoc: data
            });
          });
        } catch (e) {
          console.warn(`Quotations fetch warning for scope ${compId}:`, e);
        }

        // 2. Fetch Invoices
        try {
          const invRef = collection(db, "companies", compId, "invoices");
          const invSnap = await getDocs(invRef);
          invSnap.forEach((docSnap) => {
            const data = docSnap.data();
            const key = `invoice-${docSnap.id}`;
            if (fetchedItemsMap.has(key)) return;

            let normalizedApprovalStatus = "pending_admin";
            if (data.approvalStatus) {
              normalizedApprovalStatus = String(data.approvalStatus).toLowerCase();
            } else if (data.status === "paid" || data.status === "approved") {
              normalizedApprovalStatus = "approved";
            } else if (data.status === "rejected") {
              normalizedApprovalStatus = "rejected";
            } else if (data.status === "draft") {
              normalizedApprovalStatus = "draft";
            } else {
              normalizedApprovalStatus = "pending_admin";
            }

            fetchedItemsMap.set(key, {
              id: docSnap.id,
              type: "invoice",
              number: data.number || `INV-${docSnap.id.substring(0, 5)}`,
              clientName: data.clientName || data.client || "Direct Client",
              clientEmail: data.clientEmail || "",
              creatorName: data.createdByName || data.creatorEmail || "Billing Staff",
              department: data.department || "finance",
              total: Number(data.total) || 0,
              date: data.date || new Date().toISOString().split("T")[0],
              approvalStatus: normalizedApprovalStatus,
              approvalHistory: data.approvalHistory || [],
              comments: data.approvalComments || "",
              items: data.items || [],
              companyScope: compId,
              rawDoc: data
            });
          });
        } catch (e) {
          console.warn(`Invoices fetch warning for scope ${compId}:`, e);
        }
      }

      // 3. Fetch Expenses
      try {
        const expRef = collection(db, "expenses");
        const expSnap = await getDocs(query(expRef, where("businessId", "in", Array.from(possibleCompanyIds).slice(0, 10))));
        expSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const key = `expense-${docSnap.id}`;
          if (fetchedItemsMap.has(key)) return;

          let normalizedApprovalStatus = "pending_admin";
          const rawStatus = (data.status || "").toLowerCase();
          if (rawStatus === "approved") {
            normalizedApprovalStatus = "approved";
          } else if (rawStatus === "rejected") {
            normalizedApprovalStatus = "rejected";
          } else {
            normalizedApprovalStatus = "pending_admin";
          }

          fetchedItemsMap.set(key, {
            id: docSnap.id,
            type: "expense",
            number: `EXP-${docSnap.id.substring(0, 5)}`,
            clientName: data.description || "Corporate Expense Claim",
            creatorName: data.createdByName || "Staff Member",
            department: data.department || "finance",
            total: Number(data.amount) || 0,
            date: data.date || new Date().toISOString().split("T")[0],
            approvalStatus: normalizedApprovalStatus,
            approvalHistory: data.approvalHistory || [],
            comments: data.comments || "",
            companyScope: data.businessId || activeBusinessId,
            rawDoc: data
          });
        });
      } catch (e) {
        console.warn("Expenses fetch warning:", e);
      }

      setItems(Array.from(fetchedItemsMap.values()));
    } catch (err) {
      console.error("Error loading pending approvals:", err);
      addToast("Failed to fetch pending approval workflows", "error");
    } finally {
      setLoading(false);
    }
  }, [currentUser, addToast]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  // Execute State Transition: Approve / Reject / Return
  const handleApprovalAction = async (
    item: PendingItem,
    newStatus: "approved" | "rejected" | "draft" | "pending_hr" | "pending_final"
  ) => {
    const activeBusinessId = item.companyScope || businessId;
    if (!activeBusinessId) return;

    setActionLoading(item.id);
    const comment = commentInputs[item.id] || "";
    const actionBy = currentUser?.displayName || currentUser?.email || auth.currentUser?.email || "Approver";
    const userRole = currentUser?.role || "STAFF";
    const userPosition = currentUser?.position || "Approver";
    const nowIso = new Date().toISOString();

    try {
      const newHistoryEntry = {
        status: newStatus,
        action: newStatus,
        type: newStatus === "approved" ? "approved" : newStatus === "rejected" ? "rejected" : "returned_draft",
        actionBy,
        user: actionBy,
        userRole,
        role: userRole,
        userPosition,
        position: userPosition,
        timestamp: nowIso,
        date: nowIso.split("T")[0],
        time: new Date().toLocaleTimeString(),
        comment: comment || (newStatus === "approved" ? "Approved by reviewer" : newStatus === "rejected" ? "Rejected by reviewer" : "Returned for revision")
      };

      const updatedHistory = [...(item.approvalHistory || []), newHistoryEntry];

      // Update Firestore document based on type
      if (item.type === "quotation") {
        const quotDocRef = doc(db, "companies", activeBusinessId, "quotations", item.id);
        await updateDoc(quotDocRef, {
          approvalStatus: newStatus,
          status: newStatus === "approved" ? "accepted" : newStatus === "rejected" ? "declined" : "pending",
          approvalHistory: updatedHistory,
          approvalComments: comment
        });

        // If approved, decrement inventory stock if applicable
        if (newStatus === "approved" && item.items && item.items.length > 0) {
          for (const lineItem of item.items) {
            if (lineItem.productId) {
              try {
                const prodRef = doc(db, "products", lineItem.productId);
                const pSnap = await getDoc(prodRef);
                if (pSnap.exists()) {
                  const pData = pSnap.data();
                  const currentStock = Number(pData.stock) || 0;
                  const newStock = Math.max(0, currentStock - (Number(lineItem.quantity) || 1));
                  await updateDoc(prodRef, { stock: newStock });
                  await logAction(
                    "Product Stock Decremented",
                    `Stock for '${pData.name}' reduced by ${lineItem.quantity} following approval of Quotation #${item.number}. New stock: ${newStock}`,
                    auth.currentUser?.uid || activeBusinessId
                  );
                }
              } catch (pErr) {
                console.warn("Stock decrement warning on quotation approval:", pErr);
              }
            }
          }
        }
      } else if (item.type === "invoice") {
        const invDocRef = doc(db, "companies", activeBusinessId, "invoices", item.id);
        await updateDoc(invDocRef, {
          approvalStatus: newStatus,
          status: newStatus === "approved" ? "unpaid" : newStatus === "rejected" ? "rejected" : "pending",
          approvalHistory: updatedHistory,
          approvalComments: comment
        });
      } else if (item.type === "expense") {
        const expDocRef = doc(db, "expenses", item.id);
        await updateDoc(expDocRef, {
          status: newStatus === "approved" ? "Approved" : newStatus === "rejected" ? "Rejected" : "Pending",
          approvalHistory: updatedHistory,
          comments: comment
        });
      }

      // Log database audit trail
      try {
        await logAction(
          `Document ${newStatus === "approved" ? "Approved" : newStatus === "rejected" ? "Rejected" : "Returned"}`,
          `Document ${item.number} (${item.type.toUpperCase()}) for client '${item.clientName || 'N/A'}' updated to ${newStatus.toUpperCase()} by ${actionBy} (${userPosition}). Note: "${newHistoryEntry.comment}"`,
          activeBusinessId,
          item.total
        );
      } catch (auditErr) {
        console.warn("Audit log record warning:", auditErr);
      }

      // Log department activity
      try {
        await logDepartmentActivity(
          item.department,
          `APPROVAL_${newStatus.toUpperCase()}`,
          `Document ${item.number} (${item.type}) updated to ${newStatus} by ${userPosition || actionBy}`,
          activeBusinessId
        );
      } catch (logErr) {
        console.warn("Department activity log warning:", logErr);
      }

      addToast(`Document ${item.number} successfully updated to ${newStatus.toUpperCase()}`, "success");
      setCommentInputs((prev) => ({ ...prev, [item.id]: "" }));
      await fetchPendingApprovals();
    } catch (err: any) {
      console.error("Error executing approval action:", err);
      addToast(err?.message || "Failed to update approval status", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Compile Comprehensive Audit Trail from all items
  const compiledAuditTrail = useMemo(() => {
    const list: AuditTrailRecord[] = [];

    items.forEach((item) => {
      const hist = item.approvalHistory || [];

      if (hist.length > 0) {
        hist.forEach((entry: any, index: number) => {
          const parsed = parseAuditTimestamp(
            entry.timestamp,
            entry.date || item.date,
            entry.time
          );

          const rawAction = (entry.status || entry.action || entry.type || "").toLowerCase();
          let actionLabel = "Action Logged";
          if (rawAction.includes("approved") || rawAction.includes("accepted")) actionLabel = "Document Approved";
          else if (rawAction.includes("rejected") || rawAction.includes("declined")) actionLabel = "Document Rejected";
          else if (rawAction.includes("draft_saved") || rawAction.includes("draft")) actionLabel = "Draft Created";
          else if (rawAction.includes("returned")) actionLabel = "Returned for Revision";
          else if (rawAction.includes("submitted")) actionLabel = "Submitted for Approval";
          else if (rawAction.includes("pending")) actionLabel = "Under Review";

          list.push({
            id: `${item.id}-hist-${index}`,
            documentId: item.id,
            documentNumber: item.number,
            documentType: item.type,
            department: item.department,
            clientName: item.clientName,
            total: item.total,
            action: rawAction || "updated",
            actionLabel,
            performedBy: entry.actionBy || entry.user || item.creatorName || "Staff Member",
            userRole: entry.userRole || entry.role || "STAFF",
            userPosition: entry.userPosition || entry.position || "Staff",
            timestamp: parsed.iso,
            dateFormatted: parsed.dateFormatted,
            timeFormatted: parsed.timeFormatted,
            relativeTime: parsed.relativeTime,
            comments: entry.comment || entry.comments || "",
            companyScope: item.companyScope,
            itemRef: item
          });
        });
      } else {
        // Fallback initial event for document creation
        const parsed = parseAuditTimestamp(undefined, item.date);
        list.push({
          id: `${item.id}-init`,
          documentId: item.id,
          documentNumber: item.number,
          documentType: item.type,
          department: item.department,
          clientName: item.clientName,
          total: item.total,
          action: item.approvalStatus === "draft" ? "draft" : "submitted",
          actionLabel: item.approvalStatus === "draft" ? "Draft Created" : "Document Submitted",
          performedBy: item.creatorName || "Staff Member",
          userRole: "STAFF",
          userPosition: "Author / Submitter",
          timestamp: parsed.iso,
          dateFormatted: parsed.dateFormatted,
          timeFormatted: parsed.timeFormatted,
          relativeTime: parsed.relativeTime,
          comments: item.comments || "Initial document entry in workflow system.",
          companyScope: item.companyScope,
          itemRef: item
        });
      }
    });

    // Sort audit trail chronologically
    return list.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return auditSortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });
  }, [items, auditSortOrder]);

  // Filtered Audit Trail List
  const filteredAuditTrail = useMemo(() => {
    return compiledAuditTrail.filter((event) => {
      // Search Filter
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase().trim();
        const matchNum = event.documentNumber.toLowerCase().includes(q);
        const matchClient = (event.clientName || "").toLowerCase().includes(q);
        const matchUser = event.performedBy.toLowerCase().includes(q);
        const matchDept = event.department.toLowerCase().includes(q);
        const matchComment = (event.comments || "").toLowerCase().includes(q);
        if (!matchNum && !matchClient && !matchUser && !matchDept && !matchComment) return false;
      }

      // Action Filter
      if (auditActionFilter !== "all") {
        const act = event.action.toLowerCase();
        if (auditActionFilter === "approved" && !act.includes("approved") && !act.includes("accepted")) return false;
        if (auditActionFilter === "rejected" && !act.includes("rejected") && !act.includes("declined")) return false;
        if (auditActionFilter === "returned" && !act.includes("returned") && !act.includes("draft")) return false;
        if (auditActionFilter === "submitted" && !act.includes("submitted") && !act.includes("created")) return false;
      }

      // Document Type Filter
      if (auditTypeFilter !== "all" && event.documentType !== auditTypeFilter) return false;

      // Department Filter
      if (auditDeptFilter !== "all" && event.department.toLowerCase() !== auditDeptFilter.toLowerCase()) return false;

      return true;
    });
  }, [compiledAuditTrail, auditSearch, auditActionFilter, auditTypeFilter, auditDeptFilter]);

  // Filtered Queue Items
  const filteredQueueItems = useMemo(() => {
    return items.filter((item) => {
      // Type Filter
      if (typeFilter !== "all" && item.type !== typeFilter) return false;

      // Dept Filter
      if (deptFilter !== "all" && item.department.toLowerCase() !== deptFilter.toLowerCase()) return false;

      // Status Tab Filter
      const st = item.approvalStatus?.toLowerCase() || "";
      if (statusTab === "pending") {
        const isPending = ["pending_admin", "pending_hr", "pending_final", "pending", "draft", "submitted", "unreviewed"].includes(st) ||
          (item.type === "quotation" && item.rawDoc?.status === "pending") ||
          (item.type === "invoice" && (item.rawDoc?.status === "pending" || (!item.rawDoc?.approvalStatus && item.rawDoc?.status === "unpaid")));
        if (!isPending) return false;
      } else if (statusTab === "draft") {
        if (st !== "draft") return false;
      } else if (statusTab === "approved") {
        if (!["approved", "accepted", "paid"].includes(st)) return false;
      } else if (statusTab === "rejected") {
        if (!["rejected", "declined"].includes(st)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = item.number.toLowerCase().includes(q);
        const matchClient = (item.clientName || "").toLowerCase().includes(q);
        const matchCreator = (item.creatorName || "").toLowerCase().includes(q);
        const matchDept = (item.department || "").toLowerCase().includes(q);
        return matchNum || matchClient || matchCreator || matchDept;
      }

      return true;
    });
  }, [items, typeFilter, deptFilter, statusTab, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_admin":
      case "pending":
      case "submitted":
      case "unreviewed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
            <Clock className="w-3 h-3 text-amber-600 shrink-0" /> Pending Admin
          </span>
        );
      case "pending_hr":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap">
            <Clock className="w-3 h-3 text-blue-600 shrink-0" /> Pending HR
          </span>
        );
      case "pending_final":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200 whitespace-nowrap">
            <Clock className="w-3 h-3 text-indigo-600 shrink-0" /> Pending Final
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
            <FileText className="w-3 h-3 text-slate-500 shrink-0" /> Draft
          </span>
        );
      case "approved":
      case "accepted":
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Approved
          </span>
        );
      case "rejected":
      case "declined":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200 whitespace-nowrap">
            <XCircle className="w-3 h-3 text-rose-600 shrink-0" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap uppercase">
            {status}
          </span>
        );
    }
  };

  const getActionBadge = (action: string, label: string) => {
    const act = action.toLowerCase();
    if (act.includes("approved") || act.includes("accepted")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> {label}
        </span>
      );
    }
    if (act.includes("rejected") || act.includes("declined")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 whitespace-nowrap">
          <XCircle className="w-3 h-3 text-rose-600 shrink-0" /> {label}
        </span>
      );
    }
    if (act.includes("returned") || act.includes("draft")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
          <RotateCcw className="w-3 h-3 text-amber-600 shrink-0" /> {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap">
        <FileCheck className="w-3 h-3 text-blue-600 shrink-0" /> {label}
      </span>
    );
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case "quotation":
        return <FileText className="w-4 h-4 text-blue-600" />;
      case "invoice":
        return <Receipt className="w-4 h-4 text-emerald-600" />;
      case "expense":
        return <Coins className="w-4 h-4 text-purple-600" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-indigo-600" />;
    }
  };

  const pendingCount = items.filter((i) =>
    ["pending_admin", "pending_hr", "pending_final", "pending", "draft", "submitted", "unreviewed"].includes(i.approvalStatus?.toLowerCase())
  ).length;

  const totalApprovedCount = compiledAuditTrail.filter((e) => e.action.includes("approved") || e.action.includes("accepted")).length;
  const totalRejectedCount = compiledAuditTrail.filter((e) => e.action.includes("rejected") || e.action.includes("declined")).length;
  const uniqueActorsCount = new Set(compiledAuditTrail.map((e) => e.performedBy)).size;

  // Export audit summary
  const handleCopyAuditSummary = () => {
    const textLines = filteredAuditTrail.map(
      (e) => `[${e.dateFormatted} ${e.timeFormatted}] ${e.documentNumber} (${e.documentType.toUpperCase()}) -> ${e.actionLabel} by ${e.performedBy} (${e.userPosition || e.userRole}). Note: "${e.comments || 'N/A'}"`
    );
    navigator.clipboard.writeText(textLines.join("\n"));
    addToast("Audit trail summary copied to clipboard!", "success");
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 font-sans overflow-x-hidden">
      {/* Top Header Banner */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-150 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
              Position: {currentUser?.position || currentUser?.role || "Staff"}
            </span>
            {departmentId && (
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                Division: {departmentId}
              </span>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            Departmental Approvals & Audit Hub
          </h1>
          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-2xl">
            Review and execute pending approval workflows, or inspect the comprehensive timestamped audit trail of all actions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
          {/* Main Mode Switcher: Queue vs Audit Trail */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode("queue")}
              className={`px-3 py-1.5 rounded-md text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === "queue"
                  ? "bg-white text-indigo-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              Approvals Queue
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setViewMode("audit_trail")}
              className={`px-3 py-1.5 rounded-md text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === "audit_trail"
                  ? "bg-white text-indigo-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="w-3.5 h-3.5 text-indigo-600" />
              Audit Trail
              <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-bold">
                {compiledAuditTrail.length}
              </span>
            </button>
          </div>

          <button
            onClick={() => fetchPendingApprovals()}
            disabled={loading}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition cursor-pointer"
            title="Refresh Approval Workflows"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW MODE 1: APPROVALS QUEUE                                             */}
      {/* ========================================================================= */}
      {viewMode === "queue" && (
        <div className="space-y-4">
          {/* Filter and Search Toolbar */}
          <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl shadow-xs space-y-3 min-w-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
              {/* Status Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto no-scrollbar max-w-full shrink-0">
                <button
                  onClick={() => setStatusTab("pending")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    statusTab === "pending"
                      ? "bg-white text-slate-900 shadow-xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Pending ({pendingCount})
                </button>
                <button
                  onClick={() => setStatusTab("draft")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    statusTab === "draft"
                      ? "bg-white text-slate-900 shadow-xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Drafts
                </button>
                <button
                  onClick={() => setStatusTab("approved")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    statusTab === "approved"
                      ? "bg-white text-slate-900 shadow-xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Approved
                </button>
                <button
                  onClick={() => setStatusTab("rejected")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    statusTab === "rejected"
                      ? "bg-white text-slate-900 shadow-xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Rejected
                </button>
                <button
                  onClick={() => setStatusTab("all")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    statusTab === "all"
                      ? "bg-white text-slate-900 shadow-xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All ({items.length})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full md:w-64 shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search reference, client, staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Sub-Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs font-medium text-slate-600">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filters:
              </span>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">All Document Types</option>
                <option value="quotation">Quotations Only</option>
                <option value="invoice">Invoices Only</option>
                <option value="expense">Expenses Only</option>
              </select>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">All Departments</option>
                <option value="sales">Sales & CRM</option>
                <option value="finance">Finance & Accounting</option>
                <option value="hr">HR & Operations</option>
                <option value="inventory">Inventory & Stock</option>
                <option value="projects">Projects Division</option>
                <option value="procurement">Procurement</option>
                <option value="marketing">Marketing</option>
              </select>

              {(typeFilter !== "all" || deptFilter !== (departmentId || "all") || searchQuery) && (
                <button
                  onClick={() => {
                    setTypeFilter("all");
                    setDeptFilter(departmentId || "all");
                    setSearchQuery("");
                  }}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer ml-auto"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Queue Items List */}
          {loading ? (
            <div className="p-10 text-center text-slate-400 text-xs font-bold uppercase tracking-wider bg-white rounded-xl border border-slate-200 animate-pulse">
              Loading approval workflows...
            </div>
          ) : filteredQueueItems.length === 0 ? (
            <div className="p-10 bg-white rounded-xl border border-slate-200 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Approvals Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {statusTab === "pending"
                  ? "All caught up! There are currently no documents pending review matching your filters."
                  : `No documents found in the '${statusTab}' filter category.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3 min-w-0">
              {filteredQueueItems.map((item) => {
                const historyCount = item.approvalHistory?.length || 0;
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3 hover:border-slate-300 transition min-w-0"
                  >
                    {/* Header Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3 min-w-0">
                      <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 shrink-0">
                          {getItemTypeIcon(item.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-black text-sm text-slate-900">{item.number}</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                              {item.type}
                            </span>
                            <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded">
                              {item.department}
                            </span>
                          </div>
                          <span className="text-xs text-slate-600 font-medium block truncate mt-0.5">
                            Client / Purpose: <strong className="text-slate-900">{item.clientName}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Value</span>
                          <span className="font-mono text-base font-black text-slate-900">
                            E{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>{getStatusBadge(item.approvalStatus)}</div>
                      </div>
                    </div>

                    {/* Metadata Attributes */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-lg border border-slate-150 min-w-0">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Submitted By</span>
                        <span className="font-bold text-slate-800 truncate block">{item.creatorName}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Date Recorded</span>
                        <span className="font-bold text-slate-800 truncate block">{item.date}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Line Items</span>
                        <span className="font-bold text-slate-800 truncate block">{item.items?.length || 1} Rows</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Department</span>
                        <span className="font-bold text-slate-800 uppercase font-mono truncate block">{item.department}</span>
                      </div>
                    </div>

                    {/* Items Summary Breakdown */}
                    {item.items && item.items.length > 0 && (
                      <div className="text-xs space-y-1 min-w-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Deliverables / Items:</span>
                        <div className="flex flex-wrap gap-1.5 max-w-full">
                          {item.items.map((it: any, i: number) => (
                            <span key={i} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 max-w-full break-words">
                              {it.description || it.name} × {it.quantity || 1} (E{(Number(it.price) || 0).toFixed(2)})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Integrated On-Card Audit Trail Section */}
                    <div className="pt-2 border-t border-slate-150 space-y-2 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-indigo-600" />
                          Document Audit Trail ({historyCount > 0 ? historyCount : 1} Event{historyCount !== 1 ? "s" : ""})
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedAuditItem(item)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> Full History & Certificate
                        </button>
                      </div>

                      {/* Micro Timeline */}
                      <div className="space-y-1.5 bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/80">
                        {item.approvalHistory && item.approvalHistory.length > 0 ? (
                          item.approvalHistory.map((hist: any, hIdx: number) => {
                            const parsed = parseAuditTimestamp(hist.timestamp, hist.date || item.date, hist.time);
                            return (
                              <div key={hIdx} className="flex items-start justify-between gap-2 text-[11px] bg-white p-2 rounded border border-slate-200/60 shadow-3xs">
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-extrabold text-slate-900">{hist.actionBy || hist.user || "Reviewer"}</span>
                                    <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.2 rounded">
                                      {hist.userPosition || hist.position || hist.userRole || "Staff"}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-mono">
                                      {parsed.dateFormatted} • {parsed.timeFormatted} ({parsed.relativeTime})
                                    </span>
                                  </div>
                                  <p className="text-slate-600 italic text-[11px] break-words">
                                    &ldquo;{hist.comment || hist.comments || "No comments entered."}&rdquo;
                                  </p>
                                </div>
                                <div className="shrink-0 pt-0.5">
                                  {getActionBadge(hist.status || hist.type || "updated", hist.status?.toUpperCase() || hist.type?.toUpperCase() || "LOG")}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="flex items-center justify-between text-[11px] text-slate-500 py-0.5 px-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Created by <strong>{item.creatorName}</strong> on {item.date}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">INITIAL SUBMISSION</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Interactive Approval Action Bar */}
                    {["pending_admin", "pending_hr", "pending_final", "pending", "draft", "submitted", "unreviewed"].includes(item.approvalStatus?.toLowerCase()) && (
                      <div className="pt-2.5 border-t border-slate-100 space-y-2.5 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            placeholder="Add an approval note or revision comment..."
                            value={commentInputs[item.id] || ""}
                            onChange={(e) => setCommentInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleApprovalAction(item, "draft")}
                            disabled={actionLoading === item.id}
                            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Return to Draft
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprovalAction(item, "rejected")}
                              disabled={actionLoading === item.id}
                              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApprovalAction(item, "approved")}
                              disabled={actionLoading === item.id}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE 2: DEDICATED AUDIT TRAIL SECTION                                */}
      {/* ========================================================================= */}
      {viewMode === "audit_trail" && (
        <div className="space-y-4">
          {/* Audit Metrics Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Logged Actions</span>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xl font-black text-slate-900">{compiledAuditTrail.length}</span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">All Events</span>
              </div>
              <span className="text-[10px] text-slate-500 block truncate">Across {items.length} documents</span>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Approved Actions</span>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xl font-black text-emerald-600">{totalApprovedCount}</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Verified</span>
              </div>
              <span className="text-[10px] text-emerald-600/80 block truncate">Valid authorizations</span>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Rejections & Returns</span>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xl font-black text-rose-600">{totalRejectedCount}</span>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">Audited</span>
              </div>
              <span className="text-[10px] text-slate-500 block truncate">Declined / revisions</span>
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Active Reviewers</span>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xl font-black text-slate-900">{uniqueActorsCount}</span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Personnel</span>
              </div>
              <span className="text-[10px] text-slate-500 block truncate">Recorded staff actors</span>
            </div>
          </div>

          {/* Audit Trail Filter & Search Toolbar */}
          <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-xl shadow-xs space-y-3 min-w-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
              <div className="relative w-full md:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search audit trail by doc #, reviewer, client, note..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                <button
                  onClick={handleCopyAuditSummary}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                  title="Copy formatted audit trail summary"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Summary
                </button>

                <button
                  onClick={() => setAuditSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {auditSortOrder === "desc" ? "Newest First" : "Oldest First"}
                </button>
              </div>
            </div>

            {/* Sub-Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs font-medium text-slate-600">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Filter className="w-3 h-3" /> Audit Filters:
              </span>

              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">All Actions</option>
                <option value="approved">Approvals Only</option>
                <option value="rejected">Rejections Only</option>
                <option value="returned">Returns / Drafts</option>
                <option value="submitted">Initial Submissions</option>
              </select>

              <select
                value={auditTypeFilter}
                onChange={(e) => setAuditTypeFilter(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">All Document Types</option>
                <option value="quotation">Quotations</option>
                <option value="invoice">Invoices</option>
                <option value="expense">Expenses</option>
              </select>

              <select
                value={auditDeptFilter}
                onChange={(e) => setAuditDeptFilter(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">All Departments</option>
                <option value="sales">Sales & CRM</option>
                <option value="finance">Finance & Accounting</option>
                <option value="hr">HR & Operations</option>
                <option value="inventory">Inventory & Stock</option>
                <option value="projects">Projects Division</option>
                <option value="procurement">Procurement</option>
                <option value="marketing">Marketing</option>
              </select>

              {(auditActionFilter !== "all" || auditTypeFilter !== "all" || auditDeptFilter !== (departmentId || "all") || auditSearch) && (
                <button
                  onClick={() => {
                    setAuditActionFilter("all");
                    setAuditTypeFilter("all");
                    setAuditDeptFilter(departmentId || "all");
                    setAuditSearch("");
                  }}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer ml-auto"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Audit Trail Timeline Stream / Table */}
          {loading ? (
            <div className="p-10 text-center text-slate-400 text-xs font-bold uppercase tracking-wider bg-white rounded-xl border border-slate-200 animate-pulse">
              Aggregating historical audit trail logs...
            </div>
          ) : filteredAuditTrail.length === 0 ? (
            <div className="p-10 bg-white rounded-xl border border-slate-200 text-center space-y-2">
              <History className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Audit Records Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No historical actions or approval events matched your filter criteria.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-slate-500">
                  <History className="w-3.5 h-3.5 text-indigo-600" />
                  Chronological Event Stream ({filteredAuditTrail.length} Events)
                </span>
                <span className="text-[10px] font-mono text-slate-400">AUDIT PROTOCOL ACTIVE</span>
              </div>

              <div className="divide-y divide-slate-150">
                {filteredAuditTrail.map((record) => {
                  const initials = record.performedBy
                    ? record.performedBy.substring(0, 2).toUpperCase()
                    : "ST";

                  return (
                    <div
                      key={record.id}
                      className="p-4 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-start justify-between gap-3 group"
                    >
                      {/* Left: Timestamp & Action Badge */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 font-extrabold flex items-center justify-center text-xs shrink-0 mt-0.5 border border-indigo-200">
                          {initials}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900">{record.performedBy}</span>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full">
                              {record.userPosition || record.userRole || "Reviewer"}
                            </span>
                            {getActionBadge(record.action, record.actionLabel)}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                              {getItemTypeIcon(record.documentType)}
                              {record.documentNumber}
                            </span>
                            <span>•</span>
                            <span className="capitalize">{record.documentType}</span>
                            <span>•</span>
                            <span className="uppercase font-mono text-[10px] text-slate-400">{record.department}</span>
                            <span>•</span>
                            <span>Client / Target: <strong className="text-slate-800">{record.clientName || "Corporate"}</strong></span>
                            <span>•</span>
                            <span className="font-mono font-bold text-slate-900">E{record.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>

                          {/* Justification / Comments */}
                          {record.comments && (
                            <div className="p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-700 italic max-w-2xl mt-1">
                              &ldquo;{record.comments}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Timestamp & Action Button */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-left sm:text-right">
                          <span className="text-xs font-bold text-slate-800 block font-mono">
                            {record.dateFormatted}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {record.timeFormatted} ({record.relativeTime})
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedAuditItem(record.itemRef)}
                          className="px-2.5 py-1 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 shadow-3xs transition cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> View Doc
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DOCUMENT AUDIT HISTORY INSPECTOR MODAL                                    */}
      {/* ========================================================================= */}
      {selectedAuditItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-indigo-50 text-indigo-600 rounded border border-indigo-150">
                    <History className="w-4 h-4" />
                  </span>
                  <h2 className="text-base font-black text-slate-900">
                    Document Audit Lifecycle & History
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Complete timestamped log of authorizations and actions for {selectedAuditItem.number}.
                </p>
              </div>

              <button
                onClick={() => setSelectedAuditItem(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Summary Card */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Document Ref</span>
                <span className="font-mono font-extrabold text-slate-900">{selectedAuditItem.number}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Type / Dept</span>
                <span className="font-bold text-slate-800 uppercase font-mono">{selectedAuditItem.type} ({selectedAuditItem.department})</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Value</span>
                <span className="font-mono font-bold text-slate-900">E{selectedAuditItem.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Current Status</span>
                <div>{getStatusBadge(selectedAuditItem.approvalStatus)}</div>
              </div>
            </div>

            {/* Step-by-Step Chronological Audit Timeline */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Audit Trail Chronology ({selectedAuditItem.approvalHistory?.length || 1} Stages)
              </h3>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {selectedAuditItem.approvalHistory && selectedAuditItem.approvalHistory.length > 0 ? (
                  selectedAuditItem.approvalHistory.map((step: any, sIdx: number) => {
                    const parsed = parseAuditTimestamp(
                      step.timestamp,
                      step.date || selectedAuditItem.date,
                      step.time
                    );

                    return (
                      <div key={sIdx} className="relative space-y-1 text-xs">
                        {/* Timeline Bullet */}
                        <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white shadow-xs" />

                        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-3xs space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900">{step.actionBy || step.user || "Reviewer"}</span>
                              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-1.5 py-0.2 rounded">
                                {step.userPosition || step.position || step.userRole || "Staff"}
                              </span>
                            </div>
                            {getActionBadge(step.status || step.type || "updated", step.status?.toUpperCase() || step.type?.toUpperCase() || "LOG")}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                            <span>Recorded: {parsed.dateFormatted} at {parsed.timeFormatted}</span>
                            <span>•</span>
                            <span>{parsed.relativeTime}</span>
                          </div>

                          <p className="text-xs text-slate-700 italic bg-slate-50 p-2 rounded border border-slate-150">
                            &ldquo;{step.comment || step.comments || "No comments attached to this action."}&rdquo;
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="relative space-y-1 text-xs">
                    <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white shadow-xs" />
                    <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-3xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">{selectedAuditItem.creatorName}</span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">CREATION</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block">Recorded: {selectedAuditItem.date}</span>
                      <p className="text-xs text-slate-600 italic">Initial document entry into corporate registry.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">
                Scope: {selectedAuditItem.companyScope}
              </span>

              <button
                onClick={() => setSelectedAuditItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

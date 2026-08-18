"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useUserStore, useToastStore } from "../lib/store";
import { logDepartmentActivity } from "../lib/department";
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
  UserCheck,
  Building2,
  ChevronDown
} from "lucide-react";

interface PendingItem {
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
  rawDoc: any;
}

export default function Approvals({ departmentId }: { departmentId?: string }) {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>(departmentId || "all");
  const [statusTab, setStatusTab] = useState<string>("pending"); // 'pending' | 'approved' | 'rejected' | 'all'
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const businessId = currentUser?.companyId || currentUser?.businessId;

  const fetchPendingApprovals = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const fetchedItems: PendingItem[] = [];

      // 1. Fetch Quotations
      try {
        const quotRef = collection(db, "companies", businessId, "quotations");
        const quotSnap = await getDocs(quotRef);
        quotSnap.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedItems.push({
            id: docSnap.id,
            type: "quotation",
            number: data.number || `QT-${docSnap.id.substring(0, 5)}`,
            clientName: data.clientName || data.client || "Client",
            clientEmail: data.clientEmail || "",
            creatorName: data.createdByName || data.creatorEmail || "Sales Staff",
            department: data.department || "sales",
            total: Number(data.total) || 0,
            date: data.date || new Date().toISOString().split("T")[0],
            approvalStatus: data.approvalStatus || (data.status === "pending" ? "pending_admin" : data.status || "approved"),
            approvalHistory: data.approvalHistory || [],
            comments: data.approvalComments || "",
            items: data.items || [],
            rawDoc: data
          });
        });
      } catch (e) {
        console.warn("Quotations approval query warning:", e);
      }

      // 2. Fetch Invoices
      try {
        const invRef = collection(db, "companies", businessId, "invoices");
        const invSnap = await getDocs(invRef);
        invSnap.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedItems.push({
            id: docSnap.id,
            type: "invoice",
            number: data.number || `INV-${docSnap.id.substring(0, 5)}`,
            clientName: data.clientName || data.client || "Client",
            clientEmail: data.clientEmail || "",
            creatorName: data.createdByName || data.creatorEmail || "Billing Staff",
            department: data.department || "finance",
            total: Number(data.total) || 0,
            date: data.date || new Date().toISOString().split("T")[0],
            approvalStatus: data.approvalStatus || (data.status === "pending" ? "pending_admin" : data.status || "approved"),
            approvalHistory: data.approvalHistory || [],
            comments: data.approvalComments || "",
            items: data.items || [],
            rawDoc: data
          });
        });
      } catch (e) {
        console.warn("Invoices approval query warning:", e);
      }

      // 3. Fetch Expenses
      try {
        const expRef = collection(db, "expenses");
        const expSnap = await getDocs(query(expRef, where("businessId", "==", businessId)));
        expSnap.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedItems.push({
            id: docSnap.id,
            type: "expense",
            number: `EXP-${docSnap.id.substring(0, 5)}`,
            clientName: data.description || "Corporate Expense Claim",
            creatorName: data.createdByName || "Staff Member",
            department: data.department || "finance",
            total: Number(data.amount) || 0,
            date: data.date || new Date().toISOString().split("T")[0],
            approvalStatus: data.status === "Pending" ? "pending_admin" : (data.status?.toLowerCase() || "approved"),
            approvalHistory: data.approvalHistory || [],
            comments: data.comments || "",
            rawDoc: data
          });
        });
      } catch (e) {
        console.warn("Expenses approval query warning:", e);
      }

      setItems(fetchedItems);
    } catch (err) {
      console.error("Error loading pending approvals:", err);
      addToast("Failed to fetch pending approval workflows", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
  }, [businessId]);

  // Execute State Transition: Approve / Reject / Return
  const handleApprovalAction = async (
    item: PendingItem,
    newStatus: "approved" | "rejected" | "draft" | "pending_hr" | "pending_final"
  ) => {
    if (!businessId) return;

    setActionLoading(item.id);
    const comment = commentInputs[item.id] || "";

    try {
      const isUserAdmin = currentUser?.role === "MASTER_ADMIN" || currentUser?.role === "BUSINESS_ADMIN";
      const hasRight = isUserAdmin || currentUser?.approvalRights || currentUser?.canApproveQuotations || currentUser?.canApproveInvoices;

      if (!hasRight) {
        addToast("Your staff position does not have approval rights for this document.", "error");
        setActionLoading(null);
        return;
      }

      const updatedHistory = [
        ...(item.approvalHistory || []),
        {
          status: newStatus,
          actionBy: currentUser?.email || "Manager",
          userRole: currentUser?.role || "STAFF",
          userPosition: currentUser?.position || "Approver",
          timestamp: new Date().toISOString(),
          comment: comment
        }
      ];

      // Update Firestore document based on type
      if (item.type === "quotation") {
        const quotDocRef = doc(db, "companies", businessId, "quotations", item.id);
        await updateDoc(quotDocRef, {
          approvalStatus: newStatus,
          status: newStatus === "approved" ? "accepted" : newStatus === "rejected" ? "declined" : "pending",
          approvalHistory: updatedHistory,
          approvalComments: comment
        });
      } else if (item.type === "invoice") {
        const invDocRef = doc(db, "companies", businessId, "invoices", item.id);
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

      // Log department activity
      await logDepartmentActivity(
        item.department,
        `APPROVAL_ACTION_${newStatus.toUpperCase()}`,
        `Document ${item.number} (${item.type}) updated to ${newStatus} by ${currentUser?.position || currentUser?.email}`,
        businessId
      );

      addToast(`Document ${item.number} successfully marked as ${newStatus.toUpperCase()}`, "success");
      setCommentInputs((prev) => ({ ...prev, [item.id]: "" }));
      await fetchPendingApprovals();
    } catch (err: any) {
      console.error("Error executing approval action:", err);
      addToast(err?.message || "Failed to update approval status", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Filter Logic
  const filteredItems = items.filter((item) => {
    // Type Filter
    if (typeFilter !== "all" && item.type !== typeFilter) return false;

    // Dept Filter
    if (deptFilter !== "all" && item.department.toLowerCase() !== deptFilter.toLowerCase()) return false;

    // Status Filter
    if (statusTab === "pending") {
      if (!["pending_admin", "pending_hr", "pending_final", "pending"].includes(item.approvalStatus)) return false;
    } else if (statusTab === "approved") {
      if (item.approvalStatus !== "approved" && item.approvalStatus !== "accepted") return false;
    } else if (statusTab === "rejected") {
      if (item.approvalStatus !== "rejected" && item.approvalStatus !== "declined") return false;
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = item.number.toLowerCase().includes(q);
      const matchClient = (item.clientName || "").toLowerCase().includes(q);
      const matchCreator = (item.creatorName || "").toLowerCase().includes(q);
      return matchNum || matchClient || matchCreator;
    }

    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_admin":
      case "pending":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending Admin</span>;
      case "pending_hr":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending HR</span>;
      case "pending_final":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending Final</span>;
      case "approved":
      case "accepted":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
      case "rejected":
      case "declined":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
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

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-150">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full">
              Position: {currentUser?.position || currentUser?.role || "Staff"}
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Departmental Approvals Center
          </h1>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            Review, audit, approve, or reject pending commercial quotations, invoices, and expense requests across corporate departments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-amber-50 border border-amber-200 p-2.5 px-4 rounded-xl text-center">
            <span className="text-[9px] font-bold text-amber-700 uppercase tracking-widest block">Pending Review</span>
            <span className="font-mono text-lg font-black text-amber-900">
              {items.filter(i => ["pending_admin", "pending_hr", "pending_final", "pending"].includes(i.approvalStatus)).length} Items
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-3xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setStatusTab("pending")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider ${
                statusTab === "pending" ? "bg-white text-slate-900 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Pending Approval
            </button>
            <button
              onClick={() => setStatusTab("approved")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider ${
                statusTab === "approved" ? "bg-white text-slate-900 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setStatusTab("rejected")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider ${
                statusTab === "rejected" ? "bg-white text-slate-900 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Rejected
            </button>
            <button
              onClick={() => setStatusTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider ${
                statusTab === "all" ? "bg-white text-slate-900 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All Records
            </button>
          </div>

          {/* Search Field */}
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search reference, client, or staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Sub-Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-600">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filters:
          </span>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-700"
          >
            <option value="all">All Document Types</option>
            <option value="quotation">Quotations Only</option>
            <option value="invoice">Invoices Only</option>
            <option value="expense">Expenses Only</option>
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-700"
          >
            <option value="all">All Departments</option>
            <option value="sales">Sales & CRM</option>
            <option value="finance">Finance & Accounting</option>
            <option value="hr">HR & Payroll</option>
            <option value="inventory">Inventory & Procurement</option>
          </select>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-bold uppercase tracking-wider animate-pulse bg-white rounded-2xl border border-slate-200">
          Loading approval workflows...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Pending Approvals Found</h3>
          <p className="text-xs text-slate-500">
            There are no documents matching your selected filters or pending your review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredItems.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4 hover:border-slate-300 transition"
            >
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {getItemTypeIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-sm text-slate-900">{item.number}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border px-2 py-0.5 rounded-md">
                        {item.type.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-semibold block">
                      Client / Description: <strong className="text-slate-800">{item.clientName}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-center">
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Amount</span>
                    <span className="font-mono text-base font-black text-slate-900">
                      E{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>{getStatusBadge(item.approvalStatus)}</div>
                </div>
              </div>

              {/* Sub-Details & Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Department</span>
                  <span className="font-bold text-slate-800 uppercase font-mono">{item.department}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Submitted By</span>
                  <span className="font-bold text-slate-800">{item.creatorName}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Date Created</span>
                  <span className="font-bold text-slate-800">{item.date}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Line Items</span>
                  <span className="font-bold text-slate-800">{item.items?.length || 1} Items</span>
                </div>
              </div>

              {/* Items Summary if available */}
              {item.items && item.items.length > 0 && (
                <div className="text-xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Summary Breakdown:</span>
                  <div className="flex flex-wrap gap-2">
                    {item.items.map((it: any, i: number) => (
                      <span key={i} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-200">
                        {it.description || it.name} × {it.quantity || 1} (E{(Number(it.price) || 0).toFixed(2)})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Approval History / Notes */}
              {item.approvalHistory && item.approvalHistory.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Audit Trail & Comments:</span>
                  <div className="space-y-1 max-h-24 overflow-y-auto text-[11px]">
                    {item.approvalHistory.map((hist: any, hIdx: number) => (
                      <div key={hIdx} className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-800">{hist.actionBy || "User"}</span> ({hist.userPosition || hist.userRole}):{" "}
                          <span className="italic text-slate-600">"{hist.comment || "No comment"}"</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400">{hist.status?.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions & Comment Input Box */}
              {["pending_admin", "pending_hr", "pending_final", "pending"].includes(item.approvalStatus) && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Add approval / rejection note or comment..."
                      value={commentInputs[item.id] || ""}
                      onChange={(e) => setCommentInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      onClick={() => handleApprovalAction(item, "draft")}
                      disabled={actionLoading === item.id}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Return for Revision
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprovalAction(item, "rejected")}
                        disabled={actionLoading === item.id}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <X className="w-4 h-4" /> Reject Request
                      </button>

                      <button
                        onClick={() => handleApprovalAction(item, "approved")}
                        disabled={actionLoading === item.id}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> Approve Document
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

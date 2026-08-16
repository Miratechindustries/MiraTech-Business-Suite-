"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Plus,
  Trash2,
  Edit,
  X,
  User,
  Phone,
  Mail,
  Building,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Receipt,
  DollarSign,
  Clock,
  ArrowUpRight,
  Check,
  Eye,
  ChevronRight,
  Filter,
  CreditCard,
  RefreshCw,
  Coins,
  Send,
  Save,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Briefcase
} from "lucide-react";
import { auth, db, handleFirestoreError, OperationType, isOfflineError } from "../lib/firebase";
import { useUserStore, useToastStore } from "../lib/store";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  orderBy
} from "firebase/firestore";
import { logAction } from "../lib/audit";
import { notifyManagersForApproval } from "../lib/approvalNotifications";

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  totalBilling: number;
  status: "Active" | "Inactive";
  notes?: string;
  createdAt?: string;
}

export interface ClientQuotation {
  id?: string;
  number: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  date: string;
  validUntil: string;
  items: Array<{ description: string; quantity: number; price: number; productId?: string }>;
  total: number;
  status: "pending" | "accepted" | "declined";
  approvalStatus?: "draft" | "pending_admin" | "pending_hr" | "pending_final" | "approved" | "rejected";
  department?: string;
  approvalHistory?: any[];
  invoiceReference?: string;
}

export interface ClientInvoice {
  id?: string;
  number: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  date: string;
  dueDate: string;
  items: Array<{ description: string; quantity: number; price: number }>;
  total: number;
  status: "paid" | "unpaid";
  approvalStatus?: "draft" | "pending_admin" | "pending_hr" | "pending_final" | "approved" | "rejected";
  department?: string;
  approvalHistory?: any[];
}

export interface ClientReceipt {
  id?: string;
  number: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  paymentMethod: string;
  date: string;
  amount: number;
  status: string;
  department?: string;
}

export default function Customers() {
  const { currentUser } = useUserStore();
  const { addToast } = useToastStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotations, setQuotations] = useState<ClientQuotation[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [receipts, setReceipts] = useState<ClientReceipt[]>([]);
  const [companyData, setCompanyData] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCust, setEditingCust] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<"overview" | "quotations" | "invoices" | "receipts">("overview");

  // In-CRM Quick Create Modals
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<ClientInvoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("EFT Bank Transfer");
  const [submittingDoc, setSubmittingDoc] = useState(false);

  // Customer Form Fields
  const [custName, setCustName] = useState("");
  const [custCompany, setCustCompany] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custNotes, setCustNotes] = useState("");
  const [custStatus, setCustStatus] = useState<"Active" | "Inactive">("Active");

  // Quotation/Invoice Form Fields
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState("");
  const [docDueDate, setDocDueDate] = useState("");
  const [docItems, setDocItems] = useState<Array<{ description: string; quantity: number; price: number }>>([
    { description: "", quantity: 1, price: 0 }
  ]);

  const activeBusinessId = currentUser?.companyId || currentUser?.businessId || (auth.currentUser?.uid || "");

  // Fetch all CRM data
  const fetchCRMData = useCallback(async (isSilent = false) => {
    if (!activeBusinessId) return;
    if (!isSilent) setLoading(true);
    setRefreshing(true);

    try {
      // 1. Fetch Company profile
      try {
        const compDoc = await getDoc(doc(db, "companies", activeBusinessId));
        if (compDoc.exists()) {
          setCompanyData(compDoc.data());
        }
      } catch (cErr) {
        console.warn("Company profile fetch fallback:", cErr);
      }

      // 2. Fetch Customers
      const custQuery = query(collection(db, "customers"), where("businessId", "==", activeBusinessId));
      const custSnap = await getDocs(custQuery);
      const custList = custSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
      setCustomers(custList);

      // 3. Fetch Quotations
      try {
        const quotsSnap = await getDocs(collection(db, "companies", activeBusinessId, "quotations"));
        const quotsList = quotsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientQuotation));
        setQuotations(quotsList);
      } catch (qErr) {
        console.warn("Quotations fetch fallback:", qErr);
      }

      // 4. Fetch Invoices
      try {
        const invsSnap = await getDocs(collection(db, "companies", activeBusinessId, "invoices"));
        const invsList = invsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientInvoice));
        setInvoices(invsList);
      } catch (iErr) {
        console.warn("Invoices fetch fallback:", iErr);
      }

      // 5. Fetch Receipts
      try {
        const recsSnap = await getDocs(collection(db, "companies", activeBusinessId, "receipts"));
        const recsList = recsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientReceipt));
        setReceipts(recsList);
      } catch (rErr) {
        console.warn("Receipts fetch fallback:", rErr);
      }
    } catch (err: any) {
      console.error("Error loading CRM data:", err);
      addToast(err?.message || "Failed to load CRM data", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeBusinessId, addToast]);

  useEffect(() => {
    fetchCRMData();
  }, [fetchCRMData]);

  // Compute live financial summary per customer
  const customerFinancials = useMemo(() => {
    const map = new Map<
      string,
      {
        totalQuoted: number;
        totalInvoiced: number;
        totalPaid: number;
        unpaidBalance: number;
        quotationCount: number;
        invoiceCount: number;
        receiptCount: number;
      }
    >();

    customers.forEach((c) => {
      const cName = (c.name || "").toLowerCase().trim();
      const cComp = (c.company || "").toLowerCase().trim();
      const cEmail = (c.email || "").toLowerCase().trim();

      const match = (itemClientName?: string, itemClientEmail?: string) => {
        const iName = (itemClientName || "").toLowerCase().trim();
        const iEmail = (itemClientEmail || "").toLowerCase().trim();
        if (cEmail && iEmail && cEmail === iEmail) return true;
        if (cName && iName && (iName.includes(cName) || cName.includes(iName))) return true;
        if (cComp && iName && (iName.includes(cComp) || cComp.includes(iName))) return true;
        return false;
      };

      const clientQuots = quotations.filter((q) => match(q.clientName, q.clientEmail));
      const clientInvs = invoices.filter((i) => match(i.clientName, i.clientEmail));
      const clientRecs = receipts.filter((r) => match(r.clientName, r.clientEmail));

      const totalQuoted = clientQuots.reduce((acc, q) => acc + (Number(q.total) || 0), 0);
      const totalInvoiced = clientInvs.reduce((acc, i) => acc + (Number(i.total) || 0), 0);
      const totalPaid = clientRecs.reduce((acc, r) => acc + (Number(r.amount) || 0), 0) +
        clientInvs.filter((i) => i.status === "paid").reduce((acc, i) => acc + (Number(i.total) || 0), 0) / 2; // de-dupe approximation
      
      const actualPaid = clientInvs
        .filter((i) => i.status === "paid")
        .reduce((acc, i) => acc + (Number(i.total) || 0), 0);
      const unpaidBalance = clientInvs
        .filter((i) => i.status === "unpaid")
        .reduce((acc, i) => acc + (Number(i.total) || 0), 0);

      map.set(c.id, {
        totalQuoted,
        totalInvoiced,
        totalPaid: actualPaid || c.totalBilling || 0,
        unpaidBalance,
        quotationCount: clientQuots.length,
        invoiceCount: clientInvs.length,
        receiptCount: clientRecs.length
      });
    });

    return map;
  }, [customers, quotations, invoices, receipts]);

  // Handle Customer Create / Edit
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custEmail.trim() || !activeBusinessId) {
      addToast("Customer name and email are required.", "error");
      return;
    }

    const payload = {
      businessId: activeBusinessId,
      name: custName.trim(),
      company: custCompany.trim() || "Individual Client",
      email: custEmail.trim(),
      phone: custPhone.trim(),
      address: custAddress.trim(),
      notes: custNotes.trim(),
      status: custStatus,
      totalBilling: editingCust ? editingCust.totalBilling : 0,
      createdAt: editingCust?.createdAt || new Date().toISOString()
    };

    try {
      if (editingCust) {
        await updateDoc(doc(db, "customers", editingCust.id), payload);
        await logAction(
          "Customer Profile Updated",
          `Updated client profile for ${payload.name} (${payload.company})`,
          activeBusinessId
        );
        addToast(`Client '${payload.name}' profile updated successfully`, "success");
      } else {
        const docRef = await addDoc(collection(db, "customers"), payload);
        await logAction(
          "Customer Created",
          `Registered new CRM client ${payload.name} (${payload.company})`,
          activeBusinessId
        );
        addToast(`Client '${payload.name}' registered successfully`, "success");
      }

      setIsCustomerModalOpen(false);
      resetCustomerForm();
      fetchCRMData(true);
    } catch (err: any) {
      console.error("Error saving customer:", err);
      addToast(err?.message || "Failed to save client profile", "error");
    }
  };

  const handleDeleteCustomer = async (cust: Customer) => {
    if (!confirm(`Are you sure you want to delete customer '${cust.name}'?`)) return;
    try {
      await deleteDoc(doc(db, "customers", cust.id));
      await logAction(
        "Customer Deleted",
        `Removed CRM client ${cust.name} (${cust.company})`,
        activeBusinessId
      );
      addToast(`Client '${cust.name}' removed from directory`, "warning");
      if (selectedCustomer?.id === cust.id) setSelectedCustomer(null);
      fetchCRMData(true);
    } catch (err: any) {
      console.error("Error deleting customer:", err);
      addToast(err?.message || "Failed to delete customer", "error");
    }
  };

  const resetCustomerForm = () => {
    setEditingCust(null);
    setCustName("");
    setCustCompany("");
    setCustEmail("");
    setCustPhone("");
    setCustAddress("");
    setCustNotes("");
    setCustStatus("Active");
  };

  const openEditCustomer = (cust: Customer) => {
    setEditingCust(cust);
    setCustName(cust.name);
    setCustCompany(cust.company === "Individual Client" ? "" : cust.company);
    setCustEmail(cust.email);
    setCustPhone(cust.phone || "");
    setCustAddress(cust.address || "");
    setCustNotes(cust.notes || "");
    setCustStatus(cust.status);
    setIsCustomerModalOpen(true);
  };

  // Quick Quotation Launch
  const openNewQuotation = (cust?: Customer) => {
    const target = cust || selectedCustomer;
    const generatedNum = `QT-${Date.now().toString().slice(-6)}`;
    setDocNumber(generatedNum);
    setDocDate(new Date().toISOString().split("T")[0]);
    setDocDueDate(new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);
    setDocItems([{ description: "", quantity: 1, price: 0 }]);
    if (target) {
      setSelectedCustomer(target);
    }
    setIsQuotationModalOpen(true);
  };

  // Quick Invoice Launch
  const openNewInvoice = (cust?: Customer) => {
    const target = cust || selectedCustomer;
    const generatedNum = `INV-${Date.now().toString().slice(-6)}`;
    setDocNumber(generatedNum);
    setDocDate(new Date().toISOString().split("T")[0]);
    setDocDueDate(new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]);
    setDocItems([{ description: "", quantity: 1, price: 0 }]);
    if (target) {
      setSelectedCustomer(target);
    }
    setIsInvoiceModalOpen(true);
  };

  // Submit In-CRM Quotation
  const handleSaveQuotation = async (isDraft = false) => {
    const user = auth.currentUser;
    if (!user || !activeBusinessId) {
      addToast("Authentication required to draft quotation.", "error");
      return;
    }
    const client = selectedCustomer;
    if (!client) {
      addToast("Please select a target client.", "error");
      return;
    }

    const total = docItems.reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.price) || 0), 0);
    if (!isDraft && (docItems.length === 0 || !docItems.some((it) => it.description.trim()))) {
      addToast("Please enter at least one line item with a description.", "error");
      return;
    }

    setSubmittingDoc(true);
    const payload: ClientQuotation = {
      number: docNumber.trim() || `QT-${Date.now().toString().slice(-6)}`,
      clientName: client.name,
      clientEmail: client.email,
      clientAddress: client.address,
      date: docDate || new Date().toISOString().split("T")[0],
      validUntil: docDueDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      items: docItems.length > 0 ? docItems : [{ description: "Quotation Item", quantity: 1, price: 0 }],
      total,
      status: "pending",
      approvalStatus: isDraft ? "draft" : "pending_admin",
      department: "sales",
      approvalHistory: [
        {
          type: isDraft ? "draft_saved" : "submitted",
          user: currentUser?.displayName || currentUser?.email || "Sales Staff",
          userId: user.uid,
          role: currentUser?.role || "STAFF",
          position: currentUser?.position || "Sales Staff",
          date: new Date().toISOString().split("T")[0],
          time: new Date().toLocaleTimeString(),
          comments: isDraft ? "Draft quotation created from CRM." : "Quotation submitted from Sales CRM."
        }
      ]
    };

    try {
      await addDoc(collection(db, "companies", activeBusinessId, "quotations"), {
        ...payload,
        ownerId: user.uid
      });

      await logAction(
        "CRM Quotation Drafted",
        `Drafted quotation #${payload.number} for client '${client.name}'. Value: E${total}`,
        activeBusinessId,
        total
      );

      if (!isDraft) {
        try {
          await notifyManagersForApproval({
            businessId: activeBusinessId,
            documentType: "quotation",
            documentNumber: payload.number,
            creatorName: currentUser?.displayName || currentUser?.email || "Sales Staff",
            department: "sales",
            totalAmount: payload.total,
            companyName: companyData?.name || "MIRA SUITE"
          });
        } catch (nErr) {
          console.warn("Manager notification warning:", nErr);
        }
      }

      addToast(
        isDraft
          ? `Quotation #${payload.number} saved as draft`
          : `Quotation #${payload.number} submitted for manager review!`,
        "success"
      );
      setIsQuotationModalOpen(false);
      fetchCRMData(true);
    } catch (err: any) {
      console.error("Error creating quotation from CRM:", err);
      addToast(err?.message || "Failed to create quotation", "error");
    } finally {
      setSubmittingDoc(false);
    }
  };

  // Submit In-CRM Invoice
  const handleSaveInvoice = async (isDraft = false) => {
    const user = auth.currentUser;
    if (!user || !activeBusinessId) {
      addToast("Authentication required to bill invoice.", "error");
      return;
    }
    const client = selectedCustomer;
    if (!client) {
      addToast("Please select a target client.", "error");
      return;
    }

    const total = docItems.reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.price) || 0), 0);
    if (!isDraft && (docItems.length === 0 || !docItems.some((it) => it.description.trim()))) {
      addToast("Please enter at least one line item with a description.", "error");
      return;
    }

    setSubmittingDoc(true);
    const payload: ClientInvoice = {
      number: docNumber.trim() || `INV-${Date.now().toString().slice(-6)}`,
      clientName: client.name,
      clientEmail: client.email,
      clientAddress: client.address,
      date: docDate || new Date().toISOString().split("T")[0],
      dueDate: docDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      items: docItems.length > 0 ? docItems : [{ description: "Invoice Item", quantity: 1, price: 0 }],
      total,
      status: "unpaid",
      approvalStatus: isDraft ? "draft" : "pending_admin",
      department: "sales",
      approvalHistory: [
        {
          type: isDraft ? "draft_saved" : "submitted",
          user: currentUser?.displayName || currentUser?.email || "Sales Staff",
          userId: user.uid,
          role: currentUser?.role || "STAFF",
          position: currentUser?.position || "Sales Staff",
          date: new Date().toISOString().split("T")[0],
          time: new Date().toLocaleTimeString(),
          comments: isDraft ? "Draft invoice created from CRM." : "Invoice billed from Sales CRM."
        }
      ]
    };

    try {
      await addDoc(collection(db, "companies", activeBusinessId, "invoices"), {
        ...payload,
        ownerId: user.uid
      });

      await logAction(
        "CRM Invoice Generated",
        `Generated invoice #${payload.number} for client '${client.name}'. Amount: E${total}`,
        activeBusinessId,
        total
      );

      if (!isDraft) {
        try {
          await notifyManagersForApproval({
            businessId: activeBusinessId,
            documentType: "invoice",
            documentNumber: payload.number,
            creatorName: currentUser?.displayName || currentUser?.email || "Sales Staff",
            department: "finance",
            totalAmount: payload.total,
            companyName: companyData?.name || "MIRA SUITE"
          });
        } catch (nErr) {
          console.warn("Manager notification warning:", nErr);
        }
      }

      addToast(
        isDraft
          ? `Invoice #${payload.number} saved as draft`
          : `Invoice #${payload.number} submitted for review & client billing!`,
        "success"
      );
      setIsInvoiceModalOpen(false);
      fetchCRMData(true);
    } catch (err: any) {
      console.error("Error creating invoice from CRM:", err);
      addToast(err?.message || "Failed to create invoice", "error");
    } finally {
      setSubmittingDoc(false);
    }
  };

  // Record Payment for Invoice
  const handleRecordPayment = async () => {
    if (!payingInvoice || !payingInvoice.id || !activeBusinessId) return;
    const user = auth.currentUser;

    const receiptPayload: ClientReceipt = {
      number: `REC-${payingInvoice.number.replace("INV-", "")}`,
      invoiceNumber: payingInvoice.number,
      clientName: payingInvoice.clientName,
      clientEmail: payingInvoice.clientEmail,
      paymentMethod,
      date: new Date().toISOString().split("T")[0],
      amount: payingInvoice.total,
      status: "completed",
      department: "finance"
    };

    try {
      setSubmittingDoc(true);
      // 1. Mark invoice as paid
      await updateDoc(doc(db, "companies", activeBusinessId, "invoices", payingInvoice.id), {
        status: "paid"
      });

      // 2. Add receipt
      await addDoc(collection(db, "companies", activeBusinessId, "receipts"), {
        ...receiptPayload,
        ownerId: user?.uid || activeBusinessId
      });

      // 3. Log audit trail
      await logAction(
        "Payment Processed (CRM)",
        `Recorded full settlement for Invoice #${payingInvoice.number} from client '${payingInvoice.clientName}'. Generated Receipt #${receiptPayload.number}`,
        activeBusinessId,
        payingInvoice.total
      );

      addToast(`Payment recorded! Official Receipt #${receiptPayload.number} generated.`, "success");
      setIsPaymentModalOpen(false);
      setPayingInvoice(null);
      fetchCRMData(true);
    } catch (err: any) {
      console.error("Error recording payment:", err);
      addToast(err?.message || "Failed to process payment", "error");
    } finally {
      setSubmittingDoc(false);
    }
  };

  // Convert Quotation to Invoice directly
  const handleConvertQuoteToInvoice = async (quote: ClientQuotation) => {
    if (!quote.id || !activeBusinessId) return;
    const user = auth.currentUser;
    const generatedInvNum = `INV-${quote.number.replace("QT-", "")}`;

    const invoicePayload: ClientInvoice = {
      number: generatedInvNum,
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientAddress: quote.clientAddress,
      date: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      items: quote.items,
      total: quote.total,
      status: "unpaid",
      approvalStatus: "approved",
      department: "sales"
    };

    try {
      await addDoc(collection(db, "companies", activeBusinessId, "invoices"), {
        ...invoicePayload,
        ownerId: user?.uid || activeBusinessId
      });

      await updateDoc(doc(db, "companies", activeBusinessId, "quotations", quote.id), {
        invoiceReference: generatedInvNum
      });

      await logAction(
        "Quotation Converted",
        `Converted quotation #${quote.number} to corporate invoice #${generatedInvNum} for ${quote.clientName}`,
        activeBusinessId,
        quote.total
      );

      addToast(`Converted Quote #${quote.number} to Invoice #${generatedInvNum}!`, "success");
      fetchCRMData(true);
    } catch (err: any) {
      console.error("Error converting quotation:", err);
      addToast(err?.message || "Failed to convert quotation", "error");
    }
  };

  // Filtered customers
  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q));
    const matchesStatus = statusFilter === "All" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Selected customer specific documents
  const selectedClientDocs = useMemo(() => {
    if (!selectedCustomer) return { quots: [], invs: [], recs: [] };
    const cName = selectedCustomer.name.toLowerCase().trim();
    const cComp = selectedCustomer.company.toLowerCase().trim();
    const cEmail = selectedCustomer.email.toLowerCase().trim();

    const match = (itemClientName?: string, itemClientEmail?: string) => {
      const iName = (itemClientName || "").toLowerCase().trim();
      const iEmail = (itemClientEmail || "").toLowerCase().trim();
      if (cEmail && iEmail && cEmail === iEmail) return true;
      if (cName && iName && (iName.includes(cName) || cName.includes(iName))) return true;
      if (cComp && iName && (iName.includes(cComp) || cComp.includes(iName))) return true;
      return false;
    };

    return {
      quots: quotations.filter((q) => match(q.clientName, q.clientEmail)),
      invs: invoices.filter((i) => match(i.clientName, i.clientEmail)),
      recs: receipts.filter((r) => match(r.clientName, r.clientEmail))
    };
  }, [selectedCustomer, quotations, invoices, receipts]);

  // Overall KPI aggregates
  const totalCRMValue = Array.from(customerFinancials.values()).reduce((sum, f) => sum + f.totalInvoiced, 0);
  const totalSettled = Array.from(customerFinancials.values()).reduce((sum, f) => sum + f.totalPaid, 0);
  const totalPendingBalance = Array.from(customerFinancials.values()).reduce((sum, f) => sum + f.unpaidBalance, 0);

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 font-sans overflow-x-hidden">
      {/* Top Header & Overview Bar */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-150 shrink-0">
              <Briefcase className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
              Sales CRM Hub
            </span>
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
              Position: {currentUser?.position || currentUser?.role || "Sales Specialist"}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            Commercial Client Directory & Sales CRM
          </h1>
          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-2xl">
            Embed quotations, billing invoices, and payment receipts directly into client account lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={() => fetchCRMData()}
            disabled={refreshing}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition cursor-pointer"
            title="Refresh CRM Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
          </button>
          <button
            onClick={() => {
              resetCustomerForm();
              setIsCustomerModalOpen(true);
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Register Client
          </button>
        </div>
      </div>

      {/* Financial KPI Dashboard Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs space-y-1 min-w-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total CRM Accounts</span>
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-mono text-xl font-black text-slate-900">{customers.length}</span>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              {customers.filter((c) => c.status === "Active").length} Active
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate">Directory entities</span>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs space-y-1 min-w-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed (Invoices)</span>
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-mono text-xl font-black text-slate-900">
              E{totalCRMValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate">{invoices.length} invoices issued</span>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs space-y-1 min-w-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Settled (Paid)</span>
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-mono text-xl font-black text-emerald-600">
              E{totalSettled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              {receipts.length} Receipts
            </span>
          </div>
          <span className="text-[10px] text-emerald-600/80 block truncate">Collected revenues</span>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs space-y-1 min-w-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Outstanding Balance</span>
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-mono text-xl font-black text-amber-600">
              E{totalPendingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
              Unpaid
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate">Active receivables</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5 min-w-0">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search client name, corporate entity, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
          {["All", "Active", "Inactive"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-bold rounded-lg border transition cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Customers CRM Table */}
      {loading ? (
        <div className="p-10 text-center text-slate-400 text-xs font-bold uppercase tracking-wider bg-white rounded-xl border border-slate-200 animate-pulse">
          Loading client matrix & CRM records...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-10 bg-white rounded-xl border border-slate-200 text-center space-y-2">
          <User className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Customers Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search
              ? "No client profiles matched your search terms."
              : "Register your first enterprise client to begin managing quotations, invoices, and receipts."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Client / Organization</th>
                  <th className="py-3 px-3">Contact Coordinates</th>
                  <th className="py-3 px-3 text-right">Invoiced Total</th>
                  <th className="py-3 px-3 text-right">Paid / Balance</th>
                  <th className="py-3 px-3 text-center">Docs Status</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">CRM Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {filteredCustomers.map((cust) => {
                  const fin = customerFinancials.get(cust.id) || {
                    totalQuoted: 0,
                    totalInvoiced: 0,
                    totalPaid: 0,
                    unpaidBalance: 0,
                    quotationCount: 0,
                    invoiceCount: 0,
                    receiptCount: 0
                  };

                  return (
                    <tr
                      key={cust.id}
                      className="hover:bg-blue-50/30 transition group cursor-pointer"
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setActiveProfileTab("overview");
                      }}
                    >
                      {/* Name & Org */}
                      <td className="py-3 px-4 min-w-[180px]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs shrink-0">
                            {cust.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition block truncate">
                              {cust.name}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate flex items-center gap-1">
                              <Building className="w-3 h-3 shrink-0" />
                              {cust.company}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-3 min-w-[160px]">
                        <span className="text-slate-700 font-mono text-[11px] block truncate">{cust.email}</span>
                        <span className="text-[10px] text-slate-400 font-mono block">{cust.phone || "No phone listed"}</span>
                      </td>

                      {/* Invoiced Total */}
                      <td className="py-3 px-3 text-right min-w-[110px]">
                        <span className="font-mono font-black text-slate-900 block">
                          E{fin.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono block">
                          {fin.invoiceCount} Invoices
                        </span>
                      </td>

                      {/* Paid & Balance */}
                      <td className="py-3 px-3 text-right min-w-[120px]">
                        <span className="font-mono font-bold text-emerald-600 block">
                          E{fin.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} Paid
                        </span>
                        {fin.unpaidBalance > 0 ? (
                          <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1 rounded inline-block">
                            E{fin.unpaidBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} Due
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono text-slate-400 block">Settled in full</span>
                        )}
                      </td>

                      {/* Document count chips */}
                      <td className="py-3 px-3 text-center min-w-[130px]">
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className="px-1.5 py-0.5 bg-blue-50 border border-blue-150 text-blue-700 rounded text-[10px] font-bold"
                            title="Active Quotations"
                          >
                            {fin.quotationCount} QT
                          </span>
                          <span
                            className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-150 text-emerald-700 rounded text-[10px] font-bold"
                            title="Invoices Billed"
                          >
                            {fin.invoiceCount} INV
                          </span>
                          <span
                            className="px-1.5 py-0.5 bg-purple-50 border border-purple-150 text-purple-700 rounded text-[10px] font-bold"
                            title="Receipts Issued"
                          >
                            {fin.receiptCount} REC
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            cust.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {cust.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-right space-x-1 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => openNewQuotation(cust)}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded border border-blue-200 transition cursor-pointer"
                          title="Create Quotation for Client"
                        >
                          + Quote
                        </button>
                        <button
                          type="button"
                          onClick={() => openNewInvoice(cust)}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200 transition cursor-pointer"
                          title="Issue Invoice to Client"
                        >
                          + Invoice
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditCustomer(cust)}
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer inline-flex"
                          title="Edit Customer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomer(cust)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer inline-flex"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 360° Commercial Profile Modal / Slide-over */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                  {selectedCustomer.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                      {selectedCustomer.name}
                    </h2>
                    <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold rounded-full">
                      {selectedCustomer.company}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        selectedCustomer.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {selectedCustomer.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {selectedCustomer.email} &bull; {selectedCustomer.phone || "No phone"} &bull;{" "}
                    {selectedCustomer.address || "No registered address"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openNewQuotation(selectedCustomer)}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Quote
                </button>
                <button
                  type="button"
                  onClick={() => openNewInvoice(selectedCustomer)}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => setActiveProfileTab("overview")}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                  activeProfileTab === "overview"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                Overview & Financials
              </button>
              <button
                type="button"
                onClick={() => setActiveProfileTab("quotations")}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeProfileTab === "quotations"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Quotations ({selectedClientDocs.quots.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveProfileTab("invoices")}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeProfileTab === "invoices"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <Receipt className="w-3.5 h-3.5" /> Invoices ({selectedClientDocs.invs.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveProfileTab("receipts")}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeProfileTab === "receipts"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <Coins className="w-3.5 h-3.5" /> Receipts ({selectedClientDocs.recs.length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {/* Tab 1: Overview */}
              {activeProfileTab === "overview" && (
                <div className="space-y-4">
                  {/* Financial Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Quoted</span>
                      <span className="font-mono text-base font-black text-slate-900 block">
                        E
                        {selectedClientDocs.quots
                          .reduce((acc, q) => acc + (Number(q.total) || 0), 0)
                          .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-500 block">{selectedClientDocs.quots.length} quotes</span>
                    </div>

                    <div className="p-3 bg-blue-50/50 border border-blue-150 rounded-xl space-y-1">
                      <span className="text-[9px] font-bold text-blue-500 uppercase block">Total Invoiced</span>
                      <span className="font-mono text-base font-black text-blue-900 block">
                        E
                        {selectedClientDocs.invs
                          .reduce((acc, i) => acc + (Number(i.total) || 0), 0)
                          .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-blue-600/80 block">{selectedClientDocs.invs.length} invoices</span>
                    </div>

                    <div className="p-3 bg-emerald-50/50 border border-emerald-150 rounded-xl space-y-1">
                      <span className="text-[9px] font-bold text-emerald-600 uppercase block">Total Paid</span>
                      <span className="font-mono text-base font-black text-emerald-700 block">
                        E
                        {selectedClientDocs.invs
                          .filter((i) => i.status === "paid")
                          .reduce((acc, i) => acc + (Number(i.total) || 0), 0)
                          .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-emerald-700 block">{selectedClientDocs.recs.length} receipts</span>
                    </div>

                    <div className="p-3 bg-amber-50/50 border border-amber-150 rounded-xl space-y-1">
                      <span className="text-[9px] font-bold text-amber-700 uppercase block">Pending Balance</span>
                      <span className="font-mono text-base font-black text-amber-900 block">
                        E
                        {selectedClientDocs.invs
                          .filter((i) => i.status === "unpaid")
                          .reduce((acc, i) => acc + (Number(i.total) || 0), 0)
                          .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-amber-800 block">Due from client</span>
                    </div>
                  </div>

                  {/* Profile Metadata */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Account Notes & Info</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {selectedCustomer.notes || "No special account instructions logged for this customer."}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Address</span>
                        <span className="font-medium text-slate-800">{selectedCustomer.address || "None"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Email</span>
                        <span className="font-mono text-slate-800">{selectedCustomer.email}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Phone</span>
                        <span className="font-mono text-slate-800">{selectedCustomer.phone || "None"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Banner */}
                  <div className="p-3.5 bg-indigo-50/60 border border-indigo-150 rounded-xl flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-indigo-950">Next Sales Action</h4>
                      <p className="text-[11px] text-indigo-700">Issue a new proposal quote or directly draft a billing invoice.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openNewQuotation(selectedCustomer)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                      >
                        + Create Quote
                      </button>
                      <button
                        type="button"
                        onClick={() => openNewInvoice(selectedCustomer)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                      >
                        + Issue Invoice
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Quotations */}
              {activeProfileTab === "quotations" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Quotations Log ({selectedClientDocs.quots.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => openNewQuotation(selectedCustomer)}
                      className="px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
                    >
                      + New Quotation
                    </button>
                  </div>

                  {selectedClientDocs.quots.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400">
                      No quotations have been drafted for this client yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedClientDocs.quots.map((q, idx) => (
                        <div
                          key={q.id || idx}
                          className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-slate-300 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-slate-900">{q.number}</span>
                              <span
                                className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                                  q.approvalStatus === "approved"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : q.approvalStatus === "rejected"
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : q.approvalStatus === "draft"
                                    ? "bg-slate-100 text-slate-700 border border-slate-300"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {q.approvalStatus || q.status}
                              </span>
                              {q.invoiceReference && (
                                <span className="text-[9px] font-bold font-mono bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                                  Billed: {q.invoiceReference}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Issued: {q.date} &bull; Valid Until: {q.validUntil} &bull; {q.items?.length || 1} rows
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3">
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 uppercase font-bold block">Quotation Value</span>
                              <span className="font-mono font-black text-sm text-slate-900">
                                E{Number(q.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            {q.approvalStatus === "approved" && !q.invoiceReference && (
                              <button
                                type="button"
                                onClick={() => handleConvertQuoteToInvoice(q)}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-lg transition"
                                title="Convert to Official Corporate Invoice"
                              >
                                Bill Invoice
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Invoices */}
              {activeProfileTab === "invoices" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Invoices & Billing ({selectedClientDocs.invs.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => openNewInvoice(selectedCustomer)}
                      className="px-2.5 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition"
                    >
                      + Issue Invoice
                    </button>
                  </div>

                  {selectedClientDocs.invs.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400">
                      No invoices have been billed to this client yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedClientDocs.invs.map((inv, idx) => (
                        <div
                          key={inv.id || idx}
                          className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-slate-300 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-slate-900">{inv.number}</span>
                              <span
                                className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                                  inv.status === "paid"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {inv.status === "paid" ? "Settled / Paid" : "Unpaid Balance"}
                              </span>
                              {inv.approvalStatus && inv.approvalStatus !== "approved" && (
                                <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  {inv.approvalStatus}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Billed: {inv.date} &bull; Due Date: {inv.dueDate} &bull; {inv.items?.length || 1} rows
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3">
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 uppercase font-bold block">Invoice Amount</span>
                              <span className="font-mono font-black text-sm text-slate-900">
                                E{Number(inv.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            {inv.status === "unpaid" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPayingInvoice(inv);
                                  setIsPaymentModalOpen(true);
                                }}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                              >
                                Record Payment
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Receipts */}
              {activeProfileTab === "receipts" && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Official Receipts & Remittances ({selectedClientDocs.recs.length})
                  </h3>

                  {selectedClientDocs.recs.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400">
                      No payment receipts have been issued for this client yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedClientDocs.recs.map((rec, idx) => (
                        <div
                          key={rec.id || idx}
                          className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-slate-300 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-emerald-800">{rec.number}</span>
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold rounded-full">
                                Completed
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                Ref: {rec.invoiceNumber}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Payment Date: {rec.date} &bull; Method: <strong>{rec.paymentMethod}</strong>
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Settled Amount</span>
                            <span className="font-mono font-black text-sm text-emerald-700">
                              E{Number(rec.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold"
              >
                Close CRM View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Registration & Edit Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-blue-950 uppercase tracking-wide">
                {editingCust ? "Edit Customer Record" : "Register Direct Partner / Client"}
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Contact Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Johnathan Smith"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Client Status
                  </label>
                  <select
                    value={custStatus}
                    onChange={(e) => setCustStatus(e.target.value as "Active" | "Inactive")}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                  >
                    <option value="Active">Active Account</option>
                    <option value="Inactive">Inactive / Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Associated Corporate Organization
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Global Logistics (or leave blank if individual)"
                  value={custCompany}
                  onChange={(e) => setCustCompany(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="client@company.com"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+268 7600 0000"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Physical / Billing Address
                </label>
                <input
                  type="text"
                  placeholder="Plot 42, Industrial Site, Matsapha"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Account Notes / Special Terms
                </label>
                <textarea
                  rows={2}
                  placeholder="Special discounts, billing preferences, credit terms..."
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs"
                >
                  {editingCust ? "Save Changes" : "Register Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-CRM Quotation Modal */}
      {isQuotationModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-blue-950 uppercase tracking-wide">
                  Draft Quotation for {selectedCustomer.name}
                </h3>
                <span className="text-[11px] text-blue-700">Company: {selectedCustomer.company}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsQuotationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Quote #</label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    className="w-full px-3 py-1.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date Issued</label>
                  <input
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={docDueDate}
                    onChange={(e) => setDocDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Line Items</span>
                  <button
                    type="button"
                    onClick={() => setDocItems((prev) => [...prev, { description: "", quantity: 1, price: 0 }])}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {docItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        placeholder="Description / Product or service..."
                        value={item.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDocItems((prev) => prev.map((it, i) => (i === idx ? { ...it, description: val } : it)));
                        }}
                        className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded"
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDocItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it)));
                        }}
                        className="w-16 px-2 py-1 text-xs bg-white border border-slate-200 rounded font-mono text-center"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Price (E)"
                        value={item.price}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDocItems((prev) => prev.map((it, i) => (i === idx ? { ...it, price: val } : it)));
                        }}
                        className="w-24 px-2 py-1 text-xs bg-white border border-slate-200 rounded font-mono text-right"
                      />
                      <span className="w-20 text-right font-mono font-bold text-xs text-slate-800">
                        E{((Number(item.quantity) || 1) * (Number(item.price) || 0)).toFixed(2)}
                      </span>
                      {docItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDocItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase">Quotation Grand Total:</span>
                <span className="font-mono text-lg font-black text-blue-900">
                  E
                  {docItems
                    .reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.price) || 0), 0)
                    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuotationModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={submittingDoc}
                    onClick={() => handleSaveQuotation(true)}
                    className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Draft
                  </button>
                  <button
                    type="button"
                    disabled={submittingDoc}
                    onClick={() => handleSaveQuotation(false)}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" /> Submit for Approval
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-CRM Invoice Modal */}
      {isInvoiceModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                  Issue Invoice to {selectedCustomer.name}
                </h3>
                <span className="text-[11px] text-emerald-700">Company: {selectedCustomer.company}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice #</label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    className="w-full px-3 py-1.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    value={docDueDate}
                    onChange={(e) => setDocDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deliverable Rows</span>
                  <button
                    type="button"
                    onClick={() => setDocItems((prev) => [...prev, { description: "", quantity: 1, price: 0 }])}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {docItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        placeholder="Description / Product or service billed..."
                        value={item.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDocItems((prev) => prev.map((it, i) => (i === idx ? { ...it, description: val } : it)));
                        }}
                        className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded"
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDocItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it)));
                        }}
                        className="w-16 px-2 py-1 text-xs bg-white border border-slate-200 rounded font-mono text-center"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Price (E)"
                        value={item.price}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDocItems((prev) => prev.map((it, i) => (i === idx ? { ...it, price: val } : it)));
                        }}
                        className="w-24 px-2 py-1 text-xs bg-white border border-slate-200 rounded font-mono text-right"
                      />
                      <span className="w-20 text-right font-mono font-bold text-xs text-slate-800">
                        E{((Number(item.quantity) || 1) * (Number(item.price) || 0)).toFixed(2)}
                      </span>
                      {docItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDocItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase">Invoice Payable Total:</span>
                <span className="font-mono text-lg font-black text-emerald-800">
                  E
                  {docItems
                    .reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.price) || 0), 0)
                    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={submittingDoc}
                    onClick={() => handleSaveInvoice(true)}
                    className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Draft
                  </button>
                  <button
                    type="button"
                    disabled={submittingDoc}
                    onClick={() => handleSaveInvoice(false)}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" /> Issue & Submit Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Processing & Receipt Generation Modal */}
      {isPaymentModalOpen && payingInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                  Record Payment for Invoice {payingInvoice.number}
                </h3>
                <span className="text-[11px] text-emerald-700">Client: {payingInvoice.clientName}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setPayingInvoice(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Total Settlement Amount</span>
                <span className="font-mono text-2xl font-black text-slate-900 block">
                  E{Number(payingInvoice.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                >
                  <option value="EFT Bank Transfer">EFT Bank Transfer</option>
                  <option value="Cash Remittance">Cash Remittance</option>
                  <option value="POS / Credit Card">POS / Credit Card</option>
                  <option value="Mobile Money (MoMo / e-Mali)">Mobile Money (MoMo / e-Mali)</option>
                  <option value="Corporate Cheque">Corporate Cheque</option>
                </select>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-150 text-[11px] text-emerald-800 leading-relaxed">
                Recording this payment will immediately update Invoice #{payingInvoice.number} to <strong>PAID</strong>,
                generate official <strong>Receipt #REC-{payingInvoice.number.replace("INV-", "")}</strong>, and update client lifetime receivables.
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPaymentModalOpen(false);
                    setPayingInvoice(null);
                  }}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingDoc}
                  onClick={handleRecordPayment}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" /> Confirm Settlement & Issue Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

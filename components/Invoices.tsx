"use client";

import { useState, useEffect, useRef } from "react";
import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc, query, orderBy, getDoc, where } from "firebase/firestore";
import { db, auth as importAuth, handleFirestoreError, OperationType, isOfflineError } from "../lib/firebase";
import { useUserStore, useToastStore } from "../lib/store";
import { logAction } from "../lib/audit";
import { uploadToDrive } from "../lib/drive";
import { FileText, Plus, Search, Trash, Edit, Download, Loader2, Eye, X, Check, Wallet, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import safeHtml2Canvas from "../lib/safeHtml2canvas";
import * as XLSX from "xlsx";
import LoadingSkeleton from "./LoadingSkeleton";

interface Item {
  description: string;
  quantity: number;
  price: number;
}

interface Invoice {
  id?: string;
  ownerId: string;
  number: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  date: string;
  dueDate: string;
  items: Item[];
  total: number;
  status: "unpaid" | "paid" | "overdue";
  driveFileId?: string;
}

interface CompanyDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  letterheadLogo: string;
}

interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  totalBilling: number;
  status: "Active" | "Inactive";
}

export default function Invoices() {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);
  
  // Local auth shadowing to redirect all queries to the correct shared company workspace
  const auth = {
    ...importAuth,
    get currentUser() {
      const liveUser = importAuth.currentUser;
      if (!liveUser) return null;
      const companyId = currentUser?.companyId || currentUser?.businessId || liveUser.uid;
      return {
        ...liveUser,
        uid: companyId,
        getIdToken: (forceRefresh?: boolean) => liveUser.getIdToken(forceRefresh),
        getIdTokenResult: (forceRefresh?: boolean) => liveUser.getIdTokenResult(forceRefresh),
      } as any;
    }
  };

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [clients, setClients] = useState<Customer[]>([]);

  // Form Fields
  const [isOpen, setIsOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [date, setDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, price: 0 }]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const generateNextInvoiceNumber = () => {
    let nextNum = "INV-1001";
    if (invoices && invoices.length > 0) {
      let maxNum = 0;
      let prefix = "INV-";
      let padLength = 0;
      
      for (const inv of invoices) {
        const numStr = inv.number;
        if (!numStr) continue;
        const match = numStr.match(/\d+/);
        if (match) {
          const val = parseInt(match[0], 10);
          if (val > maxNum) {
            maxNum = val;
            const idx = numStr.indexOf(match[0]);
            prefix = numStr.substring(0, idx);
            if (match[0].startsWith("0") && match[0].length > 1) {
              padLength = match[0].length;
            } else {
              padLength = 0;
            }
          }
        }
      }
      if (maxNum > 0) {
        const incremented = maxNum + 1;
        const numPart = padLength > 0 ? String(incremented).padStart(padLength, "0") : String(incremented);
        nextNum = `${prefix}${numPart}`;
      }
    }
    return nextNum;
  };

  const handleOpenCreateInvoice = () => {
    const nextNum = generateNextInvoiceNumber();
    setNumber(nextNum);
    
    // Set default dates
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 14); // 14 days default payment terms
    setDueDate(nextWeek.toISOString().split("T")[0]);
    
    setIsOpen(true);
  };

  // Payment Recording Modal
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");

  // Preview & Export Modal
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const pdfAreaRef = useRef<HTMLDivElement>(null);

  const fetchInvoicesAndCompany = async () => {
    const user = auth.currentUser;
    if (!user || !currentUser) return;

    setLoading(true);
    const businessId = currentUser?.companyId || currentUser?.businessId || user.uid;
    const invoicesPath = `companies/${businessId}/invoices`;
    try {
      // Fetch settings
      const compSnap = await getDoc(doc(db, "companies", businessId));
      if (compSnap.exists()) {
        const compData = compSnap.data() as CompanyDetails;
        setCompany(compData);
        localStorage.setItem(`miratech_offline_company_${businessId}`, JSON.stringify(compData));
      } else {
        const cachedCompany = localStorage.getItem(`miratech_offline_company_${businessId}`);
        if (cachedCompany) setCompany(JSON.parse(cachedCompany));
      }

      // Fetch invoices
      const iRef = collection(db, "companies", businessId, "invoices");
      const querySnap = await getDocs(query(iRef, orderBy("number", "desc")));
      const itemsList: Invoice[] = [];
      querySnap.forEach((docSnap) => {
        itemsList.push({ id: docSnap.id, ...docSnap.data() } as Invoice);
      });
      setInvoices(itemsList);
      localStorage.setItem(`miratech_offline_invoices_${businessId}`, JSON.stringify(itemsList));
      
      // Load clients from Firestore collection 'customers' filtered by businessId
      try {
        const qCustomers = query(collection(db, "customers"), where("businessId", "==", businessId));
        const customerSnap = await getDocs(qCustomers);
        const customersList: Customer[] = [];
        customerSnap.forEach((dSnap) => {
          customersList.push({ id: dSnap.id, ...dSnap.data() } as Customer);
        });
        setClients(customersList);
        localStorage.setItem(`miratech_customers_${user.uid}`, JSON.stringify(customersList));
      } catch (custErr) {
        console.warn("Failed to fetch customers from Firestore, relying on cache.", custErr);
        const cacheKey = user ? `miratech_customers_${user.uid}` : "miratech_customers_guest";
        const cachedClients = localStorage.getItem(cacheKey);
        if (cachedClients) setClients(JSON.parse(cachedClients));
      }
    } catch (err) {
      if (isOfflineError(err)) {
        console.warn("[Invoices Offline Fallback] Loading data from local cache.");
        const cachedCompany = localStorage.getItem(`miratech_offline_company_${user.uid}`);
        if (cachedCompany) setCompany(JSON.parse(cachedCompany));
        const cachedInvs = localStorage.getItem(`miratech_offline_invoices_${user.uid}`);
        if (cachedInvs) {
          setInvoices(JSON.parse(cachedInvs));
        } else {
          setInvoices([]);
        }
        const user = auth.currentUser;
        const cacheKey = user ? `miratech_customers_${user.uid}` : "miratech_customers_guest";
        const cachedClients = localStorage.getItem(cacheKey);
        if (cachedClients) setClients(JSON.parse(cachedClients));
      } else {
        handleFirestoreError(err, OperationType.GET, invoicesPath);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoicesAndCompany();
  }, [currentUser]);

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clients.find((c) => c.id === clientId);
    if (selectedClient) {
      setClientName(selectedClient.name);
      setClientEmail(selectedClient.email);
      setClientAddress(selectedClient.address);
    } else {
      setClientName("");
      setClientEmail("");
      setClientAddress("");
    }
  };

  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: 1, price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof Item, value: string | number) => {
    const next = [...items];
    if (field === "description") {
      next[index].description = String(value);
    } else {
      next[index][field] = Number(value);
    }
    setItems(next);
  };

  const calculateTotal = () => {
    return items.reduce((acc, current) => acc + current.quantity * current.price, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setSubmitting(true);
    const total = calculateTotal();

    const payload: Invoice = {
      ownerId: user.uid,
      number,
      clientName,
      clientEmail,
      clientAddress,
      date,
      dueDate,
      items,
      total,
      status: "unpaid",
    };

    const invoicesPath = `companies/${user.uid}/invoices`;
    try {
      let newId = "offline-" + Date.now();
      try {
        const colRef = collection(db, "companies", user.uid, "invoices");
        const addedDoc = await addDoc(colRef, payload);
        newId = addedDoc.id;

        // Log database audit trail
        await logAction(
          "Invoice Created",
          `Billed invoice #${payload.number} to client '${payload.clientName}'. Total amount: E${payload.total}`,
          user.uid,
          payload.total
        );
      } catch (err) {
        if (!isOfflineError(err)) throw err;
        console.warn("[Invoices Offline Submit] Saving invoice locally to local storage.");
      }

      // Local storage cache update
      const cachedInvs = localStorage.getItem(`miratech_offline_invoices_${user.uid}`);
      const invsList: Invoice[] = cachedInvs ? JSON.parse(cachedInvs) : [];
      invsList.unshift({ id: newId, ...payload });
      localStorage.setItem(`miratech_offline_invoices_${user.uid}`, JSON.stringify(invsList));

      setIsOpen(false);
      // Reset State
      setNumber("");
      setClientName("");
      setClientEmail("");
      setClientAddress("");
      setDate("");
      setDueDate("");
      setItems([{ description: "", quantity: 1, price: 0 }]);
      addToast(`Invoice #${payload.number} Saved successfully`, "success");
      fetchInvoicesAndCompany();
    } catch (err) {
      addToast(`System Error: Failed to save invoice. Reason: ${err instanceof Error ? err.message : String(err)}`, "error");
      handleFirestoreError(err, OperationType.CREATE, invoicesPath);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!payingInvoice) return;
    const user = auth.currentUser;
    if (!user) return;

    const invoicePath = `companies/${user.uid}/invoices/${payingInvoice.id}`;
    const receiptsPath = `companies/${user.uid}/receipts`;
    let isOffline = false;

    // Receipt payload
    const receiptPayload = {
      ownerId: user.uid,
      number: `REC-${payingInvoice.number.replace("INV-", "")}`,
      invoiceNumber: payingInvoice.number,
      clientName: payingInvoice.clientName,
      clientEmail: payingInvoice.clientEmail,
      paymentMethod,
      date: new Date().toISOString().split("T")[0],
      amount: payingInvoice.total,
      status: "completed",
    };

    try {
      // 1. Update status to paid
      await updateDoc(doc(db, "companies", user.uid, "invoices", payingInvoice.id!), {
        status: "paid",
      });

      // 2. Automatically generate Receipt
      const recColRef = collection(db, "companies", user.uid, "receipts");
      await addDoc(recColRef, receiptPayload);

      // Log database audit trail
      await logAction(
        "Payment Processed",
        `Acquired full payment for invoice #${payingInvoice.number}. Generated official receipt #${receiptPayload.number} automatically.`,
        user.uid,
        payingInvoice.total
      );
    } catch (err) {
      if (!isOfflineError(err)) {
        handleFirestoreError(err, OperationType.WRITE, receiptsPath);
        return;
      }
      isOffline = true;
      console.warn("[Invoices Offline Record Payment] Recording payment and receipt locally.");
    }

    // 1. Reflect payment in local cache of invoices
    const cachedInvs = localStorage.getItem(`miratech_offline_invoices_${user.uid}`);
    if (cachedInvs) {
      const invsList: Invoice[] = JSON.parse(cachedInvs);
      const updatedList = invsList.map((i) => (i.id === payingInvoice.id ? { ...i, status: "paid" as const } : i));
      localStorage.setItem(`miratech_offline_invoices_${user.uid}`, JSON.stringify(updatedList));
      if (isOffline) {
        setInvoices(updatedList);
      }
    }

    // 2. Reflect receipt in local cache of receipts
    const cachedRecs = localStorage.getItem(`miratech_offline_receipts_${user.uid}`);
    const recsList = cachedRecs ? JSON.parse(cachedRecs) : [];
    recsList.unshift({ id: "offline-rec-" + Date.now(), ...receiptPayload });
    localStorage.setItem(`miratech_offline_receipts_${user.uid}`, JSON.stringify(recsList));

    addToast(`Payment recorded, Receipt #${receiptPayload.number} created successfully`, "success");
    setPayingInvoice(null);
    if (!isOffline) {
      fetchInvoicesAndCompany();
    }
  };

  const handleDelete = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const invoicePath = `companies/${user.uid}/invoices/${id}`;
    let isOffline = false;
    try {
      await deleteDoc(doc(db, "companies", user.uid, "invoices", id));

      // Log database audit trail
      await logAction(
        "Invoice Abolished",
        `Permanently extinguished user invoice ID: ${id}`,
        user.uid
      );
    } catch (err) {
      if (!isOfflineError(err)) {
        handleFirestoreError(err, OperationType.DELETE, invoicePath);
        return;
      }
      isOffline = true;
      console.warn("[Invoices Offline Delete] Deleting invoice locally.");
    }

    // Reflect deletion in local cache of invoices
    const cachedInvs = localStorage.getItem(`miratech_offline_invoices_${user.uid}`);
    if (cachedInvs) {
      const invsList: Invoice[] = JSON.parse(cachedInvs);
      const updatedList = invsList.filter((i) => i.id !== id);
      localStorage.setItem(`miratech_offline_invoices_${user.uid}`, JSON.stringify(updatedList));
      if (isOffline) {
        setInvoices(updatedList);
      }
    }

    addToast("Invoice deleted successfully", "warning");
    if (!isOffline) {
      fetchInvoicesAndCompany();
    }
  };

  const exportInvoicesToExcel = () => {
    const data = invoices.flatMap(inv => 
      inv.items.map(item => ({
        "Invoice No.": inv.number,
        "Date": inv.date,
        "Customer": inv.clientName,
        "Item": item.description,
        "Quantity": item.quantity,
        "Unit Price": item.price,
        "Line Total": item.quantity * item.price,
        "Invoice Total": inv.total,
        "Status": inv.status
      }))
    );

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");
    XLSX.writeFile(workbook, "All_Invoices.xlsx");
    addToast("Export Complete: All_Invoices.xlsx downloaded", "success");
  };

  const handleExportPDF = async () => {
    if (!pdfAreaRef.current || !previewInvoice) return;

    try {
      const element = pdfAreaRef.current;
      const canvas = await safeHtml2Canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210; // A4 dimensions
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
      
      const pdfBlob = pdf.output('blob');
      const fileName = `Invoice_${previewInvoice.number}.pdf`;
      
      // Save PDF locally first to ensure of physical download success
      pdf.save(fileName);
      addToast(`Export Complete: Saved PDF ${fileName}`, "success");

      // Attempt background Google Drive backup gracefully
      try {
        const fileId = await uploadToDrive(pdfBlob, fileName);
        const user = auth.currentUser;
        if (user && previewInvoice.id) {
          await updateDoc(doc(db, "companies", user.uid, "invoices", previewInvoice.id), {
            driveFileId: fileId
          });
          fetchInvoicesAndCompany();
          addToast("Invoice backed up to Google Drive successfully!", "info");
        }
      } catch (driveErr: any) {
        console.warn("Google Drive skip/backup failed:", driveErr.message);
      }
    } catch (err) {
      console.error("PDF printing failed:", err);
      addToast(`System Error: PDF generation failed. Reason: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.clientName.toLowerCase().includes(search.toLowerCase()) ||
      inv.number.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" ? true : inv.status === filter;
    
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && inv.date >= startDate;
    }
    if (endDate) {
      matchesDate = matchesDate && inv.date <= endDate;
    }
    return matchesSearch && matchesFilter && matchesDate;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Invoices Directory</h1>
          <p className="text-[11px] text-slate-550">Collect corporate revenue and bill clients.</p>
        </div>
        {!company ? (
          <div className="text-[11px] bg-amber-50 text-amber-700 p-2 py-1.5 rounded-md border border-amber-100/50 max-w-sm">
            Please fill in your <strong>Company Profile</strong> tab before creating documents to populate the corporate letterhead details!
          </div>
        ) : (
          <div className="flex gap-2">
            <button
               onClick={exportInvoicesToExcel}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-xs font-bold cursor-pointer shadow-3xs transition"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
            </button>
            <button
              onClick={handleOpenCreateInvoice}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-bold cursor-pointer shadow-3xs transition"
            >
              <Plus className="h-3.5 w-3.5" /> Create Invoice
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row gap-2 items-center">
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-450">
            <Search className="h-3.5 w-3.5 text-slate-405" />
          </span>
          <input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden"
          />
        </div>
        <div className="flex gap-1.5 self-start md:self-auto overflow-x-auto w-full md:w-auto">
          {["all", "unpaid", "paid", "overdue"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-2.5 py-1 border rounded-md text-[11px] font-bold cursor-pointer transition capitalize ${
                filter === tab
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 w-full md:w-auto self-start md:self-auto bg-slate-50/50 p-1 px-2 border border-slate-200 rounded-md">
          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider whitespace-nowrap">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-1.5 py-0.5 border border-slate-200 rounded-md text-[10px] bg-white focus:outline-hidden font-medium"
          />
          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider whitespace-nowrap">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-1.5 py-0.5 border border-slate-200 rounded-md text-[10px] bg-white focus:outline-hidden font-medium"
          />
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="text-[10px] font-extrabold text-blue-600 hover:text-blue-800 uppercase ml-1 cursor-pointer transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-4">
          <LoadingSkeleton />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="border border-dashed border-slate-250 rounded-lg p-6 text-center text-slate-400">
          <FileText className="h-8 w-8 mx-auto text-slate-305 mb-1.5" />
          <p className="text-xs font-extrabold text-slate-700">No invoices found</p>
          <p className="text-[10px] text-slate-450 mt-0.5">Start by clicking the &quot;Create Invoice&quot; button above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-blue-100/70 rounded-lg shadow-3xs">
          <table className="high-density-table w-full text-left border-collapse">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Client</th>
                <th>Due Date</th>
                <th>Billable Total</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">{inv.number}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold">{inv.clientName}</div>
                    <div className="text-[10px] text-slate-400">{inv.clientEmail}</div>
                  </td>
                  <td className="py-3.5 px-4">{inv.dueDate}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">E{inv.total.toLocaleString()}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                        inv.status === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : inv.status === "overdue"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-1">
                    {inv.status === "unpaid" && (
                      <button
                        onClick={() => setPayingInvoice(inv)}
                        title="Record Payment & Issue Receipt"
                        className="p-1 px-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer inline-flex items-center gap-1 text-[10px] font-semibold border border-emerald-200"
                      >
                        <Wallet className="h-3 w-3" /> Pay Invoice
                      </button>
                    )}
                    <button
                      onClick={() => setPreviewInvoice(inv)}
                      title="Preview Ledger Document"
                      className="p-1 text-slate-600 hover:bg-slate-50 rounded-md cursor-pointer inline-flex"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(inv.id!)}
                      title="Remove"
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer inline-flex"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Creation Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-md font-semibold text-slate-800">Issue Corporate Billing Invoice</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Invoice Reference No.
                  </label>
                  <input
                    type="text"
                    required
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                    placeholder="e.g. INV-2026-001"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Select Client
                  </label>
                  <select
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                    onChange={(e) => handleClientSelect(e.target.value)}
                  >
                    <option value="">-- Choose a Saved Client --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} - {c.company}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Client Legal Name
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Client Email
                  </label>
                  <input
                    type="email"
                    required
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                    placeholder="finance@client.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Invoice Issue Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Client billing/shipping address
                </label>
                <textarea
                  required
                  rows={2}
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                  placeholder="Street, City, Post Code, Country"
                />
              </div>

              {/* Items Section */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                  <span className="text-xs font-semibold text-slate-600">Line Items Ledger</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-[10px] font-semibold text-slate-700 underline cursor-pointer"
                  >
                    + Add Item Row
                  </button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <input
                        type="text"
                        required
                        placeholder="Description of deliverables..."
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        placeholder="Price"
                        value={item.price}
                        onChange={(e) => handleItemChange(idx, "price", e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        disabled={items.length === 1}
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-500 hover:text-red-700 disabled:opacity-30 cursor-pointer inline-block"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">Calculated value total</span>
                <span className="text-md font-bold text-slate-800">E{calculateTotal().toLocaleString()}</span>
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-slate-800 text-white font-medium rounded-lg text-xs hover:bg-slate-900 shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Issuing...
                    </>
                  ) : (
                    "Save & Issue Invoice"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Dialog */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Record Client Payment</h3>
              <p className="text-[10px] text-slate-400 mt-1">
                Settles invoice <strong>{payingInvoice.number}</strong> and triggers automated receipt.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Payment Channel Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
              >
                <option value="Bank Transfer">Direct Wire / Bank Transfer</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Corporate Check">Corporate Check</option>
                <option value="Cash">Cash Ledger</option>
              </select>
            </div>

            <div className="flex justify-between items-center text-xs border-y border-slate-100 py-2.5">
              <span className="text-slate-500">Amount Paid:</span>
              <span className="font-bold text-slate-800">E{payingInvoice.total.toLocaleString()}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPayingInvoice(null)}
                className="w-1/2 p-1.5 border border-slate-200 hover:bg-slate-50 text-xs text-slate-600 font-semibold rounded-lg cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={handleRecordPayment}
                className="w-1/2 p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer text-center"
              >
                Paid & Issue Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A4 Invoice Preview Sheet & A4 Print Container */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-4xl w-full">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-sm font-semibold text-slate-800">Review Invoice: {previewInvoice.number}</span>
              <div className="flex gap-2">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-900 border border-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition"
                >
                  <Download className="h-3.5 w-3.5" /> A4 PDF
                </button>
                <button
                  onClick={() => setPreviewInvoice(null)}
                  className="p-1 px-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* A4 Printable Paper Template */}
            <div className="p-6 bg-slate-100 overflow-x-auto max-h-[70vh]">
              <div
                ref={pdfAreaRef}
                style={{ width: "210mm", minHeight: "297mm" }}
                className="mx-auto bg-white p-[20mm] border border-slate-200 shadow-sm relative text-slate-800 font-sans"
              >
                {/* Letterhead Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6">
                  <div>
                    {company?.letterheadLogo ? (
                      <img
                        src={company.letterheadLogo}
                        alt="Corporate Symbol"
                        className="max-h-20 object-contain mb-2"
                      />
                    ) : (
                      <span className="text-lg font-extrabold text-slate-900 tracking-tight uppercase">
                        {company?.name || "Corporate Ledger"}
                      </span>
                    )}
                    <h1 className="text-2xl font-black text-slate-900 tracking-wider">SECURE INVOICE</h1>
                  </div>

                  <div className="text-right text-[11px] text-slate-500 space-y-0.5">
                    <p className="font-bold text-slate-800">{company?.name}</p>
                    <p>{company?.email}</p>
                    <p>{company?.phone}</p>
                    <p className="whitespace-pre-line max-w-[200px]">{company?.address}</p>
                  </div>
                </div>

                {/* Metadata details */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Billing Invoice To:
                    </span>
                    <p className="font-bold text-slate-900">{previewInvoice.clientName}</p>
                    <p className="text-slate-500">{previewInvoice.clientEmail}</p>
                    <p className="text-slate-500 whitespace-pre-line max-w-[250px]">{previewInvoice.clientAddress}</p>
                  </div>

                  <div className="text-right">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Billing Parameters:
                    </span>
                    <p>
                      <strong className="text-slate-900">Invoice Number:</strong> {previewInvoice.number}
                    </p>
                    <p>
                      <strong className="text-slate-900">Issue Date:</strong> {previewInvoice.date}
                    </p>
                    <p>
                      <strong className="text-slate-900">Due Date:</strong> {previewInvoice.dueDate}
                    </p>
                    <p className="mt-1">
                      <strong className="text-slate-900">Status:</strong>{" "}
                      <span className="font-semibold uppercase text-[10px] text-slate-700">{previewInvoice.status}</span>
                    </p>
                  </div>
                </div>

                {/* Ledger Items Table */}
                <table className="w-full text-left border-collapse border border-slate-200 mb-6 text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-semibold uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 px-3 border border-slate-900">Billable Deliverables</th>
                      <th className="py-2.5 px-3 border border-slate-900 text-center w-20">Quantity</th>
                      <th className="py-2.5 px-3 border border-slate-900 text-right w-28">Unit Price</th>
                      <th className="py-2.5 px-3 border border-slate-900 text-right w-28">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previewInvoice.items.map((it, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-3 border border-slate-200 font-medium">{it.description}</td>
                        <td className="py-3 px-3 border border-slate-200 text-center font-mono">{it.quantity}</td>
                        <td className="py-3 px-3 border border-slate-200 text-right font-mono">
                          E{it.price.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 border border-slate-200 text-right font-bold text-slate-900 font-mono">
                          E{(it.quantity * it.price).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summaries */}
                <div className="flex justify-between items-start text-xs">
                  <div className="max-w-[320px] text-slate-500 text-[10px] space-y-1 mt-2">
                    <p className="font-bold text-slate-800">Financial Ledger Notice:</p>
                    <p>1. Please settle within due parameters outlined on this file.</p>
                    <p>2. Payment proofs trigger instant automatic receipt confirmations.</p>
                  </div>

                  <div className="text-right w-64 space-y-1.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono">E{previewInvoice.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t-2 border-slate-900 pt-1.5 font-bold text-slate-900 text-sm">
                      <span>Total Invoice Amount:</span>
                      <span className="font-bold font-mono">E{previewInvoice.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Footer sign */}
                <div className="mt-16 text-center border-t border-slate-100 pt-5 text-[10px] text-slate-400">
                  Thank you for doing business with {company?.name || "us"}! This document is issued securely by corporate ledger.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

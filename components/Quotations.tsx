"use client";

import { useState, useEffect, useRef } from "react";
import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc, query, orderBy, getDoc, where } from "firebase/firestore";
import { db, auth as importAuth, handleFirestoreError, OperationType, isOfflineError } from "../lib/firebase";
import { useUserStore } from "../lib/store";
import { logAction } from "../lib/audit";
import { uploadToDrive } from "../lib/drive";
import { FileText, Plus, Search, Trash, Edit, Download, Loader2, Eye, X, Check, CheckCircle2 } from "lucide-react";
import jsPDF from "jspdf";
import safeHtml2Canvas from "../lib/safeHtml2canvas";
import LoadingSkeleton from "./LoadingSkeleton";

interface Item {
  description: string;
  quantity: number;
  price: number;
}

interface Quotation {
  id?: string;
  ownerId: string;
  number: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  date: string;
  validUntil: string;
  items: Item[];
  total: number;
  status: "pending" | "accepted" | "declined";
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

export default function Quotations() {
  const { currentUser } = useUserStore();

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
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [clients, setClients] = useState<Customer[]>([]);

  // Form Fields
  const [isOpen, setIsOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [date, setDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, price: 0 }]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Preview & Export Modal
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);
  const pdfAreaRef = useRef<HTMLDivElement>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const fetchQuotationsAndCompany = async () => {
    const user = auth.currentUser;
    if (!user || !currentUser) return;

    setLoading(true);
    const businessId = currentUser?.companyId || currentUser?.businessId || user.uid;
    const quotsPath = `companies/${businessId}/quotations`;
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

      // Fetch quotations
      const qRef = collection(db, "companies", businessId, "quotations");
      const querySnap = await getDocs(query(qRef, orderBy("number", "desc")));
      const itemsList: Quotation[] = [];
      querySnap.forEach((docSnap) => {
        itemsList.push({ id: docSnap.id, ...docSnap.data() } as Quotation);
      });
      setQuotations(itemsList);
      localStorage.setItem(`miratech_offline_quotations_${businessId}`, JSON.stringify(itemsList));
      
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
        console.warn("[Quotations Offline Fallback] Loading data from local cache.");
        const cachedCompany = localStorage.getItem(`miratech_offline_company_${user.uid}`);
        if (cachedCompany) setCompany(JSON.parse(cachedCompany));
        const cachedQuots = localStorage.getItem(`miratech_offline_quotations_${user.uid}`);
        if (cachedQuots) {
          setQuotations(JSON.parse(cachedQuots));
        } else {
          setQuotations([]);
        }
        const user = auth.currentUser;
        const cacheKey = user ? `miratech_customers_${user.uid}` : "miratech_customers_guest";
        const cachedClients = localStorage.getItem(cacheKey);
        if (cachedClients) setClients(JSON.parse(cachedClients));
      } else {
        handleFirestoreError(err, OperationType.GET, quotsPath);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotationsAndCompany();
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

    const payload: Quotation = {
      ownerId: user.uid,
      number,
      clientName,
      clientEmail,
      clientAddress,
      date,
      validUntil,
      items,
      total,
      status: "pending",
    };

    const quotsPath = `companies/${user.uid}/quotations`;
    try {
      let newId = "offline-" + Date.now();
      try {
        const colRef = collection(db, "companies", user.uid, "quotations");
        const addedDoc = await addDoc(colRef, payload);
        newId = addedDoc.id;

        // Log database audit trail
        await logAction(
          "Quotation Drafted",
          `Drafted quotation #${payload.number} for client '${payload.clientName}'. Total value: $${payload.total}`,
          user.uid,
          payload.total
        );
      } catch (err) {
        if (!isOfflineError(err)) throw err;
        console.warn("[Quotations Offline Submit] Saving quotation locally to local storage.");
      }

      // Local storage cache update
      const cachedQuots = localStorage.getItem(`miratech_offline_quotations_${user.uid}`);
      const quotsList: Quotation[] = cachedQuots ? JSON.parse(cachedQuots) : [];
      quotsList.unshift({ id: newId, ...payload });
      localStorage.setItem(`miratech_offline_quotations_${user.uid}`, JSON.stringify(quotsList));

      setIsOpen(false);
      // Reset State
      setNumber("");
      setClientName("");
      setClientEmail("");
      setClientAddress("");
      setDate("");
      setValidUntil("");
      setItems([{ description: "", quantity: 1, price: 0 }]);
      fetchQuotationsAndCompany();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, quotsPath);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, nextStatus: "pending" | "accepted" | "declined") => {
    const user = auth.currentUser;
    if (!user) return;

    const quotPath = `companies/${user.uid}/quotations/${id}`;
    let isOffline = false;
    try {
      await updateDoc(doc(db, "companies", user.uid, "quotations", id), { status: nextStatus });
    } catch (err) {
      if (!isOfflineError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, quotPath);
        return;
      }
      isOffline = true;
      console.warn("[Quotations Offline State Update] Modifying quotation state locally.");
    }

    // Reflect update in local cache of quotations
    const cachedQuots = localStorage.getItem(`miratech_offline_quotations_${user.uid}`);
    if (cachedQuots) {
      const quotsList: Quotation[] = JSON.parse(cachedQuots);
      const updatedList = quotsList.map((q) => (q.id === id ? { ...q, status: nextStatus } : q));
      localStorage.setItem(`miratech_offline_quotations_${user.uid}`, JSON.stringify(updatedList));
      if (isOffline) {
        setQuotations(updatedList);
      }
    }

    if (!isOffline) {
      fetchQuotationsAndCompany();
    }
  };

  const handleConvertToInvoice = async (q: Quotation) => {
    const user = auth.currentUser;
    if (!user || !currentUser) return;

    const confirmConvert = window.confirm(`Convert Quotation #${q.number} into a corporate billing Invoice?`);
    if (!confirmConvert) return;

    setConvertingId(q.id || null);
    const businessId = currentUser.companyId || currentUser.businessId || user.uid;
    const prefixRemoved = q.number.replace(/^(QT|QUOT|Q|qt|quot|q)-/i, "");
    const generatedInvNumber = `INV-${prefixRemoved}`;

    const invoicePayload: any = {
      ownerId: user.uid,
      number: generatedInvNumber,
      clientName: q.clientName,
      clientEmail: q.clientEmail,
      clientAddress: q.clientAddress,
      date: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      items: q.items,
      total: q.total,
      status: "unpaid",
      convertedFromQuotation: q.number
    };

    try {
      // 1. Save new Invoice doc to Firestore subcollection
      const colRef = collection(db, "companies", businessId, "invoices");
      const addedDoc = await addDoc(colRef, invoicePayload);
      const newInvoiceId = addedDoc.id;

      // 2. Save to local storage offline invoices cache
      const cachedInvsKey = `miratech_offline_invoices_${user.uid}`;
      const cachedInvs = localStorage.getItem(cachedInvsKey);
      const invsList = cachedInvs ? JSON.parse(cachedInvs) : [];
      invsList.unshift({ id: newInvoiceId, ...invoicePayload });
      localStorage.setItem(cachedInvsKey, JSON.stringify(invsList));

      // 3. Log audit trail entry
      await logAction(
        "Invoice Created from Quotation",
        `Converted Quotation #${q.number} to Corporate Invoice #${generatedInvNumber} for '${q.clientName}'. Amount: $${q.total}`,
        user.uid,
        q.total
      );

      // 4. Update the source Quotation with custom reference info
      await updateDoc(doc(db, "companies", businessId, "quotations", q.id!), { 
        invoiceReference: generatedInvNumber
      });
      
      alert(`Quotation successfully converted to Invoice #${generatedInvNumber}! You can view and download it under the Invoices tab.`);
      fetchQuotationsAndCompany();
    } catch (err) {
      console.error("Failed to convert quotation to invoice:", err);
      alert("Failed to convert quotation to invoice.");
    } finally {
      setConvertingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const quotPath = `companies/${user.uid}/quotations/${id}`;
    let isOffline = false;
    try {
      await deleteDoc(doc(db, "companies", user.uid, "quotations", id));

      // Log database audit trail
      await logAction(
        "Quotation Extinguished",
        `Permanently deleted quotation ID: ${id}`,
        user.uid
      );
    } catch (err) {
      if (!isOfflineError(err)) {
        handleFirestoreError(err, OperationType.DELETE, quotPath);
        return;
      }
      isOffline = true;
      console.warn("[Quotations Offline Delete] Deleting quotation locally.");
    }

    // Reflect deletion in local cache of quotations
    const cachedQuots = localStorage.getItem(`miratech_offline_quotations_${user.uid}`);
    if (cachedQuots) {
      const quotsList: Quotation[] = JSON.parse(cachedQuots);
      const updatedList = quotsList.filter((q) => q.id !== id);
      localStorage.setItem(`miratech_offline_quotations_${user.uid}`, JSON.stringify(updatedList));
      if (isOffline) {
        setQuotations(updatedList);
      }
    }

    if (!isOffline) {
      fetchQuotationsAndCompany();
    }
  };

  const handleExportPDF = async () => {
    if (!pdfAreaRef.current || !previewQuotation) return;

    try {
      const element = pdfAreaRef.current;
      const canvas = await safeHtml2Canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210; // A4 dimensions
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
      
      const pdfBlob = pdf.output('blob');
      const fileName = `Quotation_${previewQuotation.number}.pdf`;
      
      // Save PDF locally first to ensure of physical download success
      pdf.save(fileName);

      // Attempt background Google Drive backup gracefully
      try {
        const fileId = await uploadToDrive(pdfBlob, fileName);
        const user = auth.currentUser;
        if (user && previewQuotation.id) {
          await updateDoc(doc(db, "companies", user.uid, "quotations", previewQuotation.id), {
            driveFileId: fileId
          });
          fetchQuotationsAndCompany();
          console.log("Quotation backed up to Google Drive successfully!");
        }
      } catch (driveErr: any) {
        console.warn("Google Drive skip/backup failed:", driveErr.message);
      }
    } catch (err) {
      console.error("PDF printing failed:", err);
      alert("PDF generation failed.");
    }
  };

  const filteredQuots = quotations.filter((q) => {
    const matchesSearch =
      q.clientName.toLowerCase().includes(search.toLowerCase()) ||
      q.number.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" ? true : q.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Quotations Manager</h1>
          <p className="text-[11px] text-slate-500">Draft, view, and print corporate price quotes.</p>
        </div>
        {!company ? (
          <div className="text-[11px] bg-amber-50 text-amber-700 p-2 py-1.5 rounded-md border border-amber-100/50 max-w-sm">
            Please fill in your <strong>Company Profile</strong> tab before creating documents to populate the corporate letterhead details!
          </div>
        ) : (
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-bold cursor-pointer shadow-3xs transition"
          >
            <Plus className="h-3.5 w-3.5" /> Create Quotation
          </button>
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
            placeholder="Search quotations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden"
          />
        </div>
        <div className="flex gap-1.5 self-start md:self-auto overflow-x-auto w-full md:w-auto">
          {["all", "pending", "accepted", "declined"].map((tab) => (
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
      </div>

      {loading ? (
        <div className="py-4">
          <LoadingSkeleton />
        </div>
      ) : filteredQuots.length === 0 ? (
        <div className="border border-dashed border-slate-250 rounded-lg p-6 text-center text-slate-400">
          <FileText className="h-8 w-8 mx-auto text-slate-305 mb-1.5" />
          <p className="text-xs font-extrabold text-slate-700">No quotations found</p>
          <p className="text-[10px] text-slate-450 mt-0.5">Start by clicking the &quot;Create Quotation&quot; button above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-blue-100/70 rounded-lg shadow-3xs">
          <table className="high-density-table w-full text-left border-collapse">
            <thead>
              <tr>
                <th>Quote No.</th>
                <th>Client</th>
                <th>Validity Date</th>
                <th>Total Value</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredQuots.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">{q.number}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold">{q.clientName}</div>
                    <div className="text-[10px] text-slate-400">{q.clientEmail}</div>
                  </td>
                  <td className="py-3.5 px-4">{q.validUntil}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">${q.total.toLocaleString()}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                        q.status === "accepted"
                          ? "bg-emerald-50 text-emerald-700"
                          : q.status === "declined"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-1">
                    {q.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(q.id!, "accepted")}
                          title="Accept"
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer inline-flex"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(q.id!, "declined")}
                          title="Decline"
                          className="p-1 text-red-500 hover:bg-red-50 rounded-md cursor-pointer inline-flex"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {q.status === "accepted" && (
                      <button
                        onClick={() => handleConvertToInvoice(q)}
                        disabled={convertingId !== null}
                        title="Convert to Corporate Invoice"
                        className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md cursor-pointer inline-flex border border-emerald-100"
                      >
                        {convertingId === q.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setPreviewQuotation(q)}
                      title="Preview Ledger Document"
                      className="p-1 text-slate-600 hover:bg-slate-50 rounded-md cursor-pointer inline-flex"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(q.id!)}
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
              <h3 className="text-md font-semibold text-slate-800">Draft New Corporate Price Quote</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Quotation Reference ID
                  </label>
                  <input
                    type="text"
                    required
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                    placeholder="e.g. QT-2026-001"
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
                    Client Name
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
                    Quote Issue Date
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
                    Validity Period Expiration
                  </label>
                  <input
                    type="date"
                    required
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Client Physical/Billing Address
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
                <span className="text-md font-bold text-slate-800">${calculateTotal().toLocaleString()}</span>
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
                      <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save & Issue Quote"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Generation Offscreen and Detailed View Modal */}
      {previewQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-4xl w-full">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-sm font-semibold text-slate-800">Review Quotation: {previewQuotation.number}</span>
              <div className="flex gap-2">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-900 border border-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition"
                >
                  <Download className="h-3.5 w-3.5" /> A4 PDF
                </button>
                <button
                  onClick={() => setPreviewQuotation(null)}
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
                {/* Letterhead Logo & Company Header */}
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
                    <h1 className="text-2xl font-black text-slate-900 tracking-wider">OFFICIAL QUOTATION</h1>
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
                      Quote Prepared For:
                    </span>
                    <p className="font-bold text-slate-900">{previewQuotation.clientName}</p>
                    <p className="text-slate-500">{previewQuotation.clientEmail}</p>
                    <p className="text-slate-500 whitespace-pre-line max-w-[250px]">{previewQuotation.clientAddress}</p>
                  </div>

                  <div className="text-right">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Document Details:
                    </span>
                    <p>
                      <strong className="text-slate-900">Quote Number:</strong> {previewQuotation.number}
                    </p>
                    <p>
                      <strong className="text-slate-900">Issue Date:</strong> {previewQuotation.date}
                    </p>
                    <p>
                      <strong className="text-slate-900">Valid Until:</strong> {previewQuotation.validUntil}
                    </p>
                  </div>
                </div>

                {/* Ledger Items Table */}
                <table className="w-full text-left border-collapse border border-slate-200 mb-6 text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-semibold uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 px-3 border border-slate-900">Deliverables Description</th>
                      <th className="py-2.5 px-3 border border-slate-900 text-center w-20">Quantity</th>
                      <th className="py-2.5 px-3 border border-slate-900 text-right w-28">Unit Price</th>
                      <th className="py-2.5 px-3 border border-slate-900 text-right w-28">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previewQuotation.items.map((it, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-3 border border-slate-200 font-medium">{it.description}</td>
                        <td className="py-3 px-3 border border-slate-200 text-center font-mono">{it.quantity}</td>
                        <td className="py-3 px-3 border border-slate-200 text-right font-mono">
                          ${it.price.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 border border-slate-200 text-right font-bold text-slate-900 font-mono">
                          ${(it.quantity * it.price).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summaries */}
                <div className="flex justify-between items-start text-xs">
                  <div className="max-w-[320px] text-slate-500 text-[10px] space-y-1 mt-2">
                    <p className="font-bold text-slate-800">Terms and Conditions:</p>
                    <p>1. Payments are subject to agreements listed upon active billing invoice.</p>
                    <p>2. Acceptance can be recorded via the central executive database portal.</p>
                  </div>

                  <div className="text-right w-64 space-y-1.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono">${previewQuotation.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t-2 border-slate-900 pt-1.5 font-bold text-slate-900 text-sm">
                      <span>Total Value:</span>
                      <span className="font-bold font-mono">${previewQuotation.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Footer sign */}
                <div className="mt-16 text-center border-t border-slate-100 pt-5 text-[10px] text-slate-400">
                  Thank you for choosing {company?.name || "us"}! This document is generated securely by the Corporate Report & Ledger suite.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

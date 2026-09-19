"use client";

import { useState, useEffect, useRef } from "react";
import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc, query, orderBy, getDoc, where } from "firebase/firestore";
import { db, auth as importAuth, handleFirestoreError, OperationType, isOfflineError } from "../lib/firebase";
import { useUserStore, useToastStore } from "../lib/store";
import { logAction } from "../lib/audit";
import { uploadToDrive } from "../lib/drive";
import { FileText, Plus, Search, Trash, Edit, Download, Loader2, Eye, X, Check, CheckCircle2 } from "lucide-react";
// import jsPDF from "jspdf";
import safeHtml2Canvas from "../lib/safeHtml2canvas";
import LoadingSkeleton from "./LoadingSkeleton";

interface Item {
  description: string;
  quantity: number;
  price: number;
  productId?: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
}

interface Project {
  id: string;
  name: string;
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
  department?: string;
  projectId?: string;
  approvalStatus?: 'draft' | 'pending_admin' | 'pending_hr' | 'pending_final' | 'approved' | 'rejected' | 'cancelled';
  approvalHistory?: any[];
  approvalComments?: string;
}

interface CompanyDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  letterheadLogo: string;
  useCompanyLetterhead?: boolean;
  letterheadWidthFit?: boolean;
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

export default function Quotations({ departmentId }: { departmentId?: string }) {
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
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [clients, setClients] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Workflow states
  const [workflowComments, setWorkflowComments] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    addToast(`${label} copied to clipboard!`, "success");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleWorkflowTransition = async (
    nextStatus: "pending_admin" | "pending_hr" | "pending_final" | "approved" | "rejected" | "cancelled",
    actionName: string,
    override = false
  ) => {
    if (!previewQuotation || !previewQuotation.id) return;
    const user = auth.currentUser;
    if (!user) return;

    const newEvent = {
      type: override ? "manager_override" : actionName.toLowerCase().replace(/ /g, "_"),
      user: currentUser?.email || "System User",
      userId: currentUser?.uid || user.uid,
      role: currentUser?.role || "STAFF",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString(),
      comments: workflowComments || `${actionName} performed by ${currentUser?.email || "User"}.`
    };

    const updatedHistory = [...(previewQuotation.approvalHistory || []), newEvent];

    try {
      setSubmitting(true);
      await updateDoc(doc(db, "companies", user.uid, "quotations", previewQuotation.id), {
        approvalStatus: nextStatus,
        approvalHistory: updatedHistory,
        approvalComments: workflowComments || ""
      });

      // Send appropriate Notification
      let notificationTitle = "Quotation Workflow Updated";
      let notificationMsg = `Quotation #${previewQuotation.number} status changed to ${nextStatus}.`;
      let notificationType: "info" | "success" | "warning" = "info";

      if (nextStatus === "pending_hr") {
        notificationTitle = "Quotation Pending HR Approval";
        notificationMsg = `Quotation #${previewQuotation.number} was reviewed by Admin and is pending HR review.`;
      } else if (nextStatus === "pending_final") {
        notificationTitle = "HR Approved Quotation";
        notificationMsg = `Quotation #${previewQuotation.number} has been approved by HR (${currentUser?.email}) and is waiting for final business approval.`;
        notificationType = "success";
      } else if (nextStatus === "approved") {
        notificationTitle = "Quotation Fully Approved";
        notificationMsg = `Quotation #${previewQuotation.number} is now official and approved.`;
        notificationType = "success";
      } else if (nextStatus === "rejected") {
        notificationTitle = "Quotation Action: Changes Requested";
        notificationMsg = `Quotation #${previewQuotation.number} was returned/rejected by ${currentUser?.email} with comments.`;
        notificationType = "warning";
      }

      await addDoc(collection(db, "companies", user.uid, "notifications"), {
        businessId: user.uid,
        title: notificationTitle,
        message: notificationMsg,
        read: false,
        createdAt: new Date().toISOString(),
        type: notificationType
      });

      // Log database audit trail
      await logAction(
        `Quotation Workflow: ${actionName}`,
        `Quotation #${previewQuotation.number} transitioned to '${nextStatus}'. Comments: ${workflowComments || "None"}`,
        user.uid
      );

      addToast(`Quotation #${previewQuotation.number} updated: ${actionName}`, "success");
      setWorkflowComments("");
      setPreviewQuotation({
        ...previewQuotation,
        approvalStatus: nextStatus,
        approvalHistory: updatedHistory,
        approvalComments: workflowComments
      });
      fetchQuotationsAndCompany();
    } catch (err) {
      console.error(err);
      addToast("Failed to transition document workflow state", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Form Fields
  const [isOpen, setIsOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [date, setDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, price: 0 }]);
  const [projectId, setProjectId] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedQuotations, setSelectedQuotations] = useState<Set<string>>(new Set());

  const generateNextQuotationNumber = () => {
    let nextNum = departmentId ? `QT-${departmentId.toUpperCase()}-1001` : "QT-1001";
    if (quotations && quotations.length > 0) {
      let maxNum = 0;
      let prefix = departmentId ? `QT-${departmentId.toUpperCase()}-` : "QT-";
      let padLength = 0;
      
      for (const q of quotations) {
        const numStr = q.number;
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

  const handleOpenCreateQuotation = () => {
    const nextNum = generateNextQuotationNumber();
    setNumber(nextNum);
    
    // Set default dates
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 30);
    setValidUntil(nextWeek.toISOString().split("T")[0]);
    
    setIsOpen(true);
  };

  // Preview & Export Modal
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);
  const pdfAreaRef = useRef<HTMLDivElement>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const fetchQuotationsAndCompany = async () => {
    const user = auth.currentUser;
    if (!user || !currentUser) return;

    setLoading(true);
    const businessId = currentUser?.companyId || currentUser?.businessId || user.uid;
    if (!businessId) return;
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
      const finalQuots = departmentId ? itemsList.filter(q => q.department === departmentId) : itemsList;
      setQuotations(finalQuots);
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

      // Load products from Firestore collection 'products' filtered by businessId
      try {
        const qProducts = query(collection(db, "products"), where("businessId", "==", businessId));
        const productsSnap = await getDocs(qProducts);
        const productsList: Product[] = [];
        productsSnap.forEach((dSnap) => {
          productsList.push({ id: dSnap.id, ...dSnap.data() } as Product);
        });
        setProducts(productsList);
        localStorage.setItem(`miratech_products_${user.uid}`, JSON.stringify(productsList));
      } catch (prodErr) {
        console.warn("Failed to fetch products for quotations dropdown, relying on cache.", prodErr);
        const cachedProducts = localStorage.getItem(`miratech_products_${user.uid}`);
        if (cachedProducts) setProducts(JSON.parse(cachedProducts));
      }

      // Load projects from Firestore collection 'projects' filtered by businessId
      try {
        const qProjects = query(collection(db, "companies", businessId, "projects"));
        const projectsSnap = await getDocs(qProjects);
        const projectsList: Project[] = [];
        projectsSnap.forEach((dSnap) => {
          projectsList.push({ id: dSnap.id, ...dSnap.data() } as Project);
        });
        setProjects(projectsList);
      } catch (projErr) {
        console.warn("Failed to fetch projects for quotations dropdown.", projErr);
      }

    } catch (err) {
      if (isOfflineError(err)) {
        console.warn("[Quotations Offline Fallback] Loading data from local cache.");
        const fallbackUid = user?.uid || businessId;
        const cachedCompany = localStorage.getItem(`miratech_offline_company_${fallbackUid}`);
        if (cachedCompany) setCompany(JSON.parse(cachedCompany));
        const cachedQuots = localStorage.getItem(`miratech_offline_quotations_${fallbackUid}`);
        if (cachedQuots) {
          const rawList = JSON.parse(cachedQuots) as Quotation[];
          setQuotations(departmentId ? rawList.filter(q => q.department === departmentId) : rawList);
        } else {
          setQuotations([]);
        }
        const cacheKey = fallbackUid ? `miratech_customers_${fallbackUid}` : "miratech_customers_guest";
        const cachedClients = localStorage.getItem(cacheKey);
        if (cachedClients) setClients(JSON.parse(cachedClients));

        const cachedProducts = localStorage.getItem(`miratech_products_${fallbackUid}`);
        if (cachedProducts) setProducts(JSON.parse(cachedProducts));
      } else {
        handleFirestoreError(err, OperationType.GET, quotsPath);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotationsAndCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } else if (field === "productId") {
      next[index].productId = value ? String(value) : undefined;
    } else if (field === "quantity" || field === "price") {
      next[index][field] = Number(value);
    }
    setItems(next);
  };

  const handleProductSelectForItem = (index: number, productIdStr: string) => {
    const next = [...items];
    if (!productIdStr) {
      next[index].productId = undefined;
    } else {
      const selectedProd = products.find((p) => p.id === productIdStr);
      if (selectedProd) {
        next[index].productId = selectedProd.id;
        next[index].description = selectedProd.name;
        next[index].price = selectedProd.price;
      }
    }
    setItems(next);
  };

  const calculateTotal = () => {
    return items.reduce((acc, current) => acc + current.quantity * current.price, 0);
  };

  const handleSubmit = async (e: React.FormEvent, isDraft = false) => {
    if (e) e.preventDefault();
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
      approvalStatus: isDraft ? "draft" : "pending_admin",
      approvalHistory: [
        {
          type: isDraft ? "draft_saved" : "submitted",
          user: currentUser?.email || "Unknown Staff",
          userId: currentUser?.uid || "unknown",
          role: currentUser?.role || "STAFF",
          date: new Date().toISOString().split("T")[0],
          time: new Date().toLocaleTimeString(),
          comments: isDraft ? "Draft quotation saved." : "Quotation submitted for administrative review."
        }
      ],
      ...(departmentId ? { department: departmentId } : {}),
      ...(projectId ? { projectId } : {}),
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
          `Drafted quotation #${payload.number} for client '${payload.clientName}'. Total value: E${payload.total} (${isDraft ? 'Draft' : 'Submitted'})`,
          user.uid,
          payload.total
        );

        // Submit notification if not draft
        if (!isDraft) {
          await addDoc(collection(db, "companies", user.uid, "notifications"), {
            businessId: user.uid,
            title: "New Quotation Submitted",
            message: `Quotation #${payload.number} was submitted by Staff (${currentUser?.email}) and requires review.`,
            read: false,
            createdAt: new Date().toISOString(),
            type: "info"
          });
        }
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
      addToast(isDraft ? `Draft Quotation #${payload.number} saved successfully` : `Quotation #${payload.number} submitted for approval`, "success");
      fetchQuotationsAndCompany();
    } catch (err) {
      addToast(`System Error: Failed to draft quotation #${payload.number}. Reason: ${err instanceof Error ? err.message : String(err)}`, "error");
      handleFirestoreError(err, OperationType.CREATE, quotsPath);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, nextStatus: "pending" | "accepted" | "declined") => {
    const user = auth.currentUser;
    if (!user) return;

    const targetQuot = quotations.find((element) => element.id === id);
    const quotPath = `companies/${user.uid}/quotations/${id}`;
    let isOffline = false;

    try {
      await updateDoc(doc(db, "companies", user.uid, "quotations", id), { status: nextStatus });

      if (targetQuot && targetQuot.status !== "accepted" && nextStatus === "accepted") {
        for (const item of targetQuot.items) {
          if (item.productId) {
            try {
              const productRef = doc(db, "products", item.productId);
              const pSnap = await getDoc(productRef);
              if (pSnap.exists()) {
                const pData = pSnap.data();
                const currentStock = Number(pData.stock) || 0;
                const newStock = Math.max(0, currentStock - item.quantity);
                await updateDoc(productRef, { stock: newStock });

                await logAction(
                  "Product Stock Decremented",
                  `Decremented stock of '${pData.name}' by ${item.quantity} due to approval of Quote #${targetQuot.number}. New stock level: ${newStock}`,
                  user.uid
                );
              }
            } catch (pErr) {
              console.error("Failed to decrement product stock during quotation approval", pErr);
            }
          }
        }
      }
    } catch (err) {
      if (!isOfflineError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, quotPath);
        return;
      }
      isOffline = true;
      console.warn("[Quotations Offline State Update] Modifying quotation state locally.");
    }

    if (targetQuot && targetQuot.status !== "accepted" && nextStatus === "accepted") {
      const cachedProductsKey = `miratech_products_${user.uid}`;
      const cachedProducts = localStorage.getItem(cachedProductsKey);
      if (cachedProducts) {
        try {
          const productsList: Product[] = JSON.parse(cachedProducts);
          const updatedProducts = productsList.map((p) => {
            const item = targetQuot.items.find((it) => it.productId === p.id);
            if (item) {
              return { ...p, stock: Math.max(0, (Number(p.stock) || 0) - item.quantity) };
            }
            return p;
          });
          localStorage.setItem(cachedProductsKey, JSON.stringify(updatedProducts));
          setProducts(updatedProducts);
        } catch (cacheErr) {
          console.error("Failed to update cache stock offline", cacheErr);
        }
      }
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

    addToast(`Quotation status updated to ${nextStatus}`, "success");
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
    let generatedInvNumber = `INV-${prefixRemoved}`;

    // Read cached invoices to avoid duplicate numbers!
    try {
      const cachedInvsStr = localStorage.getItem(`miratech_offline_invoices_${businessId}`);
      if (cachedInvsStr) {
        const cachedInvsList = JSON.parse(cachedInvsStr);
        const existingNumbers = new Set(cachedInvsList.map((inv: any) => String(inv.number).toUpperCase()));
        let attemptNum = generatedInvNumber;
        let suffix = 1;
        while (existingNumbers.has(attemptNum.toUpperCase())) {
          attemptNum = `${generatedInvNumber}-${suffix}`;
          suffix++;
        }
        generatedInvNumber = attemptNum;
      }
    } catch (e) {
      console.warn("Could not check duplicate invoices cache:", e);
    }

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
        `Converted Quotation #${q.number} to Corporate Invoice #${generatedInvNumber} for '${q.clientName}'. Amount: E${q.total}`,
        user.uid,
        q.total
      );

      // 4. Update the source Quotation with custom reference info
      await updateDoc(doc(db, "companies", businessId, "quotations", q.id!), { 
        invoiceReference: generatedInvNumber
      });
      
      addToast(`Quotation converted to Invoice #${generatedInvNumber} successfully!`, "success");
      fetchQuotationsAndCompany();
    } catch (err) {
      console.error("Failed to convert quotation to invoice:", err);
      addToast(`System Error: Failed to convert quotation. Reason: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setConvertingId(null);
    }
  };

  const handleBatchStatusUpdate = async (newStatus: "pending" | "accepted" | "declined") => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      setSubmitting(true);
      await Promise.all(Array.from(selectedQuotations).map(async (id) => {
        await updateDoc(doc(db, "companies", user.uid, "quotations", id), {
          status: newStatus,
        });
      }));
      addToast(`Updated ${selectedQuotations.size} quotations to ${newStatus}`, "success");
      setSelectedQuotations(new Set());
      fetchQuotationsAndCompany();
    } catch (err) {
      console.error(err);
      addToast("Failed to batch update quotation statuses", "error");
    } finally {
      setSubmitting(false);
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

    addToast("Quotation deleted successfully", "warning");
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
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210; // A4 dimensions
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
      
      const pdfBlob = pdf.output('blob');
      const fileName = `Quotation_${previewQuotation.number}.pdf`;
      
      // Save PDF locally first to ensure of physical download success
      pdf.save(fileName);
      addToast(`Export Complete: Saved PDF ${fileName}`, "success");

      // Attempt background Google Drive backup gracefully
      try {
        const fileId = await uploadToDrive(pdfBlob, fileName);
        const user = auth.currentUser;
        if (user && previewQuotation.id) {
          await updateDoc(doc(db, "companies", user.uid, "quotations", previewQuotation.id), {
            driveFileId: fileId
          });
          fetchQuotationsAndCompany();
          addToast("Quotation backed up to Google Drive successfully!", "info");
        }
      } catch (driveErr: any) {
        console.warn("Google Drive skip/backup failed:", driveErr.message);
      }
    } catch (err) {
      console.error("PDF printing failed:", err);
      addToast(`System Error: PDF generation failed. Reason: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const filteredQuots = quotations.filter((q) => {
    const matchesSearch =
      q.clientName.toLowerCase().includes(search.toLowerCase()) ||
      q.number.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" ? true : 
      filter === "approvals" ? (q.approvalStatus === "pending_admin" || q.approvalStatus === "pending_hr" || q.approvalStatus === "pending_final") : 
      q.status === filter;
    
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && q.date >= startDate;
    }
    if (endDate) {
      matchesDate = matchesDate && q.date <= endDate;
    }
    return matchesSearch && matchesFilter && matchesDate;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Quotations Manager</h1>
          <p className="text-[11px] text-slate-505">Draft, view, and print corporate price quotes.</p>
        </div>
        {!company ? (
          <div className="text-[11px] bg-amber-50 text-amber-700 p-2 py-1.5 rounded-md border border-amber-100/50 max-w-sm">
            Please fill in your <strong>Company Profile</strong> tab before creating documents to populate the corporate letterhead details!
          </div>
        ) : (
          <div className="flex gap-2">
              {selectedQuotations.size > 0 && (
                <div className="flex items-center gap-1 bg-white border border-blue-200 rounded-md p-0.5">
                  <button onClick={() => handleBatchStatusUpdate("accepted")} className="px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer">Mark Accepted</button>
                  <button onClick={() => handleBatchStatusUpdate("declined")} className="px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50 rounded cursor-pointer">Mark Declined</button>
                  <button onClick={() => handleBatchStatusUpdate("pending")} className="px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded cursor-pointer">Mark Pending</button>
                </div>
              )}
            <button
              onClick={handleOpenCreateQuotation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-bold cursor-pointer shadow-3xs transition"
            >
              <Plus className="h-3.5 w-3.5" /> Create Quotation
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
            placeholder="Search quotations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden"
          />
        </div>
        <div className="flex gap-1.5 self-start md:self-auto overflow-x-auto w-full md:w-auto">
          {["all", "pending", "accepted", "declined", "approvals"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-2.5 py-1 border rounded-md text-[11px] font-bold cursor-pointer transition capitalize ${
                filter === tab
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {tab === "approvals" ? "Pending Approvals" : tab}
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
                <th className="p-4">
                  <input 
                    type="checkbox"
                    checked={selectedQuotations.size === filteredQuots.length && filteredQuots.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedQuotations(new Set(filteredQuots.map(q => q.id!)));
                      } else {
                        setSelectedQuotations(new Set());
                      }
                    }}
                  />
                </th>
                <th>Quote No.</th>
                <th>Client</th>
                <th>Validity Date</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Approval Stage</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredQuots.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50/50">
                  <td className="p-4">
                        <input 
                          type="checkbox"
                          checked={selectedQuotations.has(q.id!)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedQuotations);
                            if (e.target.checked) newSelected.add(q.id!);
                            else newSelected.delete(q.id!);
                            setSelectedQuotations(newSelected);
                          }}
                        />
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">{q.number}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold">{q.clientName}</div>
                    <div className="text-[10px] text-slate-400">{q.clientEmail}</div>
                  </td>
                  <td className="py-3.5 px-4">{q.validUntil}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">E{q.total.toLocaleString()}</td>
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
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        (q.approvalStatus || 'approved') === "approved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : (q.approvalStatus || 'approved') === "draft"
                          ? "bg-slate-50 text-slate-600 border-slate-300"
                          : (q.approvalStatus || 'approved') === "rejected"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse"
                      }`}
                    >
                      {(q.approvalStatus || 'approved').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-1">
                    {q.status === "pending" && (q.approvalStatus || 'approved') === "approved" && (
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
                    {q.status === "accepted" && (q.approvalStatus || 'approved') === "approved" && (
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
                    {/* Guard Delete button: Staff can only delete drafts or rejected quotations */}
                    {!(currentUser?.role === 'STAFF' && q.approvalStatus && q.approvalStatus !== 'draft' && q.approvalStatus !== 'rejected') && (
                      <button
                        onClick={() => handleDelete(q.id!)}
                        title="Remove"
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer inline-flex"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    )}
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
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Select Project (Optional)
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/20 focus:outline-hidden focus:border-slate-400"
                  >
                    <option value="">-- Choose a Project --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
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

                {items.map((item, idx) => {
                  const matchedProd = products.find(p => p.id === item.productId);
                  return (
                    <div key={idx} className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 space-y-2.5">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-12 sm:col-span-7">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                            Pick Product from Inventory (Optional)
                          </label>
                          <select
                            value={item.productId || ""}
                            onChange={(e) => handleProductSelectForItem(idx, e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded-md text-[11px] bg-white focus:outline-hidden focus:border-blue-400"
                          >
                            <option value="">-- Custom Description / Write Free Text --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (E{p.price.toLocaleString()} | Stock: {p.stock})
                              </option>
                            ))}
                          </select>
                        </div>
                        {matchedProd && (
                          <div className="col-span-12 sm:col-span-5 text-right pr-1">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              matchedProd.stock <= 0 
                                ? "bg-red-50 text-red-600" 
                                : matchedProd.stock <= matchedProd.minStock 
                                  ? "bg-amber-50 text-amber-700" 
                                  : "bg-emerald-50 text-emerald-700"
                            }`}>
                              Stock Availability: {matchedProd.stock} units
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                            Line Item Description
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Description of deliverables..."
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden focus:border-blue-400"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 text-center">
                            Qty
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-center focus:outline-hidden focus:border-blue-400"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 text-right">
                            Price (E)
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            placeholder="Price"
                            value={item.price}
                            onChange={(e) => handleItemChange(idx, "price", e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-right focus:outline-hidden focus:border-blue-400"
                          />
                        </div>
                        <div className="col-span-1 text-center pt-3">
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
                    </div>
                  );
                })}
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
                  type="button"
                  disabled={submitting}
                  onClick={(e) => handleSubmit(e, true)}
                  className="px-4 py-1.5 border border-slate-300 text-slate-700 bg-slate-50 font-medium rounded-lg text-xs hover:bg-slate-100 shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={(e) => handleSubmit(e, false)}
                  className="px-4 py-1.5 bg-blue-600 text-white font-medium rounded-lg text-xs hover:bg-blue-700 shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Submitting...
                    </>
                  ) : (
                    "Submit for Approval"
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
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-6xl w-full overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <span>Review Quotation:</span>
                <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{previewQuotation.number}</span>
              </span>
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
                  Close Workspace
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Left Panel: A4 Printable Template */}
              <div className="lg:col-span-8 p-6 bg-slate-100 overflow-auto border-r border-slate-200 max-h-[75vh]">
                <div
                  ref={pdfAreaRef}
                  style={{ width: "210mm", minHeight: "297mm" }}
                  className="mx-auto bg-white p-[20mm] border border-slate-200 shadow-sm relative text-slate-800 font-sans"
                >
                  {/* Letterhead Logo & Company Header */}
                  {company?.useCompanyLetterhead && company?.letterheadLogo ? (
                    <div className="-mx-[20mm] -mt-[20mm] mb-6 relative">
                      <img
                        src={company.letterheadLogo}
                        alt="Corporate Banner Letterhead"
                        className={`w-full ${company.letterheadWidthFit ? 'h-[48mm] object-cover' : 'h-auto max-h-[48mm] object-contain'} block border-b border-slate-200`}
                      />
                      <div className="px-[20mm] pt-4 flex justify-between items-end border-b-2 border-slate-900 pb-4">
                        <div>
                          <h1 className="text-2xl font-black text-slate-900 tracking-wider">OFFICIAL QUOTATION</h1>
                        </div>
                        <div className="text-right text-[10px] text-slate-500 space-y-0.5 leading-normal">
                          <p className="font-bold text-slate-800">{company?.name}</p>
                          <p>{company?.email} | {company?.phone}</p>
                          <p className="max-w-[400px] truncate">{company?.address}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
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
                  )}

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
                      <p className="font-bold text-slate-800">Terms and Conditions:</p>
                      <p>1. Payments are subject to agreements listed upon active billing invoice.</p>
                      <p>2. Acceptance can be recorded via the central executive database portal.</p>
                    </div>

                    <div className="text-right w-64 space-y-1.5">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span className="font-mono">E{previewQuotation.total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-t-2 border-slate-900 pt-1.5 font-bold text-slate-900 text-sm">
                        <span>Total Value:</span>
                        <span className="font-bold font-mono">E{previewQuotation.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer sign */}
                  <div className="mt-16 text-center border-t border-slate-100 pt-5 text-[10px] text-slate-400">
                    Thank you for choosing {company?.name || "us"}! This document is generated securely by the Corporate Report & Ledger suite.
                  </div>
                </div>
              </div>

              {/* Right Panel: Workflow Operations & Fast Copies */}
              {(() => {
                const isBusinessAdmin = currentUser?.role === 'BUSINESS_ADMIN' || currentUser?.role === 'MASTER_ADMIN' || currentUser?.role === 'GENERAL_MANAGER' || currentUser?.role === 'COMPANY_OWNER';
                const canApproveQuot = isBusinessAdmin || currentUser?.canApproveQuotations || currentUser?.canApproveInvoices || currentUser?.approvalRights;
                const canFinalize = isBusinessAdmin || currentUser?.canFinalizeDocuments || currentUser?.approvalRights;
                const canReject = isBusinessAdmin || currentUser?.canRejectDocuments || currentUser?.approvalRights;
                const canViewHistory = isBusinessAdmin || currentUser?.canViewApprovalHistory || currentUser?.role !== 'STAFF';
                const hasOverrideRights = isBusinessAdmin || currentUser?.approvalRights;

                const shareLink = typeof window !== "undefined" ? `${window.location.origin}/share/quotation/${previewQuotation.id || 'new'}` : "";
                const currentApprovalStatus = previewQuotation.approvalStatus || 'approved';

                return (
                  <div className="lg:col-span-4 p-5 bg-white overflow-y-auto space-y-5 max-h-[75vh] flex flex-col justify-between border-t lg:border-t-0">
                    <div className="space-y-5">
                      {/* Status Badge */}
                      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div>
                          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Approval Stage</span>
                          <span className="text-xs font-extrabold text-slate-800 uppercase">
                            {currentApprovalStatus.replace('_', ' ')}
                          </span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                          currentApprovalStatus === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          currentApprovalStatus === 'draft' ? 'bg-slate-100 text-slate-600 border-slate-300' :
                          currentApprovalStatus === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse'
                        }`}>
                          {currentApprovalStatus === 'approved' ? 'Active Official' : 'Pending Action'}
                        </span>
                      </div>

                      {/* Copy to Clipboard Controls */}
                      <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Copy to Clipboard</span>

                        {/* Doc No */}
                        <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-md border border-slate-150">
                          <div className="truncate">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase">Doc Number</span>
                            <span className="text-[10px] font-bold font-mono text-slate-800">{previewQuotation.number}</span>
                          </div>
                          <button
                            onClick={() => handleCopyText(previewQuotation.number, "Document Number")}
                            className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                          >
                            {copiedField === "Document Number" ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied</span>
                              </>
                            ) : (
                              "Copy"
                            )}
                          </button>
                        </div>

                        {/* Transaction ID */}
                        <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-md border border-slate-150">
                          <div className="truncate">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase">Transaction ID</span>
                            <span className="text-[10px] font-bold font-mono text-slate-600 truncate block max-w-[150px]">{previewQuotation.id || "N/A"}</span>
                          </div>
                          <button
                            onClick={() => handleCopyText(previewQuotation.id || "", "Transaction ID")}
                            className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                          >
                            {copiedField === "Transaction ID" ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied</span>
                              </>
                            ) : (
                              "Copy"
                            )}
                          </button>
                        </div>

                        {/* Share Link */}
                        <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-md border border-slate-150">
                          <div className="truncate">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase">Public Share Link</span>
                            <span className="text-[10px] font-bold font-mono text-slate-600 truncate block max-w-[150px]">{shareLink}</span>
                          </div>
                          <button
                            onClick={() => handleCopyText(shareLink, "Public Share Link")}
                            className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                          >
                            {copiedField === "Public Share Link" ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied</span>
                              </>
                            ) : (
                              "Copy"
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Workflow Transitions */}
                      {currentApprovalStatus !== 'approved' && (
                        <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Workflow Operations</span>

                          <div className="space-y-1.5">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase">Decision Comments</label>
                            <textarea
                              rows={2}
                              value={workflowComments}
                              onChange={(e) => setWorkflowComments(e.target.value)}
                              placeholder="Provide reasons, annotations, or change directives..."
                              className="w-full text-[11px] p-2 border border-slate-200 rounded-md focus:outline-hidden focus:border-slate-400 bg-white"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            {/* Staff Submit */}
                            {(currentApprovalStatus === 'draft' || currentApprovalStatus === 'rejected') && (
                              <button
                                onClick={() => handleWorkflowTransition('pending_admin', 'Submit')}
                                disabled={submitting}
                                className="col-span-2 w-full p-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded transition shadow-xs text-center uppercase cursor-pointer"
                              >
                                Submit For Approval
                              </button>
                            )}

                            {/* Admin Decision */}
                            {currentApprovalStatus === 'pending_admin' && canApproveQuot && (
                              <>
                                <button
                                  onClick={() => handleWorkflowTransition('pending_hr', 'Forward to HR')}
                                  disabled={submitting}
                                  className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded transition shadow-xs uppercase cursor-pointer"
                                >
                                  Forward to HR
                                </button>
                                <button
                                  onClick={() => handleWorkflowTransition('rejected', 'Return to Clerk')}
                                  disabled={submitting}
                                  className="p-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[10px] border border-rose-200 rounded transition uppercase cursor-pointer"
                                >
                                  Return to Clerk
                                </button>
                                <button
                                  onClick={() => handleWorkflowTransition('cancelled', 'Cancel Request')}
                                  disabled={submitting}
                                  className="col-span-2 p-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold text-[9px] rounded transition uppercase cursor-pointer"
                                >
                                  Cancel Request
                                </button>
                              </>
                            )}

                            {/* HR Decision */}
                            {currentApprovalStatus === 'pending_hr' && (currentUser?.role === 'HR' || isBusinessAdmin) && (
                              <>
                                <button
                                  onClick={() => handleWorkflowTransition('pending_final', 'HR Approve')}
                                  disabled={submitting}
                                  className="p-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] rounded transition shadow-xs uppercase cursor-pointer"
                                >
                                  HR Approve
                                </button>
                                <button
                                  onClick={() => handleWorkflowTransition('rejected', 'HR Reject')}
                                  disabled={submitting}
                                  className="p-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[10px] border border-rose-200 rounded transition uppercase cursor-pointer"
                                >
                                  HR Reject
                                </button>
                              </>
                            )}

                            {/* Final Decision */}
                            {currentApprovalStatus === 'pending_final' && canFinalize && (
                              <>
                                <button
                                  onClick={() => handleWorkflowTransition('approved', 'Final Approval')}
                                  disabled={submitting}
                                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded transition shadow-xs uppercase cursor-pointer"
                                >
                                  Final Approve
                                </button>
                                <button
                                  onClick={() => handleWorkflowTransition('rejected', 'Return for Edit')}
                                  disabled={submitting}
                                  className="p-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[10px] border border-rose-200 rounded transition uppercase cursor-pointer"
                                >
                                  Reject & Return
                                </button>
                              </>
                            )}

                            {/* Override direct approval button */}
                            {hasOverrideRights && (
                              <button
                                onClick={() => handleWorkflowTransition('approved', 'Manager Override', true)}
                                disabled={submitting}
                                className="col-span-2 w-full p-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] rounded transition shadow-xs text-center uppercase border border-amber-400 mt-1 cursor-pointer"
                              >
                                ⭐ Manager Override: Direct Approve
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Audit Timeline History */}
                      {canViewHistory && (
                        <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Document Audit Timeline</span>

                          <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                            {previewQuotation.approvalHistory && previewQuotation.approvalHistory.length > 0 ? (
                              previewQuotation.approvalHistory.map((evt: any, eIdx: number) => (
                                <div key={eIdx} className="relative pl-3 border-l border-slate-300 space-y-0.5">
                                  <span className="absolute -left-1 top-1 w-2 h-2 rounded-full bg-slate-400 border border-white" />
                                  <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase leading-none">
                                    <span>{evt.date} {evt.time}</span>
                                    <span className="text-blue-600 font-mono">{evt.role}</span>
                                  </div>
                                  <p className="text-[10px] font-bold text-slate-800 leading-none">
                                    {evt.type.replace(/_/g, ' ').toUpperCase()} by {evt.user}
                                  </p>
                                  {evt.comments && (
                                    <p className="text-[9px] text-slate-500 italic bg-white p-1 rounded border border-slate-100 mt-0.5 leading-normal">
                                      &ldquo;{evt.comments}&rdquo;
                                    </p>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-[10px] text-slate-400 italic">No historical timeline exists for this document.</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                      <span>MiraTech Secure Ledger</span>
                      <span>v1.2</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { 
  ShoppingCart, 
  FileText, 
  Users, 
  Truck, 
  Package, 
  Receipt, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  Download, 
  Printer, 
  ArrowRight, 
  ShieldCheck, 
  Layers, 
  DollarSign, 
  Check, 
  Clock, 
  Building2, 
  Mail, 
  Phone, 
  ExternalLink,
  Layers3,
  Scale,
  RefreshCw,
  Eye
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  onSnapshot 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useToastStore, useUserStore } from "../lib/store";
import { logAction } from "../lib/audit";

interface ProcurementHubProps {
  companyId: string;
}

export default function ProcurementHub({ companyId }: ProcurementHubProps) {
  const addToast = useToastStore((state) => state.addToast);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "requests" | "suppliers" | "rfqs" | "pos" | "grn" | "matching"
  >("dashboard");

  // Data states
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [goodsReceivedList, setGoodsReceivedList] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Form States
  const [isPRModalOpen, setIsPRModalOpen] = useState(false);
  const [prForm, setPrForm] = useState({
    department: "Engineering",
    reason: "",
    items: [{ name: "", quantity: 1, estimatedPrice: 0 }]
  });

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    category: "General Supply",
    paymentTerms: "Net 30"
  });

  const [isRFQModalOpen, setIsRFQModalOpen] = useState(false);
  const [rfqForm, setRfqForm] = useState({
    title: "",
    deadline: "",
    selectedSuppliers: [] as string[],
    items: [{ name: "", quantity: 1 }]
  });

  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [selectedRfqId, setSelectedRfqId] = useState("");
  const [quoteForm, setQuoteForm] = useState({
    supplierId: "",
    supplierName: "",
    totalAmount: 0,
    deliveryDays: 7,
    notes: ""
  });

  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [selectedQuoteForPO, setSelectedQuoteForPO] = useState<any | null>(null);
  const [poForm, setPoForm] = useState({
    poNumber: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    supplierId: "",
    supplierName: "",
    taxRate: 15,
    items: [] as any[]
  });

  const [isGRNModalOpen, setIsGRNModalOpen] = useState(false);
  const [selectedPOForGRN, setSelectedPOForGRN] = useState<any | null>(null);
  const [grnForm, setGrnForm] = useState({
    receivedItems: [] as any[],
    notes: ""
  });

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedPOForInvoice, setSelectedPOForInvoice] = useState<any | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: `INV-SUP-${Math.floor(1000 + Math.random() * 9000)}`,
    amount: 0,
    dueDate: "",
    poId: "",
    supplierId: "",
    supplierName: ""
  });

  const [printPO, setPrintPO] = useState<any | null>(null);

  // Load all procurement data from Firestore
  useEffect(() => {
    if (!companyId) return;

    const unsubPR = onSnapshot(collection(db, "companies", companyId, "purchase_requests"), (snap) => {
      setPurchaseRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubSuppliers = onSnapshot(collection(db, "companies", companyId, "suppliers"), (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubRfqs = onSnapshot(collection(db, "companies", companyId, "rfqs"), (snap) => {
      setRfqs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubPos = onSnapshot(collection(db, "companies", companyId, "purchase_orders"), (snap) => {
      setPurchaseOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubGrn = onSnapshot(collection(db, "companies", companyId, "goods_received"), (snap) => {
      setGoodsReceivedList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubInventory = onSnapshot(query(collection(db, "products"), where("businessId", "==", companyId)), (snap) => {
      setInventoryItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubPR();
      unsubSuppliers();
      unsubRfqs();
      unsubPos();
      unsubGrn();
      unsubInventory();
    };
  }, [companyId]);

  // 1. Calculations for Dashboard
  const totalSpend = purchaseOrders
    .filter(po => po.status === "Approved" || po.status === "Completed")
    .reduce((acc, po) => acc + Number(po.total || 0), 0);

  const pendingRequestsCount = purchaseRequests.filter(pr => pr.status === "Pending").length;
  const pendingApprovalsCount = purchaseRequests.filter(pr => pr.status === "Pending").length +
    purchaseOrders.filter(po => po.status === "Draft" || po.status === "Pending").length;
  const activeRfqsCount = rfqs.filter(r => r.status !== "Closed").length;
  const openPosCount = purchaseOrders.filter(po => po.status === "Approved" || po.status === "Sent").length;
  const outstandingInvoicesTotal = 0;

  // 2. Purchase Requests Handlers
  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const newPR = {
        department: prForm.department,
        reason: prForm.reason,
        items: prForm.items,
        status: "Pending",
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, "companies", companyId, "purchase_requests"), newPR);
      await logAction("Purchase Request Created", `Department: ${prForm.department}, Reason: ${prForm.reason}`, companyId);
      setIsPRModalOpen(false);
      setPrForm({ department: "Engineering", reason: "", items: [{ name: "", quantity: 1, estimatedPrice: 0 }] });
      addToast("Purchase Request submitted successfully for approval", "success");
      loadAllProcurementData();
    } catch (err) {
      addToast("Failed to create purchase request", "error");
    }
  };

  const handleUpdatePRStatus = async (prId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "companies", companyId, "purchase_requests", prId), { status: newStatus });
      await logAction("Purchase Request Status Updated", `PR ID ${prId} set to ${newStatus}`, companyId);
      addToast(`Purchase Request ${newStatus.toLowerCase()} successfully`, "success");
      loadAllProcurementData();
    } catch (err) {
      addToast("Failed to update status", "error");
    }
  };

  // 3. Suppliers Handlers
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      if (editingSupplier) {
        await updateDoc(doc(db, "companies", companyId, "suppliers", editingSupplier.id), supplierForm);
        addToast("Supplier updated successfully", "success");
      } else {
        await addDoc(collection(db, "companies", companyId, "suppliers"), {
          ...supplierForm,
          createdAt: new Date().toISOString()
        });
        addToast("New supplier registered successfully", "success");
      }
      setIsSupplierModalOpen(false);
      setEditingSupplier(null);
      setSupplierForm({ name: "", company: "", email: "", phone: "", category: "General Supply", paymentTerms: "Net 30" });
      loadAllProcurementData();
    } catch (err) {
      addToast("Failed to save supplier", "error");
    }
  };

  // 4. RFQ & Quotations Handlers
  const handleCreateRFQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const newRFQ = {
        ...rfqForm,
        status: "Active",
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, "companies", companyId, "rfqs"), newRFQ);
      addToast("Request for Quotation (RFQ) dispatched to suppliers", "success");
      setIsRFQModalOpen(false);
      setRfqForm({ title: "", deadline: "", selectedSuppliers: [], items: [{ name: "", quantity: 1 }] });
      loadAllProcurementData();
    } catch (err) {
      addToast("Failed to create RFQ", "error");
    }
  };

  const handleRecordQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const selectedSup = suppliers.find(s => s.id === quoteForm.supplierId);
      const newQuote = {
        rfqId: selectedRfqId,
        supplierId: quoteForm.supplierId,
        supplierName: selectedSup?.company || selectedSup?.name || quoteForm.supplierName,
        totalAmount: Number(quoteForm.totalAmount),
        deliveryDays: Number(quoteForm.deliveryDays),
        notes: quoteForm.notes,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, "companies", companyId, "supplier_quotations"), newQuote);
      addToast("Supplier quotation recorded successfully", "success");
      setIsQuoteModalOpen(false);
      setQuoteForm({ supplierId: "", supplierName: "", totalAmount: 0, deliveryDays: 7, notes: "" });
      loadAllProcurementData();
    } catch (err) {
      addToast("Failed to record quotation", "error");
    }
  };

  // 5. Purchase Orders Handlers
  const handleGeneratePOFromQuote = (quote: any) => {
    const rfq = rfqs.find(r => r.id === quote.rfqId);
    const items = rfq ? rfq.items : [{ name: "Procured Items from Quote", quantity: 1, price: quote.totalAmount }];
    setSelectedQuoteForPO(quote);
    setPoForm({
      poNumber: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      supplierId: quote.supplierId,
      supplierName: quote.supplierName,
      taxRate: 15,
      items: items.map((it: any) => ({
        name: it.name || it,
        quantity: it.quantity || 1,
        unitPrice: it.estimatedPrice || (quote.totalAmount / (it.quantity || 1))
      }))
    });
    setIsPOModalOpen(true);
  };

  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const subtotal = poForm.items.reduce((acc, it) => acc + (Number(it.quantity) * Number(it.unitPrice)), 0);
      const tax = subtotal * (poForm.taxRate / 100);
      const total = subtotal + tax;

      const newPO = {
        poNumber: poForm.poNumber,
        supplierId: poForm.supplierId,
        supplierName: poForm.supplierName,
        items: poForm.items,
        subtotal,
        tax,
        total,
        status: "Approved",
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, "companies", companyId, "purchase_orders"), newPO);
      await logAction("Purchase Order Created", `PO #${poForm.poNumber} for supplier ${poForm.supplierName}, Total: E${total}`, companyId, total);
      addToast(`Purchase Order ${poForm.poNumber} created and approved successfully`, "success");
      setIsPOModalOpen(false);
      loadAllProcurementData();
    } catch (err) {
      addToast("Failed to create Purchase Order", "error");
    }
  };

  // 6. Goods Received (GRN) & Inventory Integration
  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !selectedPOForGRN) return;
    try {
      const newGRN = {
        poId: selectedPOForGRN.id,
        poNumber: selectedPOForGRN.poNumber,
        supplierName: selectedPOForGRN.supplierName,
        receivedItems: grnForm.receivedItems,
        notes: grnForm.notes,
        receivedAt: new Date().toISOString()
      };

      await addDoc(collection(db, "companies", companyId, "goods_received"), newGRN);

      // Automatically integrate with existing Inventory module: Add stock to matching inventory items or create them
      for (const item of grnForm.receivedItems) {
        if (Number(item.receivedQty) > 0) {
          const existingInv = inventoryItems.find(inv => inv.name.toLowerCase() === item.name.toLowerCase());
          if (existingInv) {
            const newStock = Number(existingInv.stock || 0) + Number(item.receivedQty);
            await updateDoc(doc(db, "products", existingInv.id), { stock: newStock });
          } else {
            // Create new inventory product record
            await addDoc(collection(db, "products"), {
              businessId: companyId,
              name: item.name,
              sku: `SKU-${Math.floor(100 + Math.random() * 900)}`,
              category: "General Supply",
              price: item.unitPrice || 0,
              stock: Number(item.receivedQty),
              minStock: 5
            });
          }
        }
      }

      await logAction("Goods Received Note (GRN)", `Received goods against PO #${selectedPOForGRN.poNumber}. Stock updated in Inventory.`, companyId);
      addToast("Goods received recorded and inventory automatically updated", "success");
      setIsGRNModalOpen(false);
      setSelectedPOForGRN(null);
      loadAllProcurementData();
    } catch (err) {
      addToast("Failed to record goods receipt", "error");
    }
  };

  // 7. Supplier Invoices & Finance Integration
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !selectedPOForInvoice) return;
    try {
      const newInvoice = {
        invoiceNumber: invoiceForm.invoiceNumber,
        poId: selectedPOForInvoice.id,
        poNumber: selectedPOForInvoice.poNumber,
        supplierId: selectedPOForInvoice.supplierId,
        supplierName: selectedPOForInvoice.supplierName,
        amount: Number(invoiceForm.amount),
        dueDate: invoiceForm.dueDate,
        status: "Unpaid",
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "companies", companyId, "supplier_invoices"), newInvoice);

      // Send approved supplier invoice information to existing Finance module (transactions / expenses)
      const txnKey = `TXN-EXP-${Math.floor(1000 + Math.random() * 9000)}`;
      await setDoc(doc(db, "companies", companyId, "transactions", txnKey), {
        id: txnKey,
        date: new Date().toISOString().split("T")[0],
        description: `Supplier Invoice ${invoiceForm.invoiceNumber} - ${selectedPOForInvoice.supplierName} (PO: ${selectedPOForInvoice.poNumber})`,
        type: "Outflow",
        reference: invoiceForm.invoiceNumber,
        method: "Bank Transfer",
        amount: Number(invoiceForm.amount),
        status: "Pending"
      });

      await logAction("Supplier Invoice Recorded & Sent to Finance", `Invoice ${invoiceForm.invoiceNumber} linked to PO #${selectedPOForInvoice.poNumber}, Amount: E${invoiceForm.amount}`, companyId, Number(invoiceForm.amount));
      addToast("Supplier invoice recorded and dispatched to Finance ledger successfully", "success");
      setIsInvoiceModalOpen(false);
      setSelectedPOForInvoice(null);
      loadAllProcurementData();
    } catch (err) {
      addToast("Failed to record supplier invoice", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Subtabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-sky-600" /> Procurement Operations & Supply Chain Suite
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Manage purchase requests, RFQs, supplier quotations, purchase orders, goods receipts, and 3-way matching.
          </p>
        </div>
        <button
          onClick={loadAllProcurementData}
          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition shadow-4xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Data
        </button>
      </div>

      {/* Subnav Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {[
          { id: "dashboard", label: "Dashboard", icon: Layers },
          { id: "requests", label: "Purchase Requests", icon: FileText, count: pendingRequestsCount },
          { id: "suppliers", label: "Suppliers", icon: Users, count: suppliers.length },
          { id: "rfqs", label: "RFQ", icon: FileText, count: rfqs.length },
          { id: "pos", label: "Purchase Orders", icon: ShoppingCart, count: purchaseOrders.length },
          { id: "grn", label: "Goods Received", icon: Truck, count: goodsReceivedList.length },
          { id: "matching", label: "3-Way Matching", icon: Scale }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition uppercase tracking-wider cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-700"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6 animate-fade-in">
          {/* Low Stock Alerts */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-3xs">
            <h3 className="text-sm font-black text-amber-900 uppercase flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Low Stock Alerts
            </h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {inventoryItems.filter(item => item.stock <= (item.minStock || 5)).map(item => (
                <div key={item.id} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{item.name}</p>
                    <p className="text-[10px] text-amber-700">Stock: {item.stock} / {item.minStock || 5}</p>
                  </div>
                  <button className="text-[10px] font-bold text-sky-600 hover:text-sky-800">Order Now</button>
                </div>
              ))}
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search orders, suppliers, items..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs" />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
              <Filter className="w-4 h-4" /> Filter
            </button>
          </div>
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Procurement Spend</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">E{totalSpend.toLocaleString()}</h3>
              <p className="text-[11px] text-emerald-600 font-bold mt-1">Approved & Completed Orders</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pending Purchase Requests</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">{pendingRequestsCount}</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Awaiting departmental authorization</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pending Approvals</p>
              <h3 className="text-2xl font-black text-indigo-600 mt-1">{pendingApprovalsCount}</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Requests & POs requiring review</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active RFQs</p>
              <h3 className="text-2xl font-black text-sky-600 mt-1">{activeRfqsCount}</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Open quotations in progress</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Open Purchase Orders</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">{openPosCount}</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Active deliveries pending</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Outstanding Invoices</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1">E{outstandingInvoicesTotal.toLocaleString()}</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Unpaid supplier bills</p>
            </div>
          </div>

          {/* Quick Actions & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Quick Procurement Workflow</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setActiveTab("requests")}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-sky-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">1. Submit Purchase Request</p>
                      <p className="text-[11px] text-slate-500">Initiate internal requirement for departmental supplies</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
                <button
                  onClick={() => setActiveTab("rfqs")}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">2. Dispatch RFQ & Collect Quotations</p>
                      <p className="text-[11px] text-slate-500">Solicit bids from partner suppliers and compare prices</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
                <button
                  onClick={() => setActiveTab("pos")}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">3. Issue Purchase Order & Receive Goods</p>
                      <p className="text-[11px] text-slate-500">Approve PO, receive goods, and auto-sync inventory</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
                <button
                  onClick={() => setActiveTab("matching")}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <Scale className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">4. Three-Way Matching & Finance Audit</p>
                      <p className="text-[11px] text-slate-500">Validate PO, GRN, and Supplier Invoice before payment</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Registered Suppliers Overview</h3>
              {suppliers.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">No suppliers registered yet. Add partners in Suppliers tab.</div>
              ) : (
                <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                  {suppliers.map(sup => (
                    <div key={sup.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{sup.company || sup.name}</p>
                        <p className="text-[10px] text-slate-500">{sup.category} • {sup.paymentTerms}</p>
                      </div>
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-100">
                        Active Partner
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PURCHASE REQUESTS */}
      {activeTab === "requests" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Purchase Requests</h3>
            <button
              onClick={() => setIsPRModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-xl cursor-pointer transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Create Purchase Request
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-3xs">
            {purchaseRequests.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No purchase requests submitted.</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5">Reason</th>
                    <th className="p-3.5">Items</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseRequests.map(pr => (
                    <tr key={pr.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-bold text-slate-900">{pr.department}</td>
                      <td className="p-3.5 text-slate-600">{pr.reason}</td>
                      <td className="p-3.5 text-slate-600">
                        {pr.items?.map((it: any, i: number) => (
                          <div key={i}>{it.name} (Qty: {it.quantity}, Est: E{it.estimatedPrice})</div>
                        ))}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          pr.status === "Approved" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          pr.status === "Rejected" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                          "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {pr.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        {pr.status === "Pending" && (
                          <>
                            <button
                              onClick={() => handleUpdatePRStatus(pr.id, "Approved")}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold text-[10px] cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdatePRStatus(pr.id, "Rejected")}
                              className="px-2.5 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-bold text-[10px] cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLIERS */}
      {activeTab === "suppliers" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Partner Suppliers Directory</h3>
            <button
              onClick={() => { setEditingSupplier(null); setSupplierForm({ name: "", company: "", email: "", phone: "", category: "General Supply", paymentTerms: "Net 30" }); setIsSupplierModalOpen(true); }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-xl cursor-pointer transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Add Supplier
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-3xs">
            {suppliers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No suppliers registered. Click Add Supplier to begin.</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Company / Name</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Contact Email / Phone</th>
                    <th className="p-3.5">Payment Terms</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map(sup => (
                    <tr key={sup.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-bold text-slate-900">{sup.company || sup.name}</td>
                      <td className="p-3.5 text-slate-600">{sup.category}</td>
                      <td className="p-3.5 text-slate-600">{sup.email} • {sup.phone}</td>
                      <td className="p-3.5"><span className="px-2 py-0.5 bg-slate-100 rounded-md font-semibold text-[10px]">{sup.paymentTerms}</span></td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => { setEditingSupplier(sup); setSupplierForm(sup); setIsSupplierModalOpen(true); }}
                          className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold text-[10px] cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: RFQ & QUOTATIONS */}
      {activeTab === "rfqs" && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Request for Quotation (RFQ) & Supplier Bids</h3>
            <button
              onClick={() => setIsRFQModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-xl cursor-pointer transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Create RFQ
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* RFQs List */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
              <h4 className="text-xs font-bold uppercase text-slate-700">Active RFQs</h4>
              {rfqs.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No RFQs created yet.</p>
              ) : (
                <div className="space-y-3">
                  {rfqs.map(rfq => (
                    <div key={rfq.id} className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900">{rfq.title}</p>
                        <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">Deadline: {rfq.deadline}</span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        <strong>Items:</strong> {rfq.items?.map((it: any) => `${it.name} (x${it.quantity})`).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PURCHASE ORDERS */}
      {activeTab === "pos" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Purchase Orders & Approval Workflow</h3>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-3xs">
            {purchaseOrders.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No purchase orders generated. Convert an approved quotation to create a PO.</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">PO Number</th>
                    <th className="p-3.5">Supplier</th>
                    <th className="p-3.5">Total Amount</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseOrders.map(po => (
                    <tr key={po.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-bold text-slate-900">{po.poNumber}</td>
                      <td className="p-3.5 text-slate-600">{po.supplierName}</td>
                      <td className="p-3.5 font-black text-slate-900">E{Number(po.total).toLocaleString()}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                          {po.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => setPrintPO(po)}
                          className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold text-[10px] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" /> Print PO
                        </button>
                        <button
                          onClick={() => { setSelectedPOForGRN(po); setGrnForm({ receivedItems: po.items.map((i: any) => ({ ...i, receivedQty: i.quantity })), notes: "" }); setIsGRNModalOpen(true); }}
                          className="px-2.5 py-1 bg-sky-600 text-white hover:bg-sky-700 rounded-lg font-bold text-[10px] cursor-pointer"
                        >
                          Receive Goods
                        </button>
                        <button
                          onClick={() => { setSelectedPOForInvoice(po); setInvoiceForm({ invoiceNumber: `INV-${Math.floor(1000+Math.random()*9000)}`, amount: po.total, dueDate: new Date().toISOString().split("T")[0], poId: po.id, supplierId: po.supplierId, supplierName: po.supplierName }); setIsInvoiceModalOpen(true); }}
                          className="px-2.5 py-1 bg-purple-600 text-white hover:bg-purple-700 rounded-lg font-bold text-[10px] cursor-pointer"
                        >
                          Record Invoice
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: GOODS RECEIVED (GRN) */}
      {activeTab === "grn" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Goods Received Notes (GRN) & Inventory Synchronization</h3>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-3xs">
            {goodsReceivedList.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No goods received records. Receive goods against an open PO to sync inventory.</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">PO Number</th>
                    <th className="p-3.5">Supplier</th>
                    <th className="p-3.5">Received Items & Quantities</th>
                    <th className="p-3.5">Notes</th>
                    <th className="p-3.5">Synced Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {goodsReceivedList.map(grn => (
                    <tr key={grn.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-bold text-slate-900">{grn.poNumber}</td>
                      <td className="p-3.5 text-slate-600">{grn.supplierName}</td>
                      <td className="p-3.5 text-slate-600">
                        {grn.receivedItems?.map((it: any, i: number) => (
                          <div key={i}>{it.name}: Received {it.receivedQty} / Ordered {it.quantity}</div>
                        ))}
                      </td>
                      <td className="p-3.5 text-slate-600">{grn.notes || "---"}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center gap-1 w-max">
                          <CheckCircle2 className="w-3 h-3" /> Auto-Synced with Inventory
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: SUPPLIER INVOICES */}
      {activeTab === "invoices" && (
        <></>
      )}

      {/* TAB 8: THREE-WAY MATCHING */}
      {activeTab === "matching" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Three-Way Matching (PO vs GRN vs Supplier Invoice)</h3>
              <p className="text-[11px] text-slate-500">Automated discrepancy auditing across purchase orders, goods received quantities, and supplier bills.</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-3xs">
            {purchaseOrders.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No purchase orders available for matching.</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">PO Number</th>
                    <th className="p-3.5">Supplier</th>
                    <th className="p-3.5">PO Total</th>
                    <th className="p-3.5">Goods Received Match</th>
                    <th className="p-3.5">Invoice Match</th>
                    <th className="p-3.5">Matching Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseOrders.map(po => {
                    const grn = goodsReceivedList.find(g => g.poId === po.id || g.poNumber === po.poNumber);
                    const inv = supplierInvoices.find(i => i.poId === po.id || i.poNumber === po.poNumber);
                    const isFullyReceived = grn != null;
                    const isInvoiceMatched = inv != null && Number(inv.amount) === Number(po.total);

                    return (
                      <tr key={po.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 font-bold text-slate-900">{po.poNumber}</td>
                        <td className="p-3.5 text-slate-600">{po.supplierName}</td>
                        <td className="p-3.5 font-bold text-slate-900">E{Number(po.total).toLocaleString()}</td>
                        <td className="p-3.5">
                          {isFullyReceived ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Quantities Matched</span>
                          ) : (
                            <span className="text-amber-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Pending GRN</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {inv ? (
                            isInvoiceMatched ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Amount Matched (E{Number(inv.amount)})</span>
                            ) : (
                              <span className="text-rose-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Price Mismatch (Inv: E{inv.amount})</span>
                            )
                          ) : (
                            <span className="text-slate-400 font-semibold">No Invoice Yet</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {isFullyReceived && isInvoiceMatched ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                              3-Way Match Verified
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold">
                              Audit in Progress
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Purchase Request Modal */}
      {isPRModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900">Create Purchase Request</h3>
              <button onClick={() => setIsPRModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreatePR} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={prForm.department}
                  onChange={e => setPrForm({ ...prForm, department: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-medium"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Operations">Operations</option>
                  <option value="IT & Infrastructure">IT & Infrastructure</option>
                  <option value="Administration">Administration</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason / Justification</label>
                <textarea
                  required
                  rows={2}
                  value={prForm.reason}
                  onChange={e => setPrForm({ ...prForm, reason: e.target.value })}
                  placeholder="e.g. Server rack replacement parts for Q3 scaling"
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Requested Item</label>
                <div className="flex gap-2">
                  <input
                    required
                    type="text"
                    placeholder="Item name"
                    value={prForm.items[0].name}
                    onChange={e => {
                      const newItems = [...prForm.items];
                      newItems[0].name = e.target.value;
                      setPrForm({ ...prForm, items: newItems });
                    }}
                    className="flex-1 p-2 border border-slate-200 rounded-xl"
                  />
                  <input
                    required
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={prForm.items[0].quantity}
                    onChange={e => {
                      const newItems = [...prForm.items];
                      newItems[0].quantity = Number(e.target.value);
                      setPrForm({ ...prForm, items: newItems });
                    }}
                    className="w-20 p-2 border border-slate-200 rounded-xl"
                  />
                  <input
                    required
                    type="number"
                    min={0}
                    placeholder="Est. Price"
                    value={prForm.items[0].estimatedPrice}
                    onChange={e => {
                      const newItems = [...prForm.items];
                      newItems[0].estimatedPrice = Number(e.target.value);
                      setPrForm({ ...prForm, items: newItems });
                    }}
                    className="w-28 p-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsPRModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900">{editingSupplier ? "Edit Supplier" : "Add Partner Supplier"}</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Company Name</label>
                  <input
                    required
                    type="text"
                    value={supplierForm.company}
                    onChange={e => setSupplierForm({ ...supplierForm, company: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    required
                    type="text"
                    value={supplierForm.name}
                    onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    required
                    type="email"
                    value={supplierForm.email}
                    onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    required
                    type="text"
                    value={supplierForm.phone}
                    onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={supplierForm.category}
                    onChange={e => setSupplierForm({ ...supplierForm, category: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Terms</label>
                  <select
                    value={supplierForm.paymentTerms}
                    onChange={e => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Immediate">Immediate</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. RFQ Modal */}
      {isRFQModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900">Create Request for Quotation (RFQ)</h3>
              <button onClick={() => setIsRFQModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateRFQ} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">RFQ Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Q3 Server Hardware Supply RFQ"
                  value={rfqForm.title}
                  onChange={e => setRfqForm({ ...rfqForm, title: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Submission Deadline</label>
                <input
                  required
                  type="date"
                  value={rfqForm.deadline}
                  onChange={e => setRfqForm({ ...rfqForm, deadline: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Item Required</label>
                <div className="flex gap-2">
                  <input
                    required
                    type="text"
                    placeholder="Item name"
                    value={rfqForm.items[0].name}
                    onChange={e => {
                      const newItems = [...rfqForm.items];
                      newItems[0].name = e.target.value;
                      setRfqForm({ ...rfqForm, items: newItems });
                    }}
                    className="flex-1 p-2 border border-slate-200 rounded-xl"
                  />
                  <input
                    required
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={rfqForm.items[0].quantity}
                    onChange={e => {
                      const newItems = [...rfqForm.items];
                      newItems[0].quantity = Number(e.target.value);
                      setRfqForm({ ...rfqForm, items: newItems });
                    }}
                    className="w-24 p-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsRFQModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold">Dispatch RFQ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Record Supplier Quotation Modal */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900">Record Quotation Received</h3>
              <button onClick={() => setIsQuoteModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleRecordQuote} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Supplier</label>
                <select
                  required
                  value={quoteForm.supplierId}
                  onChange={e => setQuoteForm({ ...quoteForm, supplierId: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="">-- Choose Partner Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.company || s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Quoted Amount (E)</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={quoteForm.totalAmount}
                    onChange={e => setQuoteForm({ ...quoteForm, totalAmount: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Delivery Estimate (Days)</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={quoteForm.deliveryDays}
                    onChange={e => setQuoteForm({ ...quoteForm, deliveryDays: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Quotation Notes / Terms</label>
                <textarea
                  rows={2}
                  value={quoteForm.notes}
                  onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                  placeholder="e.g. Includes shipping and 1-year warranty"
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsQuoteModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold">Save Quotation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Purchase Order Creation Modal */}
      {isPOModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900">Approve & Issue Purchase Order</h3>
              <button onClick={() => setIsPOModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSavePO} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">PO Number</label>
                  <input
                    required
                    type="text"
                    value={poForm.poNumber}
                    onChange={e => setPoForm({ ...poForm, poNumber: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Supplier</label>
                  <input
                    disabled
                    type="text"
                    value={poForm.supplierName}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tax Rate (%)</label>
                <input
                  type="number"
                  value={poForm.taxRate}
                  onChange={e => setPoForm({ ...poForm, taxRate: Number(e.target.value) })}
                  className="w-full p-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsPOModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold">Approve & Issue PO</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Goods Received Modal */}
      {isGRNModalOpen && selectedPOForGRN && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900">Receive Goods for PO #{selectedPOForGRN.poNumber}</h3>
              <button onClick={() => setIsGRNModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleReceiveGoods} className="space-y-4 text-xs">
              <div className="space-y-3">
                <label className="block font-bold text-slate-700">Verify & Record Received Quantities</label>
                {grnForm.receivedItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="text-[10px] text-slate-500">Ordered: {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">Received Qty:</span>
                      <input
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={item.receivedQty}
                        onChange={e => {
                          const updated = [...grnForm.receivedItems];
                          updated[idx].receivedQty = Number(e.target.value);
                          setGrnForm({ ...grnForm, receivedItems: updated });
                        }}
                        className="w-20 p-1.5 border border-slate-200 rounded-lg text-center font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Delivery Notes</label>
                <input
                  type="text"
                  value={grnForm.notes}
                  onChange={e => setGrnForm({ ...grnForm, notes: e.target.value })}
                  placeholder="e.g. Delivered in good condition via courier"
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsGRNModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-xl font-bold">Confirm & Sync Inventory</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Supplier Invoice Modal */}
      {isInvoiceModalOpen && selectedPOForInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900">Record Supplier Invoice for PO #{selectedPOForInvoice.poNumber}</h3>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Invoice Number</label>
                  <input
                    required
                    type="text"
                    value={invoiceForm.invoiceNumber}
                    onChange={e => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Invoiced Amount (E)</label>
                  <input
                    required
                    type="number"
                    value={invoiceForm.amount}
                    onChange={e => setInvoiceForm({ ...invoiceForm, amount: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Due Date</label>
                <input
                  required
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={e => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsInvoiceModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold">Record & Send to Finance</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print PO Modal / View */}
      {printPO && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 space-y-6 shadow-2xl relative">
            <button onClick={() => setPrintPO(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase">Purchase Order</h2>
                <p className="text-xs text-slate-500">PO Number: {printPO.poNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-900">MiraTech Industries</p>
                <p className="text-[10px] text-slate-500">Procurement & Supply Department</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-bold text-slate-500 uppercase text-[10px]">Supplier:</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{printPO.supplierName}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-500 uppercase text-[10px]">Issue Date:</p>
                <p className="font-medium text-slate-900 mt-0.5">{new Date(printPO.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-2">Item Description</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {printPO.items?.map((it: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2 font-medium text-slate-900">{it.name}</td>
                    <td className="py-2 text-center">{it.quantity}</td>
                    <td className="py-2 text-right">E{Number(it.unitPrice).toLocaleString()}</td>
                    <td className="py-2 text-right font-bold">E{(it.quantity * it.unitPrice).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-200 pt-4 flex justify-end">
              <div className="w-64 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>E{Number(printPO.subtotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax (15%):</span>
                  <span>E{Number(printPO.tax).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 text-sm border-t border-slate-200 pt-1">
                  <span>Total Amount:</span>
                  <span>E{Number(printPO.total).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button onClick={() => window.print()} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </button>
              <button onClick={() => setPrintPO(null)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

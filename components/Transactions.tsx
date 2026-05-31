"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Trash2, Edit, X, ArrowUpRight, ArrowDownLeft, FileSpreadsheet, Download, Calendar, Settings, DollarSign, Wallet2, CheckCircle, AlertCircle } from "lucide-react";
import { auth, db, handleFirestoreError, OperationType, isOfflineError } from "../lib/firebase";
import { collection, doc, addDoc, getDocs, deleteDoc, getDoc, query, setDoc } from "firebase/firestore";
import { useUserStore } from "../lib/store";
import { logAction } from "../lib/audit";

interface Transaction {
  id: string;
  date: string;
  description: string;
  type: "Inflow" | "Outflow";
  reference: string;
  method: string;
  amount: number;
  status: "Settled" | "Pending";
}

export default function Transactions() {
  const { currentUser } = useUserStore();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Form Fields
  const [id, setId] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"Inflow" | "Outflow">("Inflow");
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState("Bank Transfer");
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState<"Settled" | "Pending">("Settled");

  useEffect(() => {
    async function loadBusiness() {
      const user = auth.currentUser;
      if (!user) return;
      const cached = currentUser?.companyId || currentUser?.businessId;
      if (cached) {
        setBusinessId(cached);
      } else {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        setBusinessId(userDoc.data()?.businessId || userDoc.data()?.companyId || user.uid);
      }
    }
    loadBusiness();
  }, [currentUser]);

  const loadTransactions = async () => {
    if (!businessId) return;
    setLoading(true);
    const colRef = collection(db, "companies", businessId, "transactions");
    try {
      const snapshot = await getDocs(colRef);
      let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      
      if (data.length === 0) {
        // Seed initial transactions in FireStore database so it does not start blank
        const initial: Transaction[] = [
          { id: "TXN-101", date: "2026-05-18", description: "Invoice Settlement Apex Systems", type: "Inflow", reference: "INV-0128", method: "Bank Transfer", amount: 4750.00, status: "Settled" },
          { id: "TXN-102", date: "2026-05-19", description: "Office Space Outlay & Sublets", type: "Outflow", reference: "EXP-9501", method: "ACH Direct Debit", amount: 1500.00, status: "Settled" },
          { id: "TXN-103", date: "2026-05-20", description: "Deposit Core Hardware Sales Innovate", type: "Inflow", reference: "INV-0129", method: "Credit Card", amount: 8500.00, status: "Settled" },
          { id: "TXN-104", date: "2026-05-20", description: "Broadband Optical Subscriptions", type: "Outflow", reference: "EXP-9502", method: "Credit Card", amount: 115.00, status: "Settled" },
          { id: "TXN-105", date: "2026-05-21", description: "Deposit NextGen Quotation Escrow", type: "Inflow", reference: "QTY-5082", method: "Bank Transfer", amount: 350.00, status: "Pending" },
        ];
        
        for (const tx of initial) {
          await setDoc(doc(db, "companies", businessId, "transactions", tx.id), tx);
        }
        data = initial;
      }

      setTxns(data);
      localStorage.setItem(`miratech_transactions_${businessId}`, JSON.stringify(data));
    } catch (err) {
      if (isOfflineError(err)) {
        console.warn("[Transactions Workspace Cache Mode] Error loading, loading from local cache fallback.");
        const cached = localStorage.getItem(`miratech_transactions_${businessId}`);
        if (cached) setTxns(JSON.parse(cached));
      } else {
        handleFirestoreError(err, OperationType.LIST, `companies/${businessId}/transactions`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) {
      loadTransactions();
    }
  }, [businessId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || amount <= 0) return alert("Please specify description and positive amount.");
    if (!businessId) return;

    const newTxKey = id || `TXN-${String(Date.now()).substring(7)}`;
    const newTx: Transaction = {
      id: newTxKey,
      date: date || new Date().toISOString().split("T")[0],
      description,
      type,
      reference: reference || "---",
      method,
      amount: Number(amount),
      status,
    };

    try {
      // 1. Save to Firestore
      await setDoc(doc(db, "companies", businessId, "transactions", newTxKey), newTx);

      // 2. Audit Trail logging
      await logAction(
        "Ledger Transaction Logged",
        `Created transaction ${newTxKey} of type ${type} with value $${amount}. Ref: ${reference || "N/A"}.`,
        businessId,
        amount
      );

      resetForm();
      setIsOpen(false);
      await loadTransactions();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `companies/${businessId}/transactions/${newTxKey}`);
    }
  };

  const resetForm = () => {
    setId("");
    setDate("");
    setDescription("");
    setType("Inflow");
    setReference("");
    setMethod("Bank Transfer");
    setAmount(0);
    setStatus("Settled");
  };

  const handleDelete = async (txid: string) => {
    if (!businessId) return;
    if (confirm("Remove this transaction row from secure database audits?")) {
      try {
        await deleteDoc(doc(db, "companies", businessId, "transactions", txid));
        
        // Audit log
        await logAction(
          "Ledger Transaction Extinguished",
          `Removed transaction record ID ${txid}.`,
          businessId
        );

        await loadTransactions();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `companies/${businessId}/transactions/${txid}`);
      }
    }
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Transaction ID,Date,Description,Type,Reference,Method,Amount,Status\n";
    txns.forEach((t) => {
      csvContent += `"${t.id}","${t.date}","${t.description}","${t.type}","${t.reference}","${t.method}",${t.amount},"${t.status}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MiraTech_Ledger_Transactions_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTxns = txns.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.reference.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "All" || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // KPI Calculations
  const grossInflow = txns.filter((t) => t.type === "Inflow" && t.status === "Settled").reduce((sum, t) => sum + t.amount, 0);
  const grossOutflow = txns.filter((t) => t.type === "Outflow" && t.status === "Settled").reduce((sum, t) => sum + t.amount, 0);
  const netCash = grossInflow - grossOutflow;

  return (
    <div className="space-y-4">
      {/* Upper Status Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Ledger & Transactions</h1>
          <p className="text-[11px] text-slate-500">Record payments cleared, operational outlays, and cash assets.</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-blue-105 text-blue-700 hover:bg-blue-50/50 rounded-md text-[11px] font-bold cursor-pointer shadow-3xs transition"
          >
            <Download className="h-3 w-3" /> Export Ledger CSV
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsOpen(true);
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-bold cursor-pointer shadow-3xs transition"
          >
            <Plus className="h-3.5 w-3.5" /> Log Payment
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Gross Inflow Cleared</p>
          <h3 className="text-base font-extrabold text-green-700 mt-1 font-mono">${grossInflow.toLocaleString()}</h3>
          <p className="text-[8px] text-green-500 font-semibold font-mono">Real-time revenue settlement</p>
        </div>
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Gross Outflow / Expenses</p>
          <h3 className="text-base font-extrabold text-red-600 mt-1 font-mono">-${grossOutflow.toLocaleString()}</h3>
          <p className="text-[8px] text-red-500 font-semibold font-mono">Operational outlays settled</p>
        </div>
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Net Position Capital</p>
          <h3 className="text-base font-extrabold text-blue-700 mt-1 font-mono">${netCash.toLocaleString()}</h3>
          <p className="text-[8px] text-blue-550 font-semibold font-mono">Consolidated liquid balance</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search details, description or reference ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-hidden"
          />
        </div>
        
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto">
          {["All", "Inflow", "Outflow"].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1 border rounded-md text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                typeFilter === type
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto bg-white border border-slate-200/80 rounded-lg shadow-3xs">
        <table className="high-density-table w-full text-left border-collapse">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date Settled</th>
              <th>Ledger Description</th>
              <th>Reference ID</th>
              <th>Payment Gate</th>
              <th>Audit State</th>
              <th className="text-right">Settled Amount</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 text-xs">
            {filteredTxns.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400 font-medium">
                  No payment ledger lines matching filters.
                </td>
              </tr>
            ) : (
              filteredTxns.map((t) => {
                const isIn = t.type === "Inflow";
                const isCleared = t.status === "Settled";
                return (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="font-mono font-bold text-slate-950">{t.id}</td>
                    <td className="font-mono text-slate-500 text-[11px] whitespace-nowrap">{t.date}</td>
                    <td className="font-bold text-slate-800 flex items-center gap-1.5 py-2">
                      {isIn ? (
                        <span className="p-0.5 bg-green-50 text-green-700 rounded-md border border-green-100">
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      ) : (
                        <span className="p-0.5 bg-red-50 text-red-700 rounded-md border border-red-100">
                          <ArrowDownLeft className="h-3 w-3" />
                        </span>
                      )}
                      <span>{t.description}</span>
                    </td>
                    <td className="font-mono text-[11px] text-blue-700 font-bold">{t.reference}</td>
                    <td>{t.method}</td>
                    <td>
                      {isCleared ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-150">
                          <CheckCircle className="h-2.5 w-2.5" /> Cleared
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-150">
                          <AlertCircle className="h-2.5 w-2.5" /> Escrow / Holds
                        </span>
                      )}
                    </td>
                    <td className={`font-mono font-extrabold text-right ${isIn ? "text-green-700" : "text-red-600"}`}>
                      {isIn ? "+" : "-"}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right py-1">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer transition inline-flex"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Creation Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-blue-905 uppercase tracking-wide">
                Log Ledger Payment
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Transaction ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="Auto ID"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Server procurement order - client Apex"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Flow Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "Inflow" | "Outflow")}
                    className="w-full font-bold"
                  >
                    <option value="Inflow" className="text-green-600 font-bold">Inflow (+) Revenue</option>
                    <option value="Outflow" className="text-red-500 font-bold">Outflow (-) Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full text-right font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reference ID</label>
                  <input
                    type="text"
                    placeholder="INV-002"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Settlement Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="ACH Direct Debit">ACH Direct Debit</option>
                    <option value="Cash Clearing">Cash Clearing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Settlement Audit Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "Settled" | "Pending")}
                  className="w-full"
                >
                  <option value="Settled">Cleared / Reconciled</option>
                  <option value="Pending">On Hold / Pending Validation</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-2.5 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-md font-bold text-[10px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-bold text-[10px]"
                >
                  Log Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

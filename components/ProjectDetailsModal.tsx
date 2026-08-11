"use client";

import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from "firebase/firestore";
import { useUserStore, useToastStore } from "../lib/store";
import { 
  X, Calendar, DollarSign, User, Briefcase, FileText, FileCheck, 
  Plus, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, AlertCircle, ExternalLink, Edit3 
} from "lucide-react";

interface ProjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  companyId: string;
  customers: any[];
  onOpenQuotationModal?: (project: any) => void;
  onOpenInvoiceModal?: (project: any) => void;
  onOpenReceiptModal?: (project: any) => void;
  onSelectClient?: (clientId: string) => void;
}

export default function ProjectDetailsModal({
  isOpen,
  onClose,
  project,
  companyId,
  customers,
  onOpenQuotationModal,
  onOpenInvoiceModal,
  onOpenReceiptModal,
  onSelectClient
}: ProjectDetailsModalProps) {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);

  const [quotations, setQuotations] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Edit project state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editBudget, setEditBudget] = useState(0);
  const [editPm, setEditPm] = useState("");
  const [editStatus, setEditStatus] = useState("planning");
  const [editPriority, setEditPriority] = useState("medium");

  useEffect(() => {
    if (!project || !companyId) return;
    setEditName(project.name || "");
    setEditDesc(project.description || "");
    setEditBudget(project.budget || 0);
    setEditPm(project.projectManager || "");
    setEditStatus(project.status || "planning");
    setEditPriority(project.priority || "medium");

    async function fetchProjectDocs() {
      setLoadingDocs(true);
      try {
        // Fetch Quotations
        const qSnap = await getDocs(collection(db, "companies", companyId, "quotations"));
        const qList: any[] = [];
        qSnap.forEach(d => {
          const data = d.data();
          if (data.projectId === project.id || data.clientName === matchedClient?.name) {
            qList.push({ id: d.id, ...data });
          }
        });
        setQuotations(qList);

        // Fetch Invoices
        const iSnap = await getDocs(collection(db, "companies", companyId, "invoices"));
        const iList: any[] = [];
        iSnap.forEach(d => {
          const data = d.data();
          if (data.projectId === project.id || data.clientName === matchedClient?.name) {
            iList.push({ id: d.id, ...data });
          }
        });
        setInvoices(iList);

        // Fetch Receipts
        const rSnap = await getDocs(collection(db, "companies", companyId, "receipts"));
        const rList: any[] = [];
        rSnap.forEach(d => {
          const data = d.data();
          if (data.projectId === project.id || data.clientName === matchedClient?.name) {
            rList.push({ id: d.id, ...data });
          }
        });
        setReceipts(rList);
      } catch (err) {
        console.error("Failed to load project documents:", err);
      } finally {
        setLoadingDocs(false);
      }
    }
    fetchProjectDocs();
  }, [project, companyId]);

  if (!isOpen || !project) return null;

  const matchedClient = customers.find(c => c.id === project.clientId);

  // Financial calculations
  const totalQuoted = quotations.reduce((sum, q) => sum + (Number(q.total) || 0), 0);
  const totalInvoiced = invoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
  const totalPaid = receipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const outstandingAmount = Math.max(0, totalInvoiced - totalPaid);
  const projectExpenses = Number(project.expenses) || Number(project.allocatedFunds) || 0;
  const netProjectValue = totalPaid - projectExpenses;

  // Transaction history compilation (Chronological)
  const transactions: any[] = [];
  if (project.createdAt) {
    transactions.push({
      date: project.createdAt,
      type: "Project Created",
      reference: project.projectReference || `PRJ-${project.id.substring(0, 6)}`,
      amount: project.budget || 0,
      description: `Project initialized: ${project.name}`
    });
  }
  quotations.forEach(q => {
    transactions.push({
      date: q.date || project.createdAt,
      type: "Quotation Created",
      reference: `QT-${q.number}`,
      amount: q.total || 0,
      description: `Quotation issued for ${matchedClient?.name || 'Client'}`
    });
  });
  invoices.forEach(i => {
    transactions.push({
      date: i.date || project.createdAt,
      type: "Invoice Issued",
      reference: `INV-${i.number}`,
      amount: i.total || 0,
      description: `Invoice billed for project execution`
    });
  });
  receipts.forEach(r => {
    transactions.push({
      date: r.date || project.createdAt,
      type: "Payment Received",
      reference: `REC-${r.number}`,
      amount: r.amount || 0,
      description: `Payment collected via ${r.paymentMethod || 'Bank Transfer'}`
    });
  });

  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "companies", companyId, "projects", project.id), {
        name: editName.trim(),
        description: editDesc.trim(),
        budget: Number(editBudget) || 0,
        projectManager: editPm.trim(),
        status: editStatus,
        priority: editPriority
      });
      addToast("Project updated successfully!", "success");
      setIsEditing(false);
    } catch (err: any) {
      addToast("Failed to update project: " + err.message, "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 max-w-4xl w-full overflow-hidden flex flex-col my-8 max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                {project.projectReference || `PRJ-${project.id.substring(0, 8)}`}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                {project.status || 'Active'}
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900 tracking-tight mt-1">{project.name}</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-left">
          
          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap gap-2.5 items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-150">
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => onOpenQuotationModal && onOpenQuotationModal(project)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create Quotation
              </button>
              <button 
                onClick={() => onOpenInvoiceModal && onOpenInvoiceModal(project)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create Invoice
              </button>
              <button 
                onClick={() => onOpenReceiptModal && onOpenReceiptModal(project)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create Receipt
              </button>
            </div>

            <div className="flex gap-2">
              {matchedClient && onSelectClient && (
                <button 
                  onClick={() => onSelectClient(matchedClient.id)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" /> View Client ({matchedClient.name})
                </button>
              )}
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" /> {isEditing ? "Cancel Edit" : "Edit Project"}
              </button>
            </div>
          </div>

          {/* Edit Form (if toggled) */}
          {isEditing && (
            <form onSubmit={handleSaveEdit} className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-3">
              <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide">Edit Project Parameters</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Project Name</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-1.5 bg-white border rounded-xl text-xs" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Project Budget ($)</label>
                  <input type="number" value={editBudget} onChange={e => setEditBudget(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white border rounded-xl text-xs" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Project Manager</label>
                  <input type="text" value={editPm} onChange={e => setEditPm(e.target.value)} className="w-full px-3 py-1.5 bg-white border rounded-xl text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Status</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full px-3 py-1.5 bg-white border rounded-xl text-xs">
                    <option value="planning">Planning</option>
                    <option value="active">Active Execution</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs">Save Changes</button>
            </form>
          )}

          {/* Project Financial Summary */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" /> Project Financial Summary & Ledger
            </h4>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-slate-50 border rounded-2xl p-3 text-center">
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Budget</span>
                <span className="text-sm font-black text-slate-900 font-mono">${(project.budget || 0).toLocaleString()}</span>
              </div>
              <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3 text-center">
                <span className="block text-[9px] font-bold text-blue-600 uppercase">Total Quoted</span>
                <span className="text-sm font-black text-blue-800 font-mono">${totalQuoted.toLocaleString()}</span>
              </div>
              <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-3 text-center">
                <span className="block text-[9px] font-bold text-amber-600 uppercase">Total Invoiced</span>
                <span className="text-sm font-black text-amber-800 font-mono">${totalInvoiced.toLocaleString()}</span>
              </div>
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3 text-center">
                <span className="block text-[9px] font-bold text-emerald-600 uppercase">Total Paid</span>
                <span className="text-sm font-black text-emerald-700 font-mono">${totalPaid.toLocaleString()}</span>
              </div>
              <div className="bg-orange-50/60 border border-orange-100 rounded-2xl p-3 text-center">
                <span className="block text-[9px] font-bold text-orange-600 uppercase">Outstanding</span>
                <span className="text-sm font-black text-orange-700 font-mono">${outstandingAmount.toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 border rounded-2xl p-3 text-center">
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Expenses</span>
                <span className="text-sm font-black text-slate-700 font-mono">${projectExpenses.toLocaleString()}</span>
              </div>
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3 text-center">
                <span className="block text-[9px] font-bold text-indigo-600 uppercase">Net Value / Profit</span>
                <span className="text-sm font-black text-indigo-800 font-mono">${netProjectValue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Project Documents (Quotations, Invoices, Receipts) */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
              <FileText className="w-4 h-4 text-blue-600" /> Associated Documents & Records
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Quotations */}
              <div className="bg-slate-50 border rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700">Quotations ({quotations.length})</span>
                  <span className="text-[10px] font-mono text-blue-600 font-bold">${totalQuoted.toLocaleString()}</span>
                </div>
                {quotations.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No quotations linked yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {quotations.map(q => (
                      <div key={q.id} className="bg-white p-2 rounded-xl border text-[10px] flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-800">QT-{q.number}</span>
                          <span className="block text-slate-400">{q.date}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">${(q.total || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Invoices */}
              <div className="bg-slate-50 border rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700">Invoices ({invoices.length})</span>
                  <span className="text-[10px] font-mono text-amber-600 font-bold">${totalInvoiced.toLocaleString()}</span>
                </div>
                {invoices.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No invoices linked yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {invoices.map(i => (
                      <div key={i.id} className="bg-white p-2 rounded-xl border text-[10px] flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-800">INV-{i.number}</span>
                          <span className="block text-slate-400">{i.status}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">${(i.total || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Receipts */}
              <div className="bg-slate-50 border rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700">Receipts ({receipts.length})</span>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold">${totalPaid.toLocaleString()}</span>
                </div>
                {receipts.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No receipts or payments recorded yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {receipts.map(r => (
                      <div key={r.id} className="bg-white p-2 rounded-xl border text-[10px] flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-800">REC-{r.number}</span>
                          <span className="block text-slate-400">{r.paymentMethod}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700">${(r.amount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Project Transaction History */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
              <Clock className="w-4 h-4 text-purple-600" /> Chronological Project Activity & Financial History
            </h4>

            <div className="bg-slate-50 border rounded-2xl p-4 space-y-3 max-h-60 overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center">No activity recorded for this project.</p>
              ) : (
                transactions.map((tx, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 text-xs shadow-4xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                        {tx.type.includes("Payment") ? <FileCheck className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4 text-blue-600" />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          {tx.reference} <span className="text-[10px] font-normal text-slate-500">({tx.type})</span>
                        </div>
                        <p className="text-[10px] text-slate-500">{tx.description} • {tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-slate-900">${(tx.amount || 0).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

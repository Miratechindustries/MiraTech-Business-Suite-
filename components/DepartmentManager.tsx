"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useUserStore } from "../lib/store";
import { 
  Loader2, 
  CheckCircle, 
  Settings, 
  Users, 
  Coins, 
  BadgeDollarSign, 
  Box, 
  BarChart3, 
  ShieldCheck, 
  HeartHandshake, 
  FolderKanban, 
  ShoppingCart, 
  Layers, 
  Activity
} from "lucide-react";
import { logDepartmentActivity } from "../lib/department";

interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
}

const ALL_MODULES: ModuleConfig[] = [
  { id: "hr", name: "HR & Payroll", description: "Manage company employees, compensation structures, and payslips.", icon: Users, color: "#10B981" },
  { id: "finance", name: "Finance & Accounting", description: "Track ledger cashflows, balances, receipts, and outflows.", icon: Coins, color: "#4F46E5" },
  { id: "sales", name: "Sales & CRM", description: "Administer client relationships, invoices, and quotation pipelines.", icon: BadgeDollarSign, color: "#3B82F6" },
  { id: "inventory", name: "Inventory Stock", description: "Review and organize physical corporate products, catalogs, and SKU reserves.", icon: Box, color: "#F59E0B" },
  { id: "reports", name: "Reports & Analytics", description: "Consolidated system performance, graphs, and performance sheets.", icon: BarChart3, color: "#8B5CF6" },
  { id: "audit", name: "Security Audit logs", description: "Log immutable ledger actions and compliance operations.", icon: ShieldCheck, color: "#64748B" },
  { id: "marketing", name: "Marketing", description: "Manage marketing campaigns and analytics.", icon: Activity, color: "#EC4899" },
  { id: "projects", name: "Projects & Tasks", description: "Track active milestones, task distributions, and sprint roadmaps.", icon: FolderKanban, color: "#06B6D4" },
  { id: "support", name: "Customer Support", description: "Process customer ticketing queues and review user grades.", icon: HeartHandshake, color: "#EC4899" },
  { id: "procurement", name: "Procurement", description: "Control partner suppliers and manage bulk purchase orders.", icon: ShoppingCart, color: "#0EA5E9" },
  { id: "pos", name: "POS System", description: "Manage walk-in sales and cash drawer operations.", icon: ShoppingCart, color: "#10B981" },
  { id: "administration", name: "Administration", description: "Manage system configurations, uptime, and critical keys.", icon: Settings, color: "#14B8A6" },
  { id: "executive", name: "Executive Lounge", description: "Review consolidated business KPIs and high-level strategic feed.", icon: Layers, color: "#F43F5E" }
];

export default function DepartmentManager() {
  const { currentUser } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const businessId = currentUser?.businessId;
  const isAdmin = currentUser?.role === "MASTER_ADMIN" || currentUser?.role === "BUSINESS_ADMIN";

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    async function fetchModules() {
      try {
        const companyRef = doc(db, "companies", businessId);
        const companySnap = await getDoc(companyRef);
        
        if (companySnap.exists()) {
          const compData = companySnap.data();
          const savedModules = compData.enabledModules || compData.modules || ALL_MODULES.map(m => m.id);
          setEnabledModules(savedModules);
        } else {
          // Default all enabled
          setEnabledModules(ALL_MODULES.map(m => m.id));
        }
      } catch (err) {
        console.error("Error loading module parameters:", err);
        setError("Unable to retrieve module settings.");
      } finally {
        setLoading(false);
      }
    }

    fetchModules();
  }, [businessId]);

  const handleToggleModule = (moduleId: string) => {
    if (!isAdmin) return;
    setSuccess(false);
    
    setEnabledModules((prev) => 
      prev.includes(moduleId)
        ? prev.filter((m) => m !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleSaveModules = async () => {
    if (!businessId || !isAdmin) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const companyRef = doc(db, "companies", businessId);
      await updateDoc(companyRef, {
        enabledModules: enabledModules,
        modules: enabledModules // keep backward compat
      });

      // Log this action to the global/department activities feed
      await logDepartmentActivity(
        "administration",
        "Department Modules Configured",
        `Enabled modules: ${enabledModules.map(m => m.toUpperCase()).join(", ")}`,
        businessId
      );

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving module configurations:", err);
      setError("Failed to synchronize module definitions to the cloud.");
      handleFirestoreError(err, OperationType.UPDATE, `companies/${businessId}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-2">
        <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Syncing modules...</span>
      </div>
    );
  }

  return (
    <div id="department-manager-card" className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden max-w-xl mx-auto mt-6 animate-fade-in">
      
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <Activity className="h-4.5 w-4.5 text-blue-600" />
          <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
            Organization Module Controls
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Selectively toggle departmental workspaces. Disabling a module removes its navigation tabs and enforces security gates for all non-master accounts.
        </p>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs font-semibold text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-semibold text-emerald-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> Module parameters synchronized successfully!
          </div>
        )}

        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
          {ALL_MODULES.map((mod) => {
            const Icon = mod.icon;
            const isChecked = enabledModules.includes(mod.id);
            return (
              <div 
                key={mod.id}
                onClick={() => handleToggleModule(mod.id)}
                className={`p-3.5 border rounded-xl flex items-start gap-3.5 transition cursor-pointer ${
                  isChecked 
                    ? "border-slate-350 bg-slate-50/40" 
                    : "border-slate-200 opacity-60 hover:opacity-80"
                } ${!isAdmin ? "pointer-events-none" : ""}`}
              >
                <div className="mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    disabled={!isAdmin}
                    className="h-4 w-4 text-indigo-600 border-slate-300 rounded-sm focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4 shrink-0" style={{ color: isChecked ? mod.color : "#94A3B8" }} />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{mod.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">{mod.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {isAdmin ? (
          <button
            onClick={handleSaveModules}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-900 disabled:opacity-50 text-xs uppercase tracking-wider cursor-pointer shadow-xs transition"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving parameters...
              </>
            ) : (
              "Apply Module Adjustments"
            )}
          </button>
        ) : (
          <p className="text-[10px] text-slate-400 font-semibold text-center italic">
            * Administrator clearance is required to toggle tenant parameters.
          </p>
        )}
      </div>
    </div>
  );
}

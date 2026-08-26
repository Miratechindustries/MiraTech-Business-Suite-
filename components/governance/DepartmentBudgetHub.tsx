"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { logAction } from "../../lib/audit";
import { DollarSign, ShieldAlert, CheckCircle2, AlertTriangle, PieChart, TrendingUp, Cpu, Save } from "lucide-react";

interface DepartmentBudgetHubProps {
  companyId: string;
  currentUser: any;
}

interface BudgetRecord {
  departmentId: string;
  departmentName: string;
  monthlyLimit: number;
  currentSpent: number;
  circuitBreakerActive: boolean;
}

export default function DepartmentBudgetHub({ companyId, currentUser }: DepartmentBudgetHubProps) {
  const [budgets, setBudgets] = useState<BudgetRecord[]>([
    { departmentId: "sales", departmentName: "Sales & CRM", monthlyLimit: 50000, currentSpent: 34200, circuitBreakerActive: true },
    { departmentId: "finance", departmentName: "Finance & Ledger", monthlyLimit: 120000, currentSpent: 112000, circuitBreakerActive: true },
    { departmentId: "hr", departmentName: "Human Resources & Payroll", monthlyLimit: 80000, currentSpent: 78500, circuitBreakerActive: true },
    { departmentId: "inventory", departmentName: "Inventory & Supply Chain", monthlyLimit: 150000, currentSpent: 98000, circuitBreakerActive: true },
    { departmentId: "it", departmentName: "IT & Engineering", monthlyLimit: 60000, currentSpent: 41000, circuitBreakerActive: true },
  ]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    getDoc(doc(db, "companies", companyId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.departmentBudgets && Array.isArray(data.departmentBudgets)) {
          setBudgets(data.departmentBudgets);
        }
      }
    });
  }, [companyId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleLimitChange = (deptId: string, newLimit: number) => {
    setBudgets(budgets.map(b => b.departmentId === deptId ? { ...b, monthlyLimit: Math.max(0, newLimit) } : b));
  };

  const handleToggleBreaker = (deptId: string) => {
    setBudgets(budgets.map(b => b.departmentId === deptId ? { ...b, circuitBreakerActive: !b.circuitBreakerActive } : b));
  };

  const handleSaveBudgets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "companies", companyId), {
        departmentBudgets: budgets,
        updatedAt: new Date().toISOString()
      });

      await logAction(
        companyId,
        currentUser?.id || "admin",
        currentUser?.email || "admin",
        "DEPARTMENT_BUDGETS_UPDATED",
        `Updated spending limits and circuit breakers across ${budgets.length} departmental cost centers.`,
        "finance",
        "HIGH"
      );

      showToast("Departmental budget spending caps successfully enforced!");
    } catch (err: any) {
      showToast("Failed to save budget caps.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-50 text-emerald-900 border border-emerald-200 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-xs">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Departmental Budget Enforcers & Spending Circuit Breakers
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Establish hard financial expenditure ceilings per department node. When a cost center hits 100% utilization, automated circuit breakers block further expense disbursements.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveBudgets} className="space-y-6 text-xs">
          <div className="space-y-4">
            {budgets.map((b) => {
              const pct = Math.min(100, Math.round((b.currentSpent / b.monthlyLimit) * 100) || 0);
              const isOver = b.currentSpent >= b.monthlyLimit;

              return (
                <div key={b.departmentId} className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">{b.departmentName}</h4>
                      <p className="text-[11px] text-slate-500">Current Spend: <span className="font-mono font-bold text-slate-800">${b.currentSpent.toLocaleString()}</span></p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Monthly Limit ($)
                        </label>
                        <input
                          type="number"
                          value={b.monthlyLimit}
                          onChange={(e) => handleLimitChange(b.departmentId, Number(e.target.value))}
                          className="w-36 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-black text-slate-900 text-right"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Circuit Breaker
                        </label>
                        <button
                          type="button"
                          onClick={() => handleToggleBreaker(b.departmentId)}
                          className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider cursor-pointer ${
                            b.circuitBreakerActive ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {b.circuitBreakerActive ? "Armed" : "Disarmed"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className={isOver ? "text-rose-600 font-black" : "text-slate-600"}>{pct}% Utilized</span>
                      <span className="font-mono text-slate-500">${(b.monthlyLimit - b.currentSpent).toLocaleString()} Remaining</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isOver ? "bg-rose-600" : pct > 85 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              {saving ? <Cpu className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Budget Enforcement Policies</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

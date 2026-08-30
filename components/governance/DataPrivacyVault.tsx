"use client";

import React, { useState } from "react";
import { auth } from "../../lib/firebase";
import { ShieldAlert, Trash2, Database, FileText, CheckCircle2, Lock, AlertOctagon, RefreshCw } from "lucide-react";

interface DataPrivacyVaultProps {
  companyId: string;
  currentUser: any;
}

export default function DataPrivacyVault({ companyId, currentUser }: DataPrivacyVaultProps) {
  const [targetEmail, setTargetEmail] = useState("");
  const [retentionDays, setRetentionDays] = useState(365);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleRightToForgotten = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail.trim() || !companyId) return;

    const confirmed = window.confirm(
      `CRITICAL PRIVACY ACTION:\n\nAre you sure you want to execute cryptographic PII anonymization (Right to be Forgotten under GDPR/POPIA) for employee/customer: ${targetEmail.trim()}?\n\nThis will scrub personal identifiers while preserving financial ledger audit non-repudiation hashes.`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Authentication session required.");
      }
      const token = await user.getIdToken();

      const res = await fetch("/api/governance/gdpr-anonymize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ companyId, targetEmail: targetEmail.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute server-side privacy erasure.");
      }

      showToast(data.message || `Successfully anonymized PII for ${targetEmail.trim()}.`);
      setTargetEmail("");
    } catch (err: any) {
      console.error("Privacy anonymization error:", err);
      showToast(err.message || "Failed to execute privacy erasure.");
    } finally {
      setLoading(false);
    }
  };

  const handlePruneAuditLogs = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to prune audit logs older than ${retentionDays} days in compliance with data retention policies?`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Authentication session required.");
      }
      const token = await user.getIdToken();

      const res = await fetch("/api/governance/prune-audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ companyId, retentionDays })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute server-side audit pruning.");
      }

      showToast(data.message || `Audit log retention policy executed successfully (${retentionDays} days threshold).`);
    } catch (err: any) {
      showToast(err.message || "Failed to execute audit pruning.");
    } finally {
      setLoading(false);
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
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                GDPR & POPIA Automated Compliance & Data Privacy Vault
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Execute cryptographic PII anonymization (Right to be Forgotten) and configure retention pruning without compromising financial audit ledgers.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Right to be Forgotten Box */}
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-black text-xs uppercase tracking-wider">
              <AlertOctagon className="w-4 h-4" /> Right to be Forgotten (Article 17 GDPR)
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Permanently scrub personal identifiable information (PII) for departed staff or customers while maintaining immutable non-repudiation hashes on financial transactions.
            </p>

            <form onSubmit={handleRightToForgotten} className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Subject Email to Anonymize
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. employee.departed@company.com"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Execute Cryptographic PII Scrub</span>
              </button>
            </form>
          </div>

          {/* Retention Pruning Box */}
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2 text-indigo-700 font-black text-xs uppercase tracking-wider">
              <Database className="w-4 h-4" /> Audit Log Retention & Pruning Policy
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Automatically purge non-essential operational event logs exceeding statutory retention timeframes while safeguarding immutable financial ledgers.
            </p>

            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Retention Window
                </label>
                <select
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value={90}>90 Days (Quarterly Audit)</option>
                  <option value={180}>180 Days (Semi-Annual)</option>
                  <option value={365}>365 Days (Annual Compliance)</option>
                  <option value={730}>730 Days (2-Year Statutory)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handlePruneAuditLogs}
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Prune Historical Logs</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

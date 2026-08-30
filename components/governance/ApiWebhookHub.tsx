"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { logAction } from "../../lib/audit";
import { Terminal, Key, Webhook, Plus, Trash2, Copy, CheckCircle2, Cpu, ShieldCheck } from "lucide-react";

interface ApiWebhookHubProps {
  companyId: string;
  currentUser: any;
}

interface ApiKeyRecord {
  id: string;
  name: string;
  key: string;
  scope: string;
  createdAt: string;
}

interface WebhookRecord {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

export default function ApiWebhookHub({ companyId, currentUser }: ApiWebhookHubProps) {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScope, setNewKeyScope] = useState("full_sync");

  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    getDoc(doc(db, "companies", companyId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.apiKeys) setApiKeys(data.apiKeys);
        if (data.webhooks) setWebhooks(data.webhooks);
      }
    });
  }, [companyId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleGenerateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !companyId) return;

    const generatedKey = `mira_live_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    const newRecord: ApiKeyRecord = {
      id: Math.random().toString(36).substring(2, 9),
      name: newKeyName.trim(),
      key: generatedKey,
      scope: newKeyScope,
      createdAt: new Date().toISOString()
    };

    const updated = [...apiKeys, newRecord];
    setApiKeys(updated);
    setNewKeyName("");

    try {
      await updateDoc(doc(db, "companies", companyId), { apiKeys: updated });
      await logAction(
        companyId,
        currentUser?.id || "admin",
        currentUser?.email || "admin",
        "API_KEY_GENERATED",
        `Generated new scoped API key: ${newRecord.name} (${newRecord.scope})`,
        "integration",
        "HIGH"
      );
      showToast(`API Key "${newRecord.name}" successfully generated! Copy it now.`);
    } catch (err) {
      showToast("Failed to save API key to database.");
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    const updated = apiKeys.filter(k => k.id !== id);
    setApiKeys(updated);
    try {
      await updateDoc(doc(db, "companies", companyId), { apiKeys: updated });
      await logAction(
        companyId,
        currentUser?.id || "admin",
        currentUser?.email || "admin",
        "API_KEY_REVOKED",
        `Revoked API key ID: ${id}`,
        "integration",
        "HIGH"
      );
      showToast("API Key revoked successfully.");
    } catch (err) {
      showToast("Failed to revoke API key.");
    }
  };

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookUrl.trim() || !companyId) return;

    const newRecord: WebhookRecord = {
      id: Math.random().toString(36).substring(2, 9),
      url: newWebhookUrl.trim(),
      events: ["invoice.created", "expense.approved", "payment.received"],
      active: true
    };

    const updated = [...webhooks, newRecord];
    setWebhooks(updated);
    setNewWebhookUrl("");

    try {
      await updateDoc(doc(db, "companies", companyId), { webhooks: updated });
      await logAction(
        companyId,
        currentUser?.id || "admin",
        currentUser?.email || "admin",
        "WEBHOOK_ENDPOINT_CONFIGURED",
        `Configured ERP webhook destination: ${newRecord.url}`,
        "integration",
        "MEDIUM"
      );
      showToast("Webhook endpoint successfully registered.");
    } catch (err) {
      showToast("Failed to register webhook endpoint.");
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    const updated = webhooks.filter(w => w.id !== id);
    setWebhooks(updated);
    try {
      await updateDoc(doc(db, "companies", companyId), { webhooks: updated });
      showToast("Webhook endpoint removed.");
    } catch (err) {
      showToast("Failed to remove webhook.");
    }
  };

  const handleCopyKey = (keyVal: string) => {
    navigator.clipboard.writeText(keyVal);
    showToast("API Key copied to clipboard!");
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
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200 shadow-xs">
              <Webhook className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                API Token & ERP Webhook Integration Hub
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Manage scoped API keys and outbound webhooks for real-time synchronization with QuickBooks, Xero, SAP, and custom ERP systems.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* API Keys Section */}
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-600" /> Scoped API Tokens
            </h3>

            <form onSubmit={handleGenerateApiKey} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Integration / Service Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QuickBooks ERP Sync"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Permission Scope
                </label>
                <select
                  value={newKeyScope}
                  onChange={(e) => setNewKeyScope(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold"
                >
                  <option value="full_sync">Full Enterprise Ledger Sync</option>
                  <option value="invoices_only">Invoices & Quotations Only</option>
                  <option value="expenses_only">Expense Approvals Only</option>
                  <option value="inventory_read">Inventory & POS Read-Only</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                <span>Generate API Key</span>
              </button>
            </form>

            <div className="space-y-2 pt-3 max-h-56 overflow-y-auto">
              {apiKeys.map((k) => (
                <div key={k.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-black text-slate-900 block">{k.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">{k.key.substring(0, 16)}...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyKey(k.key)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
                      title="Copy Full Key"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteApiKey(k.id)}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg text-rose-600"
                      title="Revoke Key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Webhooks Section */}
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Webhook className="w-4 h-4 text-indigo-600" /> Webhook Destinations
            </h3>

            <form onSubmit={handleAddWebhook} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  HTTPS Endpoint URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.mycompany.com/v1/webhooks"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Webhook</span>
                </button>
              </div>
            </form>

            <div className="space-y-2 pt-3 max-h-56 overflow-y-auto">
              {webhooks.map((w) => (
                <div key={w.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-slate-900 block truncate max-w-[220px]">{w.url}</span>
                    <span className="text-[10px] text-emerald-600 font-extrabold">Active (3 events)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteWebhook(w.id)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg text-rose-600"
                    title="Delete Webhook"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { logAction } from "../../lib/audit";
import { Shield, Key, Clock, Globe, ShieldCheck, AlertTriangle, CheckCircle2, Lock, Cpu, Server } from "lucide-react";

interface EnterpriseSecurityPanelProps {
  companyId: string;
  currentUser: any;
}

export default function EnterpriseSecurityPanel({ companyId, currentUser }: EnterpriseSecurityPanelProps) {
  const [mfaEnforced, setMfaEnforced] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);
  const [ssoProvider, setSsoProvider] = useState("azure_ad");
  const [ssoClientId, setSsoClientId] = useState("");
  const [ssoDomain, setSsoDomain] = useState("");
  const [allowedIpCidrs, setAllowedIpCidrs] = useState<string[]>(["192.168.1.0/24", "10.0.0.0/16"]);
  const [newCidr, setNewCidr] = useState("");
  const [geofenceCountries, setGeofenceCountries] = useState<string[]>(["ZA", "US", "GB"]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    getDoc(doc(db, "companies", companyId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.securitySettings) {
          setMfaEnforced(data.securitySettings.mfaEnforced ?? true);
          setSessionTimeoutMinutes(data.securitySettings.sessionTimeoutMinutes ?? 30);
          setSsoProvider(data.securitySettings.ssoProvider || "azure_ad");
          setSsoClientId(data.securitySettings.ssoClientId || "");
          setSsoDomain(data.securitySettings.ssoDomain || "");
          setAllowedIpCidrs(data.securitySettings.allowedIpCidrs || ["192.168.1.0/24"]);
          setGeofenceCountries(data.securitySettings.geofenceCountries || ["ZA", "US", "GB"]);
        }
      }
    });
  }, [companyId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    try {
      const securityPayload = {
        securitySettings: {
          mfaEnforced,
          sessionTimeoutMinutes,
          ssoProvider,
          ssoClientId,
          ssoDomain,
          allowedIpCidrs,
          geofenceCountries,
          updatedAt: new Date().toISOString()
        }
      };

      await updateDoc(doc(db, "companies", companyId), securityPayload);
      try {
        await updateDoc(doc(db, "businesses", companyId), securityPayload);
      } catch (err) {}

      await logAction(
        companyId,
        currentUser?.id || "admin",
        currentUser?.email || "admin",
        "ENTERPRISE_SECURITY_UPDATED",
        `Updated zero-trust security settings: MFA=${mfaEnforced}, Timeout=${sessionTimeoutMinutes}m, SSO=${ssoProvider}, IP Cidrs=${allowedIpCidrs.length}`,
        "security",
        "HIGH"
      );

      showToast("Enterprise Zero-Trust security policies successfully updated!");
    } catch (err: any) {
      console.error("Failed to save security settings:", err);
      showToast("Failed to save security configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCidr = () => {
    if (!newCidr.trim()) return;
    if (!allowedIpCidrs.includes(newCidr.trim())) {
      setAllowedIpCidrs([...allowedIpCidrs, newCidr.trim()]);
      setNewCidr("");
    }
  };

  const handleRemoveCidr = (cidr: string) => {
    setAllowedIpCidrs(allowedIpCidrs.filter(c => c !== cidr));
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
            <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Enterprise Identity, Zero-Trust & IP Perimeter Governance
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Enforce mandatory MFA, OIDC/SAML single sign-on, session revocation limits, and network CIDR geofencing.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveSecurity} className="space-y-6 text-xs">
          {/* Section 1: Authentication & Zero Trust */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" /> Authentication & MFA Policies
              </h3>

              <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={mfaEnforced}
                  onChange={(e) => setMfaEnforced(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-0"
                />
                <div>
                  <span className="font-black text-slate-900 block">Enforce Mandatory Multi-Factor Authentication (MFA)</span>
                  <span className="text-[11px] text-slate-500">Require all tenant personnel and department managers to authenticate via TOTP or Hardware Security Key (FIDO2).</span>
                </div>
              </label>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Session Inactivity Timeout (Minutes)
                </label>
                <select
                  value={sessionTimeoutMinutes}
                  onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value={15}>15 Minutes (High Security)</option>
                  <option value={30}>30 Minutes (Standard Corporate)</option>
                  <option value={60}>60 Minutes (Extended)</option>
                  <option value={120}>120 Minutes (Relaxed)</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-600" /> OIDC / SAML Identity Provider (SSO)
              </h3>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Corporate SSO Provider
                </label>
                <select
                  value={ssoProvider}
                  onChange={(e) => setSsoProvider(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value="azure_ad">Microsoft Azure Active Directory (Entra ID)</option>
                  <option value="google_workspace">Google Workspace SAML</option>
                  <option value="okta">Okta Enterprise Identity</option>
                  <option value="ping">Ping Identity</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  SSO Client ID / App ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 8f81a7bc-c40d-4b9e-91ef-..."
                  value={ssoClientId}
                  onChange={(e) => setSsoClientId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Authorized Domain (e.g. company.com)
                </label>
                <input
                  type="text"
                  placeholder="e.g. miratechindustries.com"
                  value={ssoDomain}
                  onChange={(e) => setSsoDomain(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Network Perimeters & IP Whitelisting */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-600" /> Network Perimeters & CIDR IP Whitelisting
            </h3>
            <p className="text-[11px] text-slate-500">
              Restrict administrative logins and financial approvals strictly to authorized corporate office subnetworks and VPN gateways.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. 196.25.14.0/24 or 41.78.0.0/16"
                value={newCidr}
                onChange={(e) => setNewCidr(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-mono"
              />
              <button
                type="button"
                onClick={handleAddCidr}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl uppercase tracking-wider cursor-pointer"
              >
                Add Subnet
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {allowedIpCidrs.map((cidr) => (
                <div key={cidr} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-mono text-[11px]">
                  <span>{cidr}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCidr(cidr)}
                    className="text-slate-400 hover:text-rose-600 font-bold"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              {saving && <Cpu className="w-4 h-4 animate-spin" />}
              <span>Save Security Policies</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

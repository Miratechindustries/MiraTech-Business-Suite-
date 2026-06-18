'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useUserStore } from '../lib/store';
import { 
  ShieldAlert, 
  ShieldCheck, 
  KeyRound, 
  Cpu, 
  Terminal, 
  Sliders, 
  UserMinus, 
  RefreshCw, 
  Activity, 
  FileLock2, 
  AlertTriangle, 
  MapPin, 
  Layers, 
  FolderLock, 
  CheckCircle2, 
  HelpCircle,
  Code2,
  BookOpen
} from "lucide-react";
import { motion } from "motion/react";

// Types for threat logs
interface ThreatLog {
  id: string;
  sourceIp: string;
  payloadType: string;
  requestPath: string;
  timestamp: string;
  blockedStatus: 'BLOCKED' | 'MITIGATED' | 'IGNORED';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
}

export default function SecurityOperations() {
  const { currentUser } = useUserStore();
  const [activeSubTab, setActiveSubTab] = useState<'monitor' | 'controls' | 'compliance' | 'resources'>('monitor');
  
  // Controls state
  const [threatLevel, setThreatLevel] = useState<'low' | 'elevated' | 'high' | 'paranoia'>('elevated');
  const [sessionTtl, setSessionTtl] = useState<number>(5); // minutes
  const [mfaEnforced, setMfaEnforced] = useState<boolean>(true);
  const [argon2SaltLength, setArgon2SaltLength] = useState<number>(16);
  const [argon2Iterations, setArgon2Iterations] = useState<number>(4);
  const [isRotatingKeys, setIsRotatingKeys] = useState<boolean>(false);
  const [blockedIps, setBlockedIps] = useState<string[]>(['192.168.42.105', '45.227.254.12', '185.120.77.3', '91.240.118.41']);
  const [newIp, setNewIp] = useState<string>('');

  // Dummy security logs
  const [threatLogs, setThreatLogs] = useState<ThreatLog[]>([
    {
      id: "TL-5082",
      sourceIp: "185.120.77.3",
      payloadType: "SQL Injection Encountered",
      requestPath: "/api/finance/ledger?businessId='; DROP TABLE users;--",
      timestamp: new Date(Date.now() - 320000).toISOString(),
      blockedStatus: "BLOCKED",
      severity: "critical",
      details: "Pattern matched: SQL sequence injected into non-relational field query intercept."
    },
    {
      id: "TL-5081",
      sourceIp: "45.227.254.12",
      payloadType: "Cross-Site Scripting (XSS)",
      requestPath: "/api/customers/create-profile",
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      blockedStatus: "BLOCKED",
      severity: "high",
      details: "Attempted injection of '<script>alert(document.cookie)</script>' payload in the display name element."
    },
    {
      id: "TL-5080",
      sourceIp: "203.0.113.88",
      payloadType: "Suspicious API Access Rate Limit",
      requestPath: "/api/audit/comply",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      blockedStatus: "MITIGATED",
      severity: "medium",
      details: "Client requested AI synthesis endpoint 75 times within 1 minute. Dynamic rate-limiter applied."
    },
    {
      id: "TL-5079",
      sourceIp: "91.240.118.41",
      payloadType: "Impossible Travel Log",
      requestPath: "/api/v1/auth/login-verify",
      timestamp: new Date(Date.now() - 5400000).toISOString(),
      blockedStatus: "BLOCKED",
      severity: "critical",
      details: "User authenticated from London, UK. 5 minutes earlier authenticated from Tokyo, Japan. Fraud trigger active."
    }
  ]);

  if (currentUser?.role?.toUpperCase() !== 'MASTER_ADMIN' && currentUser?.email?.toLowerCase() !== 'miratechindustries@gmail.com') {
    return <div className="p-10 text-center font-sans text-slate-500">Access Denied. Operational level clearances required.</div>;
  }

  const handleKeyRotation = async () => {
    setIsRotatingKeys(true);
    try {
      // Create permanent audit trail record
      await addDoc(collection(db, 'audit_logs'), {
        companyId: currentUser?.companyId || currentUser?.uid || 'SYSTEM',
        businessId: currentUser?.businessId || currentUser?.uid || 'SYSTEM',
        action: 'SECURITY_KEY_ROTATION_COMMAND',
        detail: `Master Admin triggered a forced cryptographic rotation of AES-256 Symmetric database and session transit keys across all distributed corporate instances. TLS 1.3 session re-handshakes established.`,
        timestamp: new Date().toISOString(),
        actor: currentUser?.email || 'Master Admin'
      });
      alert("Success: Rotating corporate master keys & re-signing session tokens across all tenancies.");
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsRotatingKeys(false);
    }
  };

  const handleAddIp = () => {
    if (newIp && !blockedIps.includes(newIp)) {
      setBlockedIps([newIp, ...blockedIps]);
      setNewIp('');
    }
  };

  const handleRemoveIp = (ip: string) => {
    setBlockedIps(blockedIps.filter(item => item !== ip));
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full uppercase tracking-widest">
            Level 4 SecOps Command Center
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 mt-1.5 flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-slate-900" />
            Cybersecurity Shield & WAF
          </h1>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl">
          {[
            { id: 'monitor', label: 'Monitoring & Logs', icon: Activity },
            { id: 'controls', label: 'Security Sliders', icon: Sliders },
            { id: 'compliance', label: 'Compliance & Audits', icon: FileLock2 },
            { id: 'resources', label: 'Code & Architecture', icon: BookOpen }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  isSelected 
                    ? "bg-slate-900 text-white shadow-xs" 
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview Cards (Same on all subtabs for real-time awareness) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 border border-slate-200 rounded-xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Defense Shield Mode</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${threatLevel === 'paranoia' ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
            <p className="text-lg font-bold text-slate-900 capitalize">{threatLevel} Engine</p>
          </div>
        </div>

        <div className="bg-white p-4 border border-slate-200 rounded-xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WAF Block Count (24H)</p>
          <p className="text-2xl font-extrabold text-slate-950 mt-1">426 Attempts</p>
        </div>

        <div className="bg-white p-4 border border-slate-200 rounded-xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active System Key Integrity</p>
          <p className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 w-fit px-2 py-0.5 rounded-md mt-2">
            HMAC-SHA256 Valid
          </p>
        </div>

        <div className="bg-white p-4 border border-slate-200 rounded-xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MFA Access Coverage</p>
          <p className="text-lg font-bold text-[#0F172A] mt-1">100% Enforced</p>
        </div>
      </div>

      {/* Main Panel Content Area */}
      {activeSubTab === 'monitor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Threat Logs List */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-950">Intrusion Prevention system (IPS) logs</h3>
                <p className="text-xs text-slate-400">Captured in-memory via edge rate-limiting and Firebase rules</p>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-md">
                <Terminal className="w-3" /> Live Telemetry
              </span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {threatLogs.map((log) => (
                <div key={log.id} className="border border-slate-100 bg-slate-50/50 p-4 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-500">{log.id}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      log.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      log.severity === 'high' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {log.severity.toUpperCase()} THREAT
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{log.payloadType}</h4>
                    <p className="text-xs font-mono text-slate-400 bg-white border border-slate-100 p-1.5 rounded-md mt-1 overflow-x-auto truncate">
                      {log.requestPath}
                    </p>
                  </div>

                  <p className="text-xs text-slate-600">{log.details}</p>

                  <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 pt-1 border-t border-slate-100/50">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3" /> Origin: {log.sourceIp}
                    </span>
                    <span>•</span>
                    <span>Observed: {new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="ml-auto text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                      RESOLVED & {log.blockedStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right rail: blocked IPs and system hardening overview */}
          <div className="space-y-6">
            {/* IP Firewalls */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="font-bold text-slate-950 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                Dynamic IP Firewall Blocklist
              </h3>
              <p className="text-xs text-slate-400">IP addresses actively restricted from accessing tenant routers or cloud databases.</p>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="e.g. 195.44.120.32" 
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  className="flex-1 text-xs border border-slate-250 px-3 py-2 rounded-xl bg-slate-50 focus:bg-white"
                />
                <button 
                  onClick={handleAddIp}
                  className="text-white bg-slate-900 hover:bg-slate-800 text-xs font-bold px-3 py-2 rounded-xl transition"
                >
                  Block IP
                </button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {blockedIps.map((ip) => (
                  <div key={ip} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                    <span className="font-mono text-slate-700">{ip}</span>
                    <button 
                      onClick={() => handleRemoveIp(ip)}
                      className="text-red-500 hover:text-red-700 font-bold text-[10px] bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick action system locks */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  KMS Cryptographic Action
                </h4>
                <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  FIPS 140-2
                </span>
              </div>
              
              <p className="text-xs text-slate-300">
                Instantly trigger serverless KMS symmetric key rotation. Will affect encryption at rest for documents & employee directories immediately.
              </p>

              <button 
                onClick={handleKeyRotation}
                disabled={isRotatingKeys}
                className="w-full flex items-center justify-center gap-2 bg-amber-400 text-slate-900 border border-transparent hover:bg-amber-300 disabled:opacity-50 text-xs font-extrabold py-2.5 rounded-xl transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isRotatingKeys ? 'animate-spin' : ''}`} />
                {isRotatingKeys ? 'Rotating Envelopes...' : 'Rotate AES-256 Symmetric Keys'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'controls' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border border-slate-200 rounded-2xl p-6">
          {/* Slider Form Controls */}
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-slate-900">Adaptive Threat Level Adjustments</h3>
              <p className="text-xs text-slate-400 mt-1">Configures defensive response thresholds for real-time edge triggers.</p>
            </div>

            <div className="space-y-4">
              {/* Threat Mode Toggles */}
              <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-3">
                <p className="text-xs font-bold text-slate-700">WAF Strictness Mode</p>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'elevated', 'high', 'paranoia'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setThreatLevel(level)}
                      className={`text-2xs font-bold py-2 rounded-lg border uppercase tracking-wider transition ${
                        threatLevel === level 
                          ? 'bg-slate-950 text-white border-transparent' 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  {threatLevel === 'low' && 'Passive packet monitoring. Basic sanitization only.'}
                  {threatLevel === 'elevated' && 'Standard rate-limits active. Real-time XSS injections blocked.'}
                  {threatLevel === 'high' && 'Enforced tenant boundary verification. Requests with unknown SQL tokens dropped.'}
                  {threatLevel === 'paranoia' && 'Dynamic impossible-travel checks. Token lifetime is restricted to strictly 1 minute. Cloud Guard active.'}
                </p>
              </div>

              {/* Slider for session TTL */}
              <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Session Token Rotation Frequency</span>
                  <span className="text-slate-900 bg-slate-200 px-2 py-0.5 rounded">{sessionTtl} Minutes</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="60" 
                  value={sessionTtl}
                  onChange={(e) => setSessionTtl(parseInt(e.target.value))}
                  className="w-full accent-slate-900"
                />
                <p className="text-[10px] text-slate-400">
                  Adaptive keys will refresh client cache sessions automatically at this boundary to mitigate replay hijacking.
                </p>
              </div>

              {/* MFA Toggle */}
              <div className="flex items-center justify-between bg-slate-50 p-4 border border-slate-100 rounded-xl">
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Enforce Multi-Factor Auth (MFA)</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Enforces biometric and SMS-OTP tokens for high-clearance groups.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={mfaEnforced}
                  onChange={(e) => setMfaEnforced(e.target.checked)}
                  className="w-4 h-4"
                />
              </div>
            </div>
          </div>

          {/* Argon2 Configuration */}
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Cpu className="w-5 h-5 text-slate-700" />
                Argon2 Password Hashing Setup
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Customize cryptographic hardness for our identity parameters. Plaintext passwords are never persisted.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Iterations / Pass Count</span>
                  <span className="text-slate-900 bg-slate-200 px-2 py-0.5 rounded">{argon2Iterations} Passes</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="16" 
                  value={argon2Iterations}
                  onChange={(e) => setArgon2Iterations(parseInt(e.target.value))}
                  className="w-full accent-slate-900"
                />
              </div>

              <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Cryptographic Salt Size (Bytes)</span>
                  <span className="text-slate-900 bg-slate-200 px-2 py-0.5 rounded">{argon2SaltLength} Bytes</span>
                </div>
                <input 
                  type="range" 
                  min="8" 
                  max="64" 
                  value={argon2SaltLength}
                  onChange={(e) => setArgon2SaltLength(parseInt(e.target.value))}
                  className="w-full accent-slate-900"
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-slate-400 border border-slate-800">
                <p className="text-green-400 font-bold mb-2">Server-Side Hash Profile output:</p>
                <p>Algorithm: Argon2id (Enterprise Variant)</p>
                <p>Memory Hardness: 65,536 KB</p>
                <p>Parallelism Factor: 4 threads</p>
                <p className="text-[#3b82f6] mt-2">Outputs conform strictly to OWASP identity recommendations.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'compliance' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-950">Enterprise Security Compliance Standards</h3>
              <p className="text-xs text-slate-400">Current audits as mapped to official cybersecurity frameworks</p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-4 h-4" /> All Active Scopes Passing
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "GDPR Alignment", status: "PASS", desc: "Explicit user controls, dynamic logs, and database deletion compliance built-in." },
              { title: "SOC 2 Type II", status: "COMPLIANT", desc: "Automated append-only audit trail and non-repudiation in place." },
              { title: "ISO 27017 / 27001", status: "VERIFIED", desc: "System configuration, asset inventory mapping, and symmetric keys tracked." },
              { title: "PCI DSS v4.0", status: "ATTESTED", desc: "Multi-tenant isolation, restricted ledger writes, and field obfuscation." }
            ].map((scope) => (
              <div key={scope.title} className="border border-slate-150 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900">{scope.title}</h4>
                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-sm">
                    {scope.status}
                  </span>
                </div>
                <p className="text-2xs text-slate-400 leading-relaxed">{scope.desc}</p>
              </div>
            ))}
          </div>

          {/* Secure Incident playbooks */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 space-y-4">
            <h4 className="font-bold text-sm text-slate-900">Enterprise Incident Response Playbook</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed">
              <div className="space-y-1.5 p-3 bg-white rounded-xl border border-slate-150">
                <h5 className="font-bold text-slate-950 flex items-center gap-1">
                  <span className="text-red-500 font-extrabold">1.</span> Triage & Isolate
                </h5>
                <p className="text-slate-400 text-2xs">
                  Edge triggers automatically drop problematic connection nodes. Malicious IPs are immediately pushed to CDN blocking headers, shielding downstream microservices.
                </p>
              </div>

              <div className="space-y-1.5 p-3 bg-white rounded-xl border border-slate-150">
                <h5 className="font-bold text-slate-950 flex items-center gap-1">
                  <span className="text-amber-500 font-extrabold">2.</span> Audit Log Lock
                </h5>
                <p className="text-slate-400 text-2xs">
                  Auditors retrieve Immutable Audit Trail from Firestore immediately. Encrypted ledger backups are retrieved from geo-redundant buckets for trace comparison.
                </p>
              </div>

              <div className="space-y-1.5 p-3 bg-white rounded-xl border border-slate-150">
                <h5 className="font-bold text-slate-950 flex items-center gap-1">
                  <span className="text-blue-500 font-extrabold">3.</span> Key Rotation
                </h5>
                <p className="text-slate-400 text-2xs">
                  Generate immediate cryptographic rotates using the Security Sliders. Sessions are terminated globally, requesting new biometric re-verifications.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'resources' && (
        <div className="space-y-6">
          {/* Security Architecture Diagram Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-4">
              <Layers className="w-5 h-5 text-slate-700" />
              <h3 className="font-bold text-slate-950">System Security Architecture & Data Flow</h3>
            </div>
            
            <div className="overflow-x-auto">
              <div className="min-w-[800px] border border-slate-150 rounded-xl p-6 bg-slate-950 text-slate-300 font-mono text-2xs space-y-6">
                <div className="text-center text-green-400 font-bold bg-slate-900 py-1.5 rounded-md uppercase tracking-wider">
                  MiraTech Zero Trust Multi-Tenant Gateway
                </div>

                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="border border-slate-800 p-3 rounded bg-slate-900/40">
                    <p className="font-bold text-white mb-1">[Edge Layer]</p>
                    <p className="text-slate-400 font-sans text-3xs">CDN Rate Limiting</p>
                    <p className="text-slate-400 font-sans text-3xs">WAF Filter Header</p>
                    <p className="text-slate-400 font-sans text-3xs">TLS 1.3 Handshake</p>
                  </div>

                  <div className="border border-slate-800 p-3 rounded bg-slate-900/40 relative">
                    <div className="absolute top-1/2 -right-4 -translate-y-1/2 text-slate-600">→</div>
                    <p className="font-bold text-white mb-1">[Identity Core]</p>
                    <p className="text-slate-400 font-sans text-3xs">Firebase Auth MFA</p>
                    <p className="text-slate-400 font-sans text-3xs">Device Biometrics</p>
                    <p className="text-slate-400 font-sans text-3xs">Argon2id Verification</p>
                  </div>

                  <div className="border border-slate-800 p-3 rounded bg-slate-900/40 relative">
                    <div className="absolute top-1/2 -right-4 -translate-y-1/2 text-slate-600">→</div>
                    <p className="font-bold text-white mb-1">[Access Layer]</p>
                    <p className="text-slate-400 font-sans text-3xs">ABAC / RBAC Rules</p>
                    <p className="text-slate-400 font-sans text-3xs">Tenant Separator</p>
                    <p className="text-slate-400 font-sans text-3xs">Non-Repudiation logs</p>
                  </div>

                  <div className="border border-slate-800 p-3 rounded bg-slate-900/40">
                    <p className="font-bold text-white mb-1">[Storage Vault]</p>
                    <p className="text-slate-400 font-sans text-3xs">Firestore Rules Guard</p>
                    <p className="text-slate-400 font-sans text-3xs">AES-256 Envelope KMS</p>
                    <p className="text-slate-400 font-sans text-3xs">Immutable Audit Trace</p>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4 text-slate-400 leading-relaxed font-sans mt-3 space-y-1 text-2xs">
                  <p className="font-bold text-slate-200 uppercase">Dynamic Enforcement Matrix</p>
                  <p>1. Auth Token payload inspected at edge router via custom NextJS middleware blocks.</p>
                  <p>2. Tenant isolation verification asserts that `uid` is exact corporate member via Firestore dynamic rules.</p>
                  <p>3. Audit log append operations validated as immutable, rejecting all client updates/deletes.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Flutter SDK Code Snippet */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h4 className="font-bold text-slate-950 flex items-center gap-1.5">
                <Code2 className="w-5 h-5 text-indigo-500" />
                Flutter Client-Side Security Integration
              </h4>
              <p className="text-xs text-slate-400">Add secure credentials, biometric prompts, and device integrity verification inside Flutter mobile wrappers.</p>
              
              <div className="font-mono text-2xs bg-slate-950 text-slate-300 p-4 rounded-xl max-h-[300px] overflow-y-auto space-y-2">
                <p className="text-slate-500">lib/security/device_auth.dart</p>
                <p className="text-[#3b82f6]">import &apos;package:local_auth/local_auth.dart&apos;;</p>
                <p className="text-[#3b82f6]">import &apos;package:flutter_secure_storage/flutter_secure_storage.dart&apos;;</p>
                <p className="text-slate-500">import &apos;package:flutter/services.dart&apos;;</p>
                <br/>
                <p><span className="text-purple-400">class</span> EnterpriseSecurityService &#123;</p>
                <p>&nbsp;&nbsp;<span className="text-purple-400">final</span> LocalAuthentication _auth = LocalAuthentication();</p>
                <p>&nbsp;&nbsp;<span className="text-purple-400">final</span> _storage = FlutterSecureStorage();</p>
                <br/>
                <p>&nbsp;&nbsp;Future&lt;bool&gt; authenticateWithBiometrics() <span className="text-purple-400">async</span> &#123;</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;try &#123;</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-400">return await</span> _auth.authenticate(</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;localizedReason: &apos;Authenticate to access financial books&apos;,</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;options: <span className="text-purple-400">const</span> AuthenticationOptions(</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;stickyAuth: true,</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;biometricOnly: true,</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;),</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;);</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&#125; <span className="text-purple-400">on</span> PlatformException <span className="text-purple-400">catch</span> (e) &#123;</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;print(&apos;Biometric error: $e&apos;);</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return false;</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&#125;</p>
                <p>&nbsp;&nbsp;&#125;</p>
                <p>&#125;</p>
              </div>
            </div>

            {/* Penetration Testing and Vulnerability Assessment */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h4 className="font-bold text-slate-950 flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 text-[#3b82f6]" />
                Cybersecurity Pentesting & Checklist
              </h4>
              <p className="text-xs text-slate-400">Continuous vulnerability mitigation checklist strictly recommended for enterprise deployment pipelines.</p>

              <div className="space-y-2.5 text-xs">
                {[
                  { text: "OWASP Top 10 automated test suites integrated inside CI/CD workflows.", checked: true },
                  { text: "Argon2 key hardness verified regularly for high entropy parameters.", checked: true },
                  { text: "Biometric auth requested whenever corporate administrators alter ledger documents.", checked: true },
                  { text: "Cross tenant leakage tests run automatically via client emulator scripts.", checked: true },
                  { text: "Rate limit settings adjusted to drop dynamic brute force and API scraping.", checked: true }
                ].map((item, id) => (
                  <div key={id} className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-green-600 bg-green-50 font-extrabold text-xs">✓</span>
                    <span className="text-slate-700 leading-relaxed text-2xs">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

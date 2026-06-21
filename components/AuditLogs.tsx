"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, Calendar, ShieldCheck, User, RefreshCw, Key, ShieldAlert, X, Copy, Check, Terminal, Cpu, Database, Network } from "lucide-react";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { useUserStore } from "../lib/store";
import { motion, AnimatePresence } from "motion/react";

interface AuditLog {
  id: string;
  action: string;
  detail: string;
  timestamp: any;
  user: string;
  businessId: string;
  ip?: string;
  userId?: string;
}

interface AuditLogsProps {
  userLogsOnly?: boolean;
}

export default function AuditLogs({ userLogsOnly = false }: AuditLogsProps = {}) {
  const { currentUser } = useUserStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [activeUserOnly, setActiveUserOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Determine if the operator has Master Admin credentials
  const isMasterAdmin = 
    currentUser?.role?.toUpperCase() === "MASTER_ADMIN" || 
    auth.currentUser?.email?.toLowerCase() === "miratechindustries@gmail.com";

  useEffect(() => {
    async function loadBusiness() {
        if (!auth.currentUser) return;
        try {
          const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (userSnap.exists()) {
            setBusinessId(userSnap.data()?.businessId || userSnap.data()?.companyId || auth.currentUser.uid);
          } else {
            setBusinessId(auth.currentUser.uid);
          }
        } catch (e: any) {
          console.error(e);
          setBusinessId(auth.currentUser.uid);
          try {
            handleFirestoreError(e, OperationType.GET, `users/${auth.currentUser.uid}`);
          } catch (r) {}
        }
    }
    loadBusiness();
  }, [currentUser]);

  // Refetch logs when businessId settles or when roles change
  useEffect(() => {
    loadLogs();
  }, [businessId]);

  const loadLogs = async () => {
    setRefreshing(true);
    setError(null);
    try {
      let q;
      // Master Admins see logs from all businesses/tenants. Standard users are scoped to their own.
      if (isMasterAdmin) {
        q = query(collection(db, "audit_logs"));
      } else {
        if (!businessId) {
          setLogs([]);
          setRefreshing(false);
          return;
        }
        q = query(collection(db, "audit_logs"), where("businessId", "==", businessId));
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));

      // Client-side sorting on the timestamp to completely bypass missing Firestore index errors
      const getMillis = (ts: any): number => {
        if (!ts) return 0;
        if (typeof ts.toMillis === "function") return ts.toMillis();
        if (typeof ts.toDate === "function") return ts.toDate().getTime();
        if (ts instanceof Date) return ts.getTime();
        if (typeof ts === "number") return ts;
        if (typeof ts === "string") return new Date(ts).getTime();
        if (ts.seconds) return ts.seconds * 1000 + (ts.nanoseconds ? ts.nanoseconds / 1000000 : 0);
        return 0;
      };

      data.sort((a, b) => getMillis(b.timestamp) - getMillis(a.timestamp));
      setLogs(data);
    } catch (err: any) {
      console.error("[AuditLogs Module] Failure querying system records:", err);
      setError(err?.message || "Internal failure querying security records from Firestore.");
      try {
        handleFirestoreError(err, OperationType.LIST, "audit_logs");
      } catch (r) {}
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadLogs();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    const actionMatch = (log.action || "").toLowerCase().includes(search.toLowerCase());
    const detailMatch = (log.detail || "").toLowerCase().includes(search.toLowerCase());
    const userMatch = (log.user || "").toLowerCase().includes(search.toLowerCase());
    const ipMatch = (log.ip || "").toLowerCase().includes(search.toLowerCase());
    const matchesSearch = actionMatch || detailMatch || userMatch || ipMatch;
    
    const matchesActiveUser = userLogsOnly 
      ? log.user === auth.currentUser?.email 
      : (!activeUserOnly || log.user === auth.currentUser?.email);
    return matchesSearch && matchesActiveUser;
  });

  return (
    <div className="space-y-4">
      {/* Upper Status Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 font-sans">
            {userLogsOnly ? "My Session Action Ledger" : "Security & Operational Logs"}
          </h1>
          <p className="text-[11px] text-slate-500 font-sans">
            {userLogsOnly 
              ? "Private trace of operational choices recorded during your active authentication." 
              : "Track data sync events, auth processes, and executive actions."
            }
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-md hover:bg-slate-50 text-xs font-bold cursor-pointer transition shadow-3xs"
        >
          {refreshing ? <Loader2 className="h-3 w-3 animate-spin text-blue-600" /> : <RefreshCw className="h-3 w-3" />}
          Refresh Logs
        </button>
      </div>

      {/* Security alert notification if loaded with error */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-150 rounded-lg text-xs text-red-700 flex items-center gap-2.5 shadow-3xs font-semibold">
          <ShieldAlert className="h-4 w-4 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Trio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/50 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">System State</p>
          <div className="flex items-center gap-1.5 text-sm font-extrabold text-green-750 mt-1">
            <ShieldCheck className="h-4 w-4 text-green-600 animate-pulse" />
            <span>Operational</span>
          </div>
          <p className="text-[8px] text-slate-400 mt-0.5">All modules running securely</p>
        </div>

        <div className="bg-white border border-slate-200/50 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            {userLogsOnly ? "My Session Events" : "Total Recorded Logs"}
          </p>
          <h3 className="text-sm font-extrabold text-slate-800 mt-1 font-mono">
            {userLogsOnly ? logs.filter(log => log.user === auth.currentUser?.email).length : logs.length}
          </h3>
          <p className="text-[8px] text-slate-400 mt-0.5">
            {userLogsOnly ? "Private filtered entries" : "Total events indexed"}
          </p>
        </div>

        <div className="bg-white border border-slate-200/50 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Current Operator</p>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mt-1 truncate">
            <User className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            <span className="truncate">{auth.currentUser?.email || "Manager Session"}</span>
          </div>
          <p className="text-[8px] text-slate-400 mt-0.5">Secured authentication token</p>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-slate-50 p-3 rounded-lg border border-slate-200/60 shadow-3xs">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search operations, actor email, or logs description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-semibold placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition shadow-3xs"
          />
        </div>
        {!userLogsOnly && (
          <div className="flex items-center">
            <label className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-md text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50 transition shadow-3xs select-none">
              <input
                type="checkbox"
                checked={activeUserOnly}
                onChange={(e) => setActiveUserOnly(e.target.checked)}
                className="rounded-sm text-blue-600 focus:ring-blue-500 border-slate-300 h-3.5 w-3.5 cursor-pointer"
              />
              My Actions Only
            </label>
          </div>
        )}
      </div>
      
      {/* High-density grid table */}
      <div className="overflow-x-auto bg-white border border-slate-200/80 rounded-lg shadow-3xs">
        <table className="high-density-table w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="p-3">Audit Security Group</th>
              <th className="p-3">Action Operation</th>
              <th className="p-3">Detailed Record Information</th>
              <th className="p-3">User Operating</th>
              <th className="p-3">IP Address</th>
              <th className="p-3 text-right">Time Registered (UTC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 text-xs">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400 font-bold">
                  {refreshing ? "Loading security telemetry..." : "No operational logs indexed in this parameters."}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isSystem = (log.user || "").includes("SYSTEM") || (log.user || "").includes("GATEWAY") || (log.user || "").includes("Unknown");
                const isSelected = selectedLog?.id === log.id;
                return (
                  <tr 
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className={`cursor-pointer hover:bg-slate-50/80 active:bg-slate-100/70 transition-all duration-150 relative ${
                      isSelected ? "bg-blue-50/40 border-l-3 border-blue-600" : "border-l-3 border-transparent"
                    }`}
                  >
                    <td className="p-3 whitespace-nowrap">
                      {isSystem ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                          <ShieldCheck className="h-2.5 w-2.5" /> System Internal
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-150">
                          <Key className="h-2.5 w-2.5" /> Administrator
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-extrabold text-slate-800">{log.action || "Event Log"}</td>
                    <td className="p-3 text-slate-600 leading-relaxed font-semibold max-w-sm truncate" title={log.detail}>
                      {log.detail || "No details provided."}
                    </td>
                    <td className="p-3 font-mono text-xs text-blue-900">{log.user || "unknown"}</td>
                    <td className="p-3 font-mono text-xs text-slate-600">{log.ip || "127.0.0.1"}</td>
                    <td className="p-3 font-mono text-right text-slate-500 text-[10px] whitespace-nowrap">
                      {(() => {
                        const ts = log.timestamp;
                        if (!ts) return "Registering...";
                        if (typeof ts.toDate === "function") {
                          return ts.toDate().toLocaleString();
                        }
                        if (ts instanceof Date) {
                          return ts.toLocaleString();
                        }
                        if (typeof ts === "string" || typeof ts === "number") {
                          return new Date(ts).toLocaleString();
                        }
                        if (ts.seconds) {
                          return new Date(ts.seconds * 1000).toLocaleString();
                        }
                        return String(ts);
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Side-out Drawer and Overlay for Audit Log Investigation */}
      <AnimatePresence>
        {selectedLog && (
          <>
            {/* Dark wash backdrop dimmer overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="fixed inset-0 bg-slate-900 z-40 transition-opacity"
            />

            {/* Sliding cabinet side panel drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 24, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Investigate Log Registry</span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-2">
                    <Terminal className="h-4.5 w-4.5 text-slate-600" />
                    Audit Diagnostic Detail
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1 px-1.5 rounded-md hover:bg-slate-200/75 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Drawer Scrollable Payload */}
              <div className="p-5 flex-1 overflow-y-auto space-y-5">
                {/* Visual Accent State Box */}
                <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                  (selectedLog.user || "").includes("SYSTEM") 
                    ? "bg-slate-50/50 border-slate-200" 
                    : "bg-blue-50/20 border-blue-100"
                }`}>
                  <div className="flex justify-between items-start gap-1">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Class Type</span>
                      <p className="text-sm font-extrabold text-slate-950 mt-0.5">{selectedLog.action}</p>
                    </div>
                    <div>
                      {(selectedLog.user || "").includes("SYSTEM") ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                          <Cpu className="h-3 w-3" /> System
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                          <Key className="h-3 w-3" /> User Admin
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-bold">
                      <Network className="h-3 w-3 text-slate-400" />
                      Host: {selectedLog.ip || "127.0.0.1"}
                    </span>
                    <button
                      onClick={() => handleCopy(selectedLog.id, "id")}
                      className="text-[10px] hover:text-blue-600 flex items-center gap-1 font-bold transition cursor-pointer"
                    >
                      {copiedId === "id" ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      ID: {selectedLog.id.slice(0, 8)}...
                    </button>
                  </div>
                </div>

                {/* Extended Details */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Statement / Operational Detail</h4>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200/60 leading-relaxed text-xs text-slate-700 font-medium">
                    {selectedLog.detail || "No additional description specified."}
                  </div>
                </div>

                {/* Audit Grid Metadata */}
                <div className="space-y-3.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Operational Metadata</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200/40 rounded-lg">
                      <span className="text-[10px] font-bold text-slate-400 block">Operator ID / UID</span>
                      <span className="text-xs font-mono text-slate-700 mt-1 block truncate" title={selectedLog.userId || "N/A"}>
                        {selectedLog.userId || "N/A"}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200/40 rounded-lg">
                      <span className="text-[10px] font-bold text-slate-400 block">Client Address / IP</span>
                      <span className="text-xs font-mono text-slate-700 mt-1 block truncate">
                        {selectedLog.ip || "127.0.0.1"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200/40 rounded-lg">
                      <span className="text-[10px] font-bold text-slate-400 block">Entity Tenant / ID</span>
                      <span className="text-xs font-mono text-slate-700 mt-1 block truncate" title={selectedLog.businessId}>
                        {selectedLog.businessId || "N/A"}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200/40 rounded-lg">
                      <span className="text-[10px] font-bold text-slate-400 block">System Signature</span>
                      <span className="text-xs font-bold text-emerald-800 mt-1 block">
                        Verified Valid
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200/40 rounded-lg space-y-1.5 text-xs text-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block">Operated User Identity</span>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold block truncate text-slate-800 tracking-tight">{selectedLog.user}</span>
                      <button
                        onClick={() => handleCopy(selectedLog.user, "user")}
                        className="p-1 hover:bg-slate-200/50 rounded-sm text-slate-500 hover:text-slate-800 transition cursor-pointer"
                        title="Copy Operator Email"
                      >
                        {copiedId === "user" ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200/40 rounded-lg space-y-1.5 text-xs text-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">Time Registered</span>
                    <div className="flex items-center gap-2 text-slate-700 font-semibold mb-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {(() => {
                          const ts = selectedLog.timestamp;
                          if (!ts) return "N/A";
                          if (typeof ts.toDate === "function") return ts.toDate().toUTCString();
                          return new Date(ts).toUTCString();
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Raw JSON Diagnostic Telemetry Inspector */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Database className="h-3 w-3" /> Log Telemetry JSON
                    </h4>
                    <button
                      onClick={() => handleCopy(JSON.stringify(selectedLog, null, 2), "raw_json")}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition cursor-pointer bg-blue-50 px-2 py-0.5 rounded-sm"
                    >
                      {copiedId === "raw_json" ? (
                        <>
                          <Check className="h-3 w-3 text-green-600" /> Copied Json
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy JSON Structure
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3.5 bg-slate-900 text-[10px] font-mono text-emerald-400 rounded-lg overflow-x-auto select-all leading-normal max-h-48 border border-slate-950">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Drawer Footer controls */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs font-bold">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md transition cursor-pointer shadow-3xs"
                >
                  Close Inquiry
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

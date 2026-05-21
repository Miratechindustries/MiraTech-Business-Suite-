"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, Calendar, ShieldCheck, User, RefreshCw, Key, ShieldAlert } from "lucide-react";
import { auth } from "../lib/firebase";

interface AuditLog {
  action: string;
  detail: string;
  timestamp: string;
  user: string;
  ip: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [activeUserOnly, setActiveUserOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = () => {
    const user = auth.currentUser;
    const cacheKey = user ? `miratech_audit_logs_${user.uid}` : "miratech_audit_logs_guest";
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setLogs(JSON.parse(cached));
    } else {
      // Seed default logs
      const seedLogs: AuditLog[] = [
        { action: "Database Configured", detail: "Workspace Firestore secure routing schemas compiled.", timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), user: "SYSTEM / SECURE", ip: "127.0.0.1" },
        { action: "Identity Confirmed", detail: "Manager authenticated safely. Session established.", timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), user: user?.email || "Manager", ip: "192.168.1.102" },
        { action: "Quotation Exported", detail: "Direct CSV export requested for Active Quotations.", timestamp: new Date(Date.now() - 1200000).toISOString(), user: user?.email || "Manager", ip: "192.168.1.102" },
        { action: "Security Hardened", detail: "Client session token validation successfully reconciled.", timestamp: new Date(Date.now() - 300000).toISOString(), user: "GATEWAY", ip: "127.0.0.1" }
      ];
      setLogs(seedLogs);
      localStorage.setItem(cacheKey, JSON.stringify(seedLogs));
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      loadLogs();
      setRefreshing(false);
    }, 450);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.detail.toLowerCase().includes(search.toLowerCase()) ||
      log.user.toLowerCase().includes(search.toLowerCase());
    const matchesActiveUser = !activeUserOnly || log.user === auth.currentUser?.email;
    return matchesSearch && matchesActiveUser;
  });

  return (
    <div className="space-y-4">
      {/* Upper Status Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Security & Operational Logs</h1>
          <p className="text-[11px] text-slate-500">Track data sync events, auth processes, and executive actions.</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-md hover:bg-slate-50 text-xs font-bold cursor-pointer transition shadow-3xs"
        >
          {refreshing ? <Loader2 className="h-3 w-3 animate-spin text-blue-600" /> : <RefreshCw className="h-3 w-3" />}
          Refresh Logs
        </button>
      </div>

      {/* KPI Trio */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/50 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">System State</p>
          <div className="flex items-center gap-1.5 text-base font-extrabold text-green-700 mt-1">
            <ShieldCheck className="h-4.5 w-4.5 text-green-600" />
            <span>Operational</span>
          </div>
          <p className="text-[8px] text-slate-400">All modules running securely</p>
        </div>
        <div className="bg-white border border-slate-200/50 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Recorded Logs</p>
          <h3 className="text-base font-extrabold text-slate-800 mt-1 font-mono">{logs.length}</h3>
          <p className="text-[8px] text-slate-400">Total events indexed</p>
        </div>
        <div className="bg-white border border-slate-200/50 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Authorized Manager</p>
          <div className="flex items-center gap-1.5 mt-1">
            <User className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
              {auth.currentUser?.displayName || "Manager"}
            </span>
          </div>
          <p className="text-[8px] text-blue-500 font-medium">Under active JWT session</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search action logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-hidden"
          />
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-md hover:bg-slate-50 transition">
          <input
            type="checkbox"
            checked={activeUserOnly}
            onChange={(e) => setActiveUserOnly(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
          />
          <span>Show My Admin Operations Only</span>
        </label>
      </div>

      {/* High-density grid table */}
      <div className="overflow-x-auto bg-white border border-slate-200/80 rounded-lg shadow-3xs">
        <table className="high-density-table w-full text-left border-collapse">
          <thead>
            <tr>
              <th>Audit State Group</th>
              <th>Action Operation</th>
              <th>Detailed Record Information</th>
              <th>User E-Mail</th>
              <th>Terminal IP IP</th>
              <th className="text-right">Time Registered (UTC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 text-xs">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400 font-medium animate-pulse">
                  No active logs recorded inside parameters.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => {
                const isSystem = log.user.includes("SYSTEM") || log.user.includes("GATEWAY");
                return (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td>
                      {isSystem ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                          <ShieldCheck className="h-2.5 w-2.5" /> System Core
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-150">
                          <Key className="h-2.5 w-2.5" /> Administrator
                        </span>
                      )}
                    </td>
                    <td className="font-extrabold text-slate-800">{log.action}</td>
                    <td className="text-slate-600 leading-relaxed font-semibold max-w-sm truncate">{log.detail}</td>
                    <td className="font-mono text-xs text-blue-900">{log.user}</td>
                    <td className="font-mono text-[10px] text-slate-400">{log.ip}</td>
                    <td className="font-mono text-right text-slate-500 text-[10px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString(undefined, {
                        hour12: false,
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

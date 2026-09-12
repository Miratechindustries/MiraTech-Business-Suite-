"use client";

import React, { useEffect, useState } from "react";
import { X, Activity, User, FileText, Trash2, Edit3, PlusCircle } from "lucide-react";
import { collection, query, orderBy, limit, onSnapshot, getDocs, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";

interface AuditLog {
  id: string;
  action: string;
  detail: string;
  businessId: string;
  department: string;
  severity: string;
  timestamp: any;
  isoTimestamp: string;
  user: string;
  userId: string;
}

interface AuditTrailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // If companyId is provided, fetch for that company. 
  // If undefined (Master Admin), fetch across all companies.
  companyId?: string;
}

export default function AuditTrailDrawer({ isOpen, onClose, companyId }: AuditTrailDrawerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    let unsubscribe = () => {};

    if (companyId) {
      // Business Admin View: Listen to specific company's logs
      const q = query(
        collection(db, "audit_logs"),
        where("businessId", "==", companyId),
        orderBy("timestamp", "desc"),
        limit(50)
      );
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedLogs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as AuditLog));
        setLogs(fetchedLogs);
        setLoading(false);
      });
    } else {
      // Master Admin View: Listen to all audit_logs
      const q = query(
        collection(db, "audit_logs"),
        orderBy("timestamp", "desc"),
        limit(100)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedLogs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as AuditLog));
        setLogs(fetchedLogs);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching global logs:", error);
        setLoading(false);
      });
    }

    return () => unsubscribe();
  }, [isOpen, companyId]);

  const getActionIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("create") || act.includes("add")) return <PlusCircle className="w-4 h-4 text-emerald-500" />;
    if (act.includes("delete") || act.includes("remove")) return <Trash2 className="w-4 h-4 text-rose-500" />;
    if (act.includes("edit") || act.includes("update")) return <Edit3 className="w-4 h-4 text-amber-500" />;
    return <Activity className="w-4 h-4 text-indigo-500" />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 tracking-tight">Audit Trail</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    {companyId ? "Workspace Actions" : "Global System Actions"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-3">
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-500 font-medium">Fetching logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100">
                    <Activity className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-600">No recent activity</p>
                  <p className="text-xs text-slate-400 mt-1">Actions performed by users will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="relative pl-6 pb-4 border-l border-slate-100 last:border-0 last:pb-0 group">
                      <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center group-hover:border-indigo-200 transition-colors">
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-400" />
                      </div>
                      <div className="bg-white border border-slate-100 hover:border-slate-200 shadow-3xs rounded-xl p-3 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider text-slate-600 border border-slate-100">
                            {getActionIcon(log.action)}
                            {log.action}
                          </div>
                          {log.timestamp && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : new Date().toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-800 mb-1">{log.department}</p>
                        {log.detail && (
                          <p className="text-xs text-slate-500 leading-relaxed mb-3">
                            {log.detail}
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-medium text-slate-500 truncate">
                            {log.user}
                          </span>
                        </div>
                        {!companyId && log.businessId && (
                           <div className="mt-1 text-[9px] font-mono text-indigo-400">
                             Workspace ID: {log.businessId}
                           </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

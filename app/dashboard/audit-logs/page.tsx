'use client'

import React, { useEffect, useState } from 'react';
import { Shield, Search, Filter } from 'lucide-react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';

interface AuditLog {
  id: string;
  action: string;
  user: string;
  timestamp: number;
  details: string;
}

export default function AuditLogsPage() {
  const { business } = useAppStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!business) return;
      setLoading(true);
      
      try {
        const q = query(
          collection(db, 'businesses', business.id, 'auditLogs'),                
          orderBy('timestamp', 'desc')
        );
        const snap = await getDocs(q);
        setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [business]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Audit Logs</h1>
        <p className="text-sm text-slate-500">View recent system activities.</p>
      </div>

      {loading ? (
        <div className="p-8 text-center">Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Shield className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-bold">No Audit Logs</h3>
          <p className="text-sm text-slate-500">No recent activities recorded.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
           <table className="w-full text-left">
             <thead>
               <tr className="border-b text-xs font-bold uppercase tracking-wider text-slate-400">
                 <th className="p-4">User</th>
                 <th className="p-4">Action</th>
                 <th className="p-4">Details</th>
                 <th className="p-4">Timestamp</th>
               </tr>
             </thead>
             <tbody className="divide-y dark:divide-slate-800">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="p-4 text-sm font-medium">{log.user}</td>
                    <td className="p-4 text-sm">{log.action}</td>
                    <td className="p-4 text-sm truncate max-w-xs">{log.details}</td>
                    <td className="p-4 text-sm text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
             </tbody>
           </table>
        </div>
      )}
    </div>
  );
}

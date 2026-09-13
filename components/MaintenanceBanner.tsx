'use client';

import { useState, useEffect } from 'react';
import { Wrench, ShieldAlert, RefreshCw } from 'lucide-react';
import { useUserStore } from '../lib/store';

export default function MaintenanceBanner() {
  const { currentUser } = useUserStore();
  const [maintenance, setMaintenance] = useState<{
    enabled: boolean;
    message: string;
    scheduledEnd?: string;
  } | null>(null);

  const isMasterAdmin = currentUser?.role?.toUpperCase() === 'MASTER_ADMIN' || 
                        currentUser?.email?.toLowerCase() === 'miratechindustries@gmail.com';

  useEffect(() => {
    let isMounted = true;
    async function checkMaintenance() {
      try {
        const res = await fetch('/api/admin/maintenance');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setMaintenance(data);
          }
        }
      } catch (e) {
        // Silently fail if maintenance endpoint is unavailable
      }
    }

    checkMaintenance();
    const interval = setInterval(checkMaintenance, 60000); // Check every 60s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!maintenance || !maintenance.enabled) return null;

  // Master Admin sees a non-blocking top warning banner
  if (isMasterAdmin) {
    return (
      <div className="bg-amber-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between z-50 sticky top-0 shadow-sm">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 animate-bounce" />
          <span><strong>MAINTENANCE MODE ACTIVE:</strong> Non-admin users are currently blocked by the maintenance screen.</span>
        </div>
        <span className="text-[10px] bg-amber-700 px-2 py-0.5 rounded font-mono">Master Admin Bypass</span>
      </div>
    );
  }

  // Non-master-admin end users see a full-screen maintenance message
  return (
    <div className="fixed inset-0 z-9999 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-6 text-center text-white font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
          <Wrench className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight">System Under Maintenance</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            {maintenance.message || "We are performing scheduled system updates and optimizations. Please check back shortly."}
          </p>
        </div>

        {maintenance.scheduledEnd && (
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-mono text-slate-400">
            Expected Completion: {new Date(maintenance.scheduledEnd).toLocaleString()}
          </div>
        )}

        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 bg-white text-slate-950 hover:bg-slate-100 font-extrabold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> Check System Status
        </button>
      </div>
    </div>
  );
}

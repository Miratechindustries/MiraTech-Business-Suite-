'use client';

import { useState, useEffect } from 'react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserStore } from '../lib/store';
import { LogOut, LayoutDashboard, Users, Building2, ShieldAlert } from "lucide-react";
import { logout } from '../lib/firebase';


export default function MasterAdminDashboard() {
  const { currentUser } = useUserStore();
  const [counts, setCounts] = useState({ companies: 0, users: 0, alerts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
        try {
            const companiesSnapshot = await getCountFromServer(collection(db, 'companies'));
            const usersSnapshot = await getCountFromServer(collection(db, 'users'));
            const alertsSnapshot = await getCountFromServer(collection(db, 'audit_logs'));
            
            setCounts({
                companies: companiesSnapshot.data().count,
                users: usersSnapshot.data().count,
                alerts: alertsSnapshot.data().count
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
    fetchCounts();
  }, []);

  if (currentUser?.role !== 'MASTER_ADMIN' && currentUser?.email?.toLowerCase() !== 'miratechindustries@gmail.com') {
    return <div>Access Denied</div>;
  }

  if (loading) return <div className="text-slate-500">Loading system data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Overview</h1>
        <button 
          onClick={logout}
          className="flex items-center gap-2 text-slate-600 hover:text-red-600 font-medium transition"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-4 text-blue-600 bg-blue-50 p-2 rounded-lg w-fit">
                <Building2 className="w-5 h-5" />
                <h2 className="font-bold">Companies</h2>
            </div>
            <p className="text-4xl font-bold text-slate-900">{counts.companies}</p>
            <p className="text-sm text-slate-500 mt-1">Active business entities</p>
        </div>
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-4 text-emerald-600 bg-emerald-50 p-2 rounded-lg w-fit">
                <Users className="w-5 h-5" />
                <h2 className="font-bold">Users</h2>
            </div>
            <p className="text-4xl font-bold text-slate-900">{counts.users}</p>
            <p className="text-sm text-slate-500 mt-1">Total registered users</p>
        </div>
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-4 text-red-600 bg-red-50 p-2 rounded-lg w-fit">
                <ShieldAlert className="w-5 h-5" />
                <h2 className="font-bold">Security Alerts</h2>
            </div>
            <p className="text-4xl font-bold text-slate-900">{counts.alerts}</p>
            <p className="text-sm text-slate-500 mt-1">Total system events</p>
        </div>
      </div>
    </div>
  );
}

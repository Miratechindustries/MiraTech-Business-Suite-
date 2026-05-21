'use client'

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { UserProfile, AuditLog, Business, UserRole } from '@/lib/types';
import { Shield, Clock, AlertTriangle, Activity, Building, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<number>(1);
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterResource, setFilterResource] = useState<string>('');

  const filteredActivities = activities.filter(act => 
      (!filterAction || act.action.toLowerCase().includes(filterAction.toLowerCase())) &&
      (!filterResource || act.resource.toLowerCase().includes(filterResource.toLowerCase()))
  );

  useEffect(() => {
    const fetchData = async () => {
      const [userSnap, bizSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'))),
        getDocs(query(collection(db, 'businesses')))
      ]);
      
      setUsers(userSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      setBusinesses(bizSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business)));
      setLoading(false);
    };
    fetchData();
  }, []);

  const fetchUserActivities = async (uid: string) => {
    if (!uid) return;
    const q = query(collection(db, 'audit_logs'), where('userId', '==', uid), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    setSelectedUserId(uid);
  };

  const handleUpdateRole = React.useCallback(async (uid: string, role: UserRole) => {
    try {
      const now = Date.now();
      await updateDoc(doc(db, 'users', uid), { role, updatedAt: now });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role } : u));
      toast.success(`Role updated to ${role}`);
    } catch (err) {
      toast.error("Failed to update role");
    }
  }, []);

  const handleUpdateBusiness = React.useCallback(async (uid: string, businessId: string) => {
    try {
      const now = Date.now();
      await updateDoc(doc(db, 'users', uid), { businessId, updatedAt: now });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, businessId } : u));
      toast.success(`Business association updated`);
    } catch (err) {
      toast.error("Failed to associate business");
    }
  }, []);

  const handleUpdateStatus = React.useCallback(async (uid: string, status: 'active' | 'suspended', monthsInput?: number) => {
    try {
      const now = Date.now();
      const updateData: any = { status, updatedAt: now };
      if (monthsInput && monthsInput > 0) {
        const expiry = now + (monthsInput * 30 * 24 * 60 * 60 * 1000);
        updateData.accessExpiryDate = expiry;
      }
      
      await updateDoc(doc(db, 'users', uid), updateData);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updateData } : u));
      toast.success(`User status: ${status}`);
    } catch (err) {
      toast.error("Status update failed");
    }
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-blue-600 font-mono text-[10px] uppercase tracking-[0.2em] font-bold mb-1">Personnel / Access Control</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">User_Registry</h1>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl p-4 md:p-6 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center gap-6 mb-6 pb-6 border-b border-white/5">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Protocol_Duration (Months)</label>
            <input 
              type="number" 
              value={months} 
              onChange={(e) => setMonths(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm w-full md:w-24 outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Instruction</p>
            <p className="text-xs text-slate-400 mt-1 italic">Define the standard interval for access revocation or extension protocols.</p>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Access_Identifier</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Governance_Role</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Business_Association</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Security_State</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">System_Commands</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(user => (
                <tr key={user.uid} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-200 text-sm truncate max-w-[200px]">{user.email}</p>
                    <p className="text-[10px] font-mono text-slate-600 mt-0.5">UID: {user.uid.slice(0, 12).toUpperCase()}</p>
                  </td>
                  <td className="px-4 py-4">
                    <select 
                        value={user.role} 
                        onChange={(e) => handleUpdateRole(user.uid, e.target.value as UserRole)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-black text-blue-400 uppercase tracking-widest outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                    >
                        <option value="STAFF">STAFF</option>
                        <option value="BUSINESS_ADMIN">BUSINESS_ADMIN</option>
                        <option value="MASTER_ADMIN">MASTER_ADMIN</option>
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <select 
                        value={user.businessId || ''} 
                        onChange={(e) => handleUpdateBusiness(user.uid, e.target.value)}
                        className={`w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer ${user.businessId ? 'text-slate-300' : 'text-rose-500 animate-pulse'}`}
                    >
                        <option value="">NO_ASSOCIATION</option>
                        {businesses.map(biz => (
                          <option key={biz.id} value={biz.id}>{biz.name}</option>
                        ))}
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border w-fit ${
                            user.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                            {user.status}
                        </span>
                        <p className="text-[9px] font-mono text-slate-500 font-bold uppercase tracking-tight">
                            {user.accessExpiryDate ? `Exp: ${new Date(user.accessExpiryDate).toLocaleDateString()}` : 'No_Expiry'}
                        </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleUpdateStatus(user.uid, 'active', months)} 
                        className="h-8 w-8 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all active:scale-95 border border-emerald-500/20"
                        title="Authorize_Access"
                      >
                        <Shield size={14} />
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(user.uid, 'suspended', months)} 
                        className="h-8 w-8 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all active:scale-95 border border-rose-500/20"
                        title="Revoke_Access"
                      >
                        <AlertTriangle size={14} />
                      </button>
                      <button 
                        onClick={() => fetchUserActivities(user.uid)} 
                        className="h-8 w-8 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all active:scale-95 border border-blue-500/20"
                        title="Sync_Activity_Logs"
                      >
                        <Activity size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUserId && (
        <div className="bg-[#0c0c0e] rounded-2xl border border-slate-800 shadow-2xl flex flex-col h-[400px]">
            <div className="px-6 py-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-white font-black text-sm uppercase italic tracking-tight flex items-center gap-2">
                     <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                     Live_Audit_Sync: {users.find(u => u.uid === selectedUserId)?.email}
                  </h3>
                </div>
                <div className="flex gap-2">
                    <input type="text" placeholder="Filter_action..." value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-400 outline-none focus:border-blue-500 transition-all"/>
                    <input type="text" placeholder="Filter_resource..." value={filterResource} onChange={(e) => setFilterResource(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-400 outline-none focus:border-blue-500 transition-all"/>
                </div>
            </div>
            <div className="flex-1 p-6 font-mono text-[11px] leading-relaxed overflow-y-auto space-y-1 text-blue-100/70">
                {filteredActivities.length > 0 ? (
                    filteredActivities.map(act => (
                        <div key={act.id} className="hover:bg-blue-500/5 py-1 rounded transition-colors flex items-start gap-3 group">
                            <span className="text-slate-600 opacity-50 shrink-0">[{new Date(act.timestamp).toLocaleString()}]</span>
                            <div className="flex-1">
                              <span className="text-emerald-500 font-black uppercase">{act.action}</span>
                              <span className="text-slate-500 mx-2">&gt;&gt;</span>
                              <span className="text-blue-400">{act.resource}</span>
                              <span className="text-slate-600 ml-2 italic">({act.details})</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex items-center gap-2 text-slate-700 italic">
                       <Clock size={12} />
                       Awaiting telemetry data or no records matching filter...
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
}

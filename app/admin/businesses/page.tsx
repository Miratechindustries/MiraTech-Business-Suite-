'use client'

import React, { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc, query, addDoc } from 'firebase/firestore';
import { Business } from '@/lib/types';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import BusinessDetailsModal from '@/components/BusinessDetailsModal';
import StatusChangeReasonModal from '@/components/StatusChangeReasonModal';

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [statusChangeData, setStatusChangeData] = useState<{ id: string, name: string, newStatus: string } | null>(null);
  const [sortColumn, setSortColumn] = useState<'name' | 'status' | 'createdAt' | null>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetchBusinesses = async () => {
      const snapshot = await getDocs(query(collection(db, 'businesses')));
      setBusinesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business)));
      setLoading(false);
    };
    fetchBusinesses();
  }, []);

  const handleSort = (column: 'name' | 'status' | 'createdAt') => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedBusinesses = [...businesses].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let aValue = a[sortColumn];
    let bValue = b[sortColumn];

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleStatusChangeConfirm = async (reason: string) => {
    if (!statusChangeData) return;
    const { id, newStatus } = statusChangeData;
    const user = auth.currentUser;
    await updateDoc(doc(db, 'businesses', id), { status: newStatus });
    await addDoc(collection(db, 'audit_logs'), {
      businessId: id,
      userId: user?.uid || 'system',
      userEmail: user?.email || 'system',
      action: 'status_change',
      newStatus,
      reason,
      timestamp: Date.now(),
    });
    setBusinesses(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
    setStatusChangeData(null);
  };

  const updateBusinessStatus = (id: string, name: string, status: string) => {
    setStatusChangeData({ id, name, newStatus: status });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-blue-600 font-mono text-[10px] uppercase tracking-[0.2em] font-bold mb-1">Security / Governance</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Entity_Registry</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th 
                  className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors" 
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    IDENTIFIER {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors" 
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    DEPLOYMENT_STATE {sortColumn === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors" 
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-2">
                    TIME_STAMP {sortColumn === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">NARRATIVE_LOG</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">COMMAND_ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedBusinesses.map(biz => (
                <tr key={biz.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-4 py-3">
                    <button 
                      onClick={() => setSelectedBusiness(biz)}
                      className="font-black text-slate-900 text-sm hover:text-blue-600 transition-colors text-left uppercase tracking-tight"
                    >
                      {biz.name}
                    </button>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">UID: {biz.id.slice(0, 8).toUpperCase()}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                        biz.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                        biz.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                        'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      {biz.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-500 font-mono font-bold">
                    {new Date(biz.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[11px] text-slate-600 max-w-xs truncate font-medium">
                      {biz.description || 'Null_Attribute_Set'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {biz.status !== 'active' && (
                        <button 
                          onClick={() => updateBusinessStatus(biz.id, biz.name, 'active')}
                          className="h-7 w-7 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-100"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      {biz.status !== 'rejected' && (
                        <button 
                          onClick={() => updateBusinessStatus(biz.id, biz.name, 'rejected')}
                          className="h-7 w-7 flex items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all active:scale-95 border border-rose-100"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                      {biz.status !== 'suspended' && (
                        <button 
                          onClick={() => updateBusinessStatus(biz.id, biz.name, 'suspended')}
                          className="h-7 w-7 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all active:scale-95 border border-amber-100"
                        >
                          <AlertTriangle size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <BusinessDetailsModal 
        isOpen={!!selectedBusiness}
        onClose={() => setSelectedBusiness(null)}
        business={selectedBusiness}
      />
      <StatusChangeReasonModal
        isOpen={!!statusChangeData}
        onClose={() => setStatusChangeData(null)}
        onConfirm={handleStatusChangeConfirm}
        businessName={statusChangeData?.name || ''}
        newStatus={statusChangeData?.newStatus || ''}
      />
    </div>
  );
}

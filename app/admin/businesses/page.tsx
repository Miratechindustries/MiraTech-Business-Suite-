'use client'

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
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
  const [sortColumn, setSortColumn] = useState<'name' | 'status' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const fetchBusinesses = async () => {
      const snapshot = await getDocs(query(collection(db, 'businesses')));
      setBusinesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business)));
      setLoading(false);
    };
    fetchBusinesses();
  }, []);

  const handleSort = (column: 'name' | 'status') => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedBusinesses = [...businesses].sort((a, b) => {
    if (!sortColumn) return 0;
    const aValue = a[sortColumn].toLowerCase();
    const bValue = b[sortColumn].toLowerCase();
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleStatusChangeConfirm = async (reason: string) => {
    if (!statusChangeData) return;
    const { id, newStatus } = statusChangeData;
    await updateDoc(doc(db, 'businesses', id), { status: newStatus });
    await addDoc(collection(db, 'auditLogs'), {
      businessId: id,
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Business Management</h1>
      <div className="bg-white rounded-lg border p-4">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-2 cursor-pointer hover:text-blue-600" onClick={() => handleSort('name')}>Name {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}</th>
              <th className="text-left p-2 cursor-pointer hover:text-blue-600" onClick={() => handleSort('status')}>Status {sortColumn === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}</th>
              <th className="text-left p-2">Description</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedBusinesses.map(biz => (
              <tr key={biz.id} className="border-t">
                <td className="p-2 cursor-pointer text-blue-600 hover:underline" onClick={() => setSelectedBusiness(biz)}>{biz.name}</td>
                <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                        biz.status === 'active' ? 'bg-green-100' : 
                        biz.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                        {biz.status}
                    </span>
                </td>
                <td className="p-2 text-sm text-slate-600">
                  {biz.description && biz.description.length > 50 
                    ? `${biz.description.slice(0, 50)}...` 
                    : biz.description || 'N/A'}
                </td>
                <td className="p-2 flex gap-2">
                  {biz.status !== 'active' && <button onClick={() => updateBusinessStatus(biz.id, biz.name, 'active')}><CheckCircle className="text-green-600 h-5 w-5" /></button>}
                  {biz.status !== 'rejected' && <button onClick={() => updateBusinessStatus(biz.id, biz.name, 'rejected')}><XCircle className="text-red-600 h-5 w-5" /></button>}
                  {biz.status !== 'suspended' && <button onClick={() => updateBusinessStatus(biz.id, biz.name, 'suspended')}><AlertTriangle className="text-yellow-600 h-5 w-5" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

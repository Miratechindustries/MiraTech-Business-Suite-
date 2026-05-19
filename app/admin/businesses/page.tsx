'use client'

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc, query } from 'firebase/firestore';
import { Business } from '@/lib/types';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBusinesses = async () => {
      const snapshot = await getDocs(query(collection(db, 'businesses')));
      setBusinesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business)));
      setLoading(false);
    };
    fetchBusinesses();
  }, []);

  const updateBusinessStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, 'businesses', id), { status });
    setBusinesses(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Business Management</h1>
      <div className="bg-white rounded-lg border p-4">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map(biz => (
              <tr key={biz.id} className="border-t">
                <td className="p-2">{biz.name}</td>
                <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                        biz.status === 'active' ? 'bg-green-100' : 
                        biz.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                        {biz.status}
                    </span>
                </td>
                <td className="p-2 flex gap-2">
                  {biz.status !== 'active' && <button onClick={() => updateBusinessStatus(biz.id, 'active')}><CheckCircle className="text-green-600 h-5 w-5" /></button>}
                  {biz.status !== 'rejected' && <button onClick={() => updateBusinessStatus(biz.id, 'rejected')}><XCircle className="text-red-600 h-5 w-5" /></button>}
                  {biz.status !== 'suspended' && <button onClick={() => updateBusinessStatus(biz.id, 'suspended')}><AlertTriangle className="text-yellow-600 h-5 w-5" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

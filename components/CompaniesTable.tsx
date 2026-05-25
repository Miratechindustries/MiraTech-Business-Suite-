'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function CompaniesTable() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        const companiesSnapshot = await getDocs(collection(db, 'companies'));
        const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs.map(doc => ({ ...doc.data() }));

        setCompanies(companiesData);
        setUsers(usersData);
    };
    fetchData();
  }, []);

  const getActiveUserCount = (companyId: string) => {
      return users.filter(u => u.companyId === companyId && (u.status === 'ACTIVE' || !u.status)).length;
  };

  return (
    <div className="border p-4 rounded-lg bg-white shadow-sm">
        <h3 className="font-semibold mb-4 text-slate-800">All Companies</h3>
        <table className="w-full text-left">
            <thead>
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-2">Name</th>
                    <th className="p-2">Active Users</th>
                    <th className="p-2">Created At</th>
                </tr>
            </thead>
            <tbody>
                {companies.map(c => (
                    <tr key={c.id} className="border-t">
                        <td className="p-2 font-medium text-slate-900">{c.name}</td>
                        <td className="p-2">{getActiveUserCount(c.id)}</td>
                        <td className="p-2 text-slate-500">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );
}

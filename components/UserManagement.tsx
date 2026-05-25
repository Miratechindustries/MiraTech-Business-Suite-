'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useUserStore } from '../lib/store';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { Role } from '../lib/types';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['MASTER_ADMIN', 'BUSINESS_ADMIN', 'STAFF']),
});

export default function UserManagement() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('STAFF');
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        const companiesSnapshot = await getDocs(collection(db, 'companies'));
        const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCompanies(companiesData);

        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);
    };
    fetchData();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !selectedCompanyId) {
      setError('Please fill in all fields');
      return;
    }
    setError(null);
    try {
      await addDoc(collection(db, 'users'), {
        email,
        role,
        companyId: selectedCompanyId,
        status: 'ACTIVE'
      });
      alert('User created successfully!');
      
      const usersSnapshot = await getDocs(collection(db, 'users'));
      setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
      setError('Failed to create user');
    }
  };

  const handleDeactivate = async (userId: string) => {
    try {
        await updateDoc(doc(db, 'users', userId), { status: 'DEACTIVATED' });
        const usersSnapshot = await getDocs(collection(db, 'users'));
        setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
        console.error(err);
        alert('Failed to deactivate user');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">User Management</h2>
      
      <form onSubmit={handleInvite} className="space-y-4 border p-4 rounded-lg">
        <h3 className="font-semibold">Create New User</h3>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border p-2 w-full" />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="border p-2 w-full">
            <option value="STAFF">Staff</option>
            <option value="BUSINESS_ADMIN">Business Admin</option>
            <option value="MASTER_ADMIN">Master Admin</option>
        </select>
        <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)} className="border p-2 w-full">
            <option value="">Select Company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="submit" className="bg-blue-600 text-white p-2 rounded">Create User</button>
        {error && <p className="text-red-500">{error}</p>}
      </form>

      <div className="border p-4 rounded-lg">
        <h3 className="font-semibold mb-4">Existing Users</h3>
        <table className="w-full text-left">
            <thead>
                <tr>
                    <th className="p-2">Email</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Company</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Action</th>
                </tr>
            </thead>
            <tbody>
                {users.map((u: any) => (
                    <tr key={u.id} className="border-t">
                        <td className="p-2">{u.email}</td>
                        <td className="p-2">{u.role}</td>
                        <td className="p-2">{companies.find(c => c.id === u.companyId)?.name || 'N/A'}</td>
                        <td className="p-2">{u.status || 'ACTIVE'}</td>
                        <td className="p-2">
                            {u.status !== 'DEACTIVATED' && (
                                <button onClick={() => handleDeactivate(u.id)} className="text-red-600 font-bold">Deactivate</button>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}

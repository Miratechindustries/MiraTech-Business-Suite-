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
  const { users, setUsers, updateUserRole } = useUserStore();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('STAFF');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      const q = query(collection(db, 'users'), where('companyId', '==', user.uid)); // Simplifying, assume ownerId maps to companyId? Actually, in blueprint, there's no users collection.
    };
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = inviteSchema.safeParse({ email, role });
    if (!result.success) {
      setError('Invalid email or role');
      return;
    }
    setError(null);
    // Add user invite to Firestore
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">User Management</h2>
      
      <form onSubmit={handleInvite} className="space-y-4 border p-4 rounded-lg">
        <h3 className="font-semibold">Invite New User</h3>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border p-2 w-full" />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="border p-2 w-full">
            <option value="STAFF">Staff</option>
            <option value="BUSINESS_ADMIN">Business Admin</option>
            <option value="MASTER_ADMIN">Master Admin</option>
        </select>
        <button type="submit" className="bg-blue-600 text-white p-2 rounded">Invite</button>
        {error && <p className="text-red-500">{error}</p>}
      </form>
    </div>
  );
}

'use client'

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { UserProfile, AuditLog } from '@/lib/types';
import { Shield, Clock, AlertTriangle, Activity } from 'lucide-react';

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<number>(1);
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterResource, setFilterResource] = useState<string>('');

  const filteredActivities = activities.filter(act => 
      (!filterAction || act.action === filterAction) &&
      (!filterResource || act.resource === filterResource)
  );

  useEffect(() => {
    const fetchUsers = async () => {
      const snapshot = await getDocs(query(collection(db, 'users')));
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      setLoading(false);
    };
    fetchUsers();
  }, []);

  const fetchUserActivities = async (uid: string) => {
    const q = query(collection(db, 'audit_logs'), where('userId', '==', uid));
    const snapshot = await getDocs(q);
    setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    setSelectedUserId(uid);
  };

  const handleUpdateRole = async (uid: string, role: 'standard' | 'business_admin' | 'master_admin') => {
    if (!window.confirm(`Are you sure you want to promote/demote this user to ${role}?`)) {
        return;
    }
    await updateDoc(doc(db, 'users', uid), { role });
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role } : u));
  };

  const handleUpdateStatus = async (uid: string, status: 'active' | 'suspended', monthsInput?: number) => {

    const updateData: any = { status };
    if (monthsInput && monthsInput > 0) {
      const expiry = new Date().getTime() + (monthsInput * 30 * 24 * 60 * 60 * 1000);
      updateData.accessExpiryDate = expiry;
    }
    
    await updateDoc(doc(db, 'users', uid), updateData);
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updateData } : u));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">User Management</h1>
      <div className="bg-white rounded-lg border p-6">
        <label className="block text-sm font-medium mb-2">Default Duration (Months) for new suspension/activation:</label>
        <input 
          type="number" 
          value={months} 
          onChange={(e) => setMonths(Number(e.target.value))}
          className="border p-2 rounded w-20 mb-4"
        />
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Role</th>
              <th className="text-left p-2">Status & Access</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.uid} className="border-t">
                <td className="p-2">{user.email}</td>
                <td className="p-2">
                    <select 
                        value={user.role} 
                        onChange={(e) => handleUpdateRole(user.uid, e.target.value as any)}
                        className="border rounded p-1 text-xs"
                    >
                        <option value="standard">Standard</option>
                        <option value="business_admin">Business Admin</option>
                        <option value="master_admin">Master Admin</option>
                    </select>
                </td>
                <td className="p-2">
                    <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 rounded text-xs w-fit ${
                            user.status === 'active' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                            {user.status}
                        </span>
                        <span className="text-xs text-slate-500">
                            {user.accessExpiryDate ? `Until: ${new Date(user.accessExpiryDate).toLocaleDateString()}` : 'No limit'}
                        </span>
                    </div>
                </td>
                <td className="p-2 flex gap-2">
                  <button onClick={() => handleUpdateStatus(user.uid, 'active', months)} className="text-green-600" title="Activate">
                    <Shield className="h-5 w-5" />
                  </button>
                  <button onClick={() => handleUpdateStatus(user.uid, 'suspended', months)} className="text-red-600" title="Suspend">
                    <AlertTriangle className="h-5 w-5" />
                  </button>
                  <button onClick={() => fetchUserActivities(user.uid)} className="text-blue-600" title="View Activity">
                    <Activity className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedUserId && (
        <div className="bg-white rounded-lg border p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Activity Log for {users.find(u => u.uid === selectedUserId)?.email}</h2>
                <div className="flex gap-2">
                    <input type="text" placeholder="Filter action..." value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="border p-2 rounded text-sm"/>
                    <input type="text" placeholder="Filter resource..." value={filterResource} onChange={(e) => setFilterResource(e.target.value)} className="border p-2 rounded text-sm"/>
                </div>
            </div>
            <div className="space-y-2">
                {filteredActivities.length > 0 ? (
                    filteredActivities.map(act => (
                        <div key={act.id} className="border-b pb-2 text-sm">
                            <span className="font-mono text-gray-500">{new Date(act.timestamp).toLocaleString()}</span> - <strong>{act.action}</strong> on {act.resource} ({act.details})
                        </div>
                    ))
                ) : (
                    <p>No activity found matching filters.</p>
                )}
            </div>
        </div>
      )}
    </div>
  );
}

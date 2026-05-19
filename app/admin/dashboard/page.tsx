'use client'

import React, { useEffect, useState } from 'react';
import { Users, Building, Shield, Activity } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { UserProfile, Business } from '@/lib/types';
import { useAppStore } from '@/lib/store';

export default function MasterAdminDashboardPage() {
  const { user } = useAppStore();
  const isAuthorized = user?.role === 'MASTER_ADMIN';
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthorized) return;
    const fetchData = async () => {
      setLoading(true);
      const bizQuery = query(collection(db, 'businesses'), orderBy('createdAt', 'desc'));
      const userQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      
      const [bizSnapshot, userSnapshot] = await Promise.all([
        getDocs(bizQuery),
        getDocs(userQuery)
      ]);
      
      setBusinesses(bizSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business)));
      setUsers(userSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      setLoading(false);
    };
    
    fetchData();
  }, [isAuthorized]);

  if (!isAuthorized) {
    return <div className="p-8 text-slate-500 font-mono">Access Denied</div>;
  }

  if (loading) return <div className="p-8 text-slate-500 font-mono">Loading data...</div>;

  return (
    <div className="p-8 space-y-8 bg-[#E4E3E0] min-h-screen text-[#141414]">
      <header className="border-b border-[#141414] pb-4">
        <h1 className="font-['Georgia',_serif] italic text-4xl">Master Admin</h1>
      </header>
      
      <section className="grid grid-cols-1 md:grid-cols-3 gap-0 border-t border-l border-[#141414]">
        {[
          { icon: Building, label: 'Businesses', value: businesses.length },
          { icon: Users, label: 'Users', value: users.length },
          { icon: Activity, label: 'Health', value: 'OPTIMAL' },
        ].map((stat, i) => (
          <div key={i} className="p-6 border-b border-r border-[#141414] flex items-center justify-between">
            <div>
              <p className="font-['Georgia',_serif] italic text-[11px] uppercase tracking-[0.05em] opacity-50">{stat.label}</p>
              <h3 className="font-mono text-3xl font-bold tracking-tighter">{stat.value}</h3>
            </div>
            <stat.icon className="h-6 w-6 opacity-30" />
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-2 gap-0 border-t border-l border-[#141414]">
        <div className="border-b border-r border-[#141414]">
          <h2 className="font-['Georgia',_serif] italic text-xs uppercase tracking-[0.05em] opacity-50 p-4 border-b border-[#141414]">Recent Businesses</h2>
          <div className="divide-y divide-[#141414]">
             {businesses.slice(0, 5).map(biz => (
               <div key={biz.id} className="grid grid-cols-[1fr,auto] items-center p-4 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
                 <span className="font-mono text-sm truncate">{biz.name}</span>
                 <span className="font-mono text-[10px] uppercase border border-[#141414] px-1.5 py-0.5">{biz.status}</span>
               </div>
             ))}
           </div>
        </div>
        <div className="border-b border-r border-[#141414]">
          <h2 className="font-['Georgia',_serif] italic text-xs uppercase tracking-[0.05em] opacity-50 p-4 border-b border-[#141414]">Recent Users</h2>
          <div className="divide-y divide-[#141414]">
             {users.slice(0, 5).map(user => (
               <div key={user.uid} className="grid grid-cols-[1fr,auto] items-center p-4 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
                 <span className="font-mono text-sm truncate">{user.displayName || 'Unknown'}</span>
                 <span className="font-mono text-[10px] uppercase opacity-60">{user.role}</span>
               </div>
             ))}
           </div>
        </div>
      </section>
    </div>
  );
}

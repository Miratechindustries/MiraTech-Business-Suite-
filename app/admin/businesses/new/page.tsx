'use client'

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewBusinessPage() {
  const router = useRouter();
  const { user } = useAppStore();
  const isAuthorized = user?.role === 'MASTER_ADMIN';
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currency: 'USD',
    status: 'active',
    description: '',
    logo: '',
    letterhead: '',
    adminEmail: ''
  });

  if (!isAuthorized) {
    return <div className="p-8 text-slate-500 font-mono">Access Denied</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'businesses'), {
        ...formData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ownerId: user?.uid // Assuming current admin becomes owner or handled differently
      });
      toast.success('Company added successfully');
      router.push('/admin/dashboard');
    } catch (error) {
      console.error(error);
      toast.error('Failed to add company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 bg-[#E4E3E0] min-h-screen text-[#141414]">
      <header className="flex items-center gap-4">
        <Link href="/admin/dashboard" className="p-2 hover:bg-black/10 rounded-full">
            <ArrowLeft size={20} />
        </Link>
        <h1 className="font-['Georgia',_serif] italic text-4xl">Add New Company</h1>
      </header>
      
      <div className="max-w-xl bg-white border border-[#141414] p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Company Name" className="w-full p-2 border border-[#141414]" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <input type="email" placeholder="Email" className="w-full p-2 border border-[#141414]" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          <input type="text" placeholder="Currency (e.g., USD)" className="w-full p-2 border border-[#141414]" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} required />
          <textarea placeholder="Description" className="w-full p-2 border border-[#141414]" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          <input type="text" placeholder="Logo URL" className="w-full p-2 border border-[#141414]" value={formData.logo} onChange={e => setFormData({...formData, logo: e.target.value})} />
          <input type="text" placeholder="Letterhead URL" className="w-full p-2 border border-[#141414]" value={formData.letterhead} onChange={e => setFormData({...formData, letterhead: e.target.value})} />
          <input type="email" placeholder="Initial Admin Email" className="w-full p-2 border border-[#141414]" value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} />
          <select className="w-full p-2 border border-[#141414] bg-white" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          
          <button type="submit" className="w-full bg-black text-white py-2 font-bold hover:bg-slate-800 disabled:opacity-50" disabled={loading}>
            {loading ? 'Adding...' : 'Add Company'}
          </button>
        </form>
      </div>
    </div>
  );
}

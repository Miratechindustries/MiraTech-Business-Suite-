'use client'

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';

interface AddCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanyAdded: () => void;
}

export default function AddCompanyModal({ isOpen, onClose, onCompanyAdded }: AddCompanyModalProps) {
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [letterheadFile, setLetterheadFile] = useState<File | null>(null);
  const [letterheadPreview, setLetterheadPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileSetter: React.Dispatch<React.SetStateAction<File | null>>, previewSetter: React.Dispatch<React.SetStateAction<string | null>>) => {
    const file = e.target.files?.[0] || null;
    fileSetter(file);
    if (file) {
      const url = URL.createObjectURL(file);
      previewSetter(url);
    } else {
      previewSetter(null);
    }
  };
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currency: 'USD',
    phone: '',
    address: '',
    website: '',
    description: '',
    adminEmail: '',
    adminPassword: '',
    status: 'active'
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Password validation: min 8 chars, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(formData.adminPassword)) {
      toast.error('Password must be at least 8 characters long, and include an uppercase letter, a lowercase letter, and a number.');
      return;
    }

    // Website URL validation
    if (formData.website) {
      try {
        new URL(formData.website);
      } catch (e) {
        toast.error('Please enter a valid website URL.');
        return;
      }
    }

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'businesses'), {
        ...formData,
        logo: '',
        letterhead: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const updates: Record<string, string> = { logo: '', letterhead: '' };

      if (logoFile) {
        const storageRef = ref(storage, `businesses/${docRef.id}/logo`);
        await uploadBytes(storageRef, logoFile);
        updates.logo = await getDownloadURL(storageRef);
      }

      if (letterheadFile) {
        const storageRef = ref(storage, `businesses/${docRef.id}/letterhead`);
        await uploadBytes(storageRef, letterheadFile);
        updates.letterhead = await getDownloadURL(storageRef);
      }

      await updateDoc(docRef, updates);

      toast.success('Company added successfully');
      onCompanyAdded();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add company');
    } finally {
      setLoading(false);
      setLogoFile(null);
      setLetterheadFile(null);
      setLogoPreview(null);
      setLetterheadPreview(null);
      setFormData({
        name: '',
        email: '',
        currency: 'USD',
        phone: '',
        address: '',
        website: '',
        description: '',
        adminEmail: '',
        adminPassword: '',
        status: 'active'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Add New Company</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Company Name" className="w-full p-2 border rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <input type="email" placeholder="Email" className="w-full p-2 border rounded-lg" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          <input type="text" placeholder="Currency (e.g., USD)" className="w-full p-2 border rounded-lg" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} required />
          <input type="text" placeholder="Phone" className="w-full p-2 border rounded-lg" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          <input type="text" placeholder="Address" className="w-full p-2 border rounded-lg" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          <input type="url" placeholder="Website URL" className="w-full p-2 border rounded-lg" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
          <textarea placeholder="Description" className="w-full p-2 border rounded-lg" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select className="w-full p-2 border rounded-lg" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Company Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 border rounded-lg flex items-center justify-center overflow-hidden bg-slate-100">
                {logoPreview ? <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" /> : <span className="text-xs text-slate-400">No logo</span>}
              </div>
              <input type="file" accept="image/*" onChange={e => handleFileChange(e, setLogoFile, setLogoPreview)} className="w-full p-2 border rounded-lg" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Company Letterhead</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 border rounded-lg flex items-center justify-center overflow-hidden bg-slate-100">
                {letterheadPreview ? <img src={letterheadPreview} alt="Letterhead preview" className="w-full h-full object-cover" /> : <span className="text-xs text-slate-400">No letter</span>}
              </div>
              <input type="file" accept="image/*" onChange={e => handleFileChange(e, setLetterheadFile, setLetterheadPreview)} className="w-full p-2 border rounded-lg" />
            </div>
          </div>
          <input type="email" placeholder="Initial Admin Email" className="w-full p-2 border rounded-lg" value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} />
          <input type="password" placeholder="Initial Admin Password" className="w-full p-2 border rounded-lg" value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})} />
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold" disabled={loading}>
            {loading ? 'Adding...' : 'Add Company'}
          </button>
        </form>
      </div>
    </div>
  );
}

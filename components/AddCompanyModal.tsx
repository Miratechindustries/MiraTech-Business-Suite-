'use client'

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { db, storage, auth } from '@/lib/firebase';
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
      const user = auth.currentUser;
      const docRef = await addDoc(collection(db, 'businesses'), {
        ...formData,
        ownerId: user?.uid || 'system',
        logo: '',
        letterhead: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      // Initialize default trial subscription
      const trialDuration = 14 * 24 * 60 * 60 * 1000; // 14 days
      await addDoc(collection(db, 'subscriptions'), {
        businessId: docRef.id,
        planId: 'trial_default', // Placeholder until they select a real plan
        status: 'trialing',
        startDate: Date.now(),
        endDate: Date.now() + trialDuration,
        trialEndDate: Date.now() + trialDuration,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: Date.now() + trialDuration,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] dark:bg-slate-900 max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-8 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 italic tracking-tight uppercase">Registration_New_Entity</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Corporate business unit deployment</p>
          </div>
          <button 
            onClick={onClose} 
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth">
          {/* Visual Identity Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.25em] flex items-center gap-2">
              <span className="h-1 w-4 bg-blue-600 rounded-full" />
              Visual_Assets
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group relative border-2 border-dashed border-slate-200 rounded-2xl p-4 transition-all hover:border-blue-600/30 hover:bg-blue-50/20">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Corporate Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden bg-white shadow-sm ring-4 ring-slate-50 transition-all group-hover:ring-blue-100">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-6 h-6 border-2 border-slate-200 rounded-md border-t-blue-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input 
                      type="file" 
                      id="logo-upload"
                      accept="image/*" 
                      onChange={e => handleFileChange(e, setLogoFile, setLogoPreview)} 
                      className="hidden"
                    />
                    <label htmlFor="logo-upload" className="inline-block px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg cursor-pointer hover:bg-slate-800 transition-all active:scale-95">
                      Choose Logo
                    </label>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">SVG, PNG or JPG (Max 2MB)</p>
                  </div>
                </div>
              </div>

              <div className="group relative border-2 border-dashed border-slate-200 rounded-2xl p-4 transition-all hover:border-blue-600/30 hover:bg-blue-50/20">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Letterhead Base</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden bg-white shadow-sm ring-4 ring-slate-50 transition-all group-hover:ring-blue-100">
                    {letterheadPreview ? (
                      <img src={letterheadPreview} alt="Letterhead preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="h-full w-full flex flex-col justify-between p-3">
                         <div className="h-1 w-full bg-slate-200 rounded" />
                         <div className="h-1 w-2/3 bg-slate-100 rounded" />
                         <div className="h-1 w-1/2 bg-slate-50 rounded" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input 
                      type="file" 
                      id="letter-upload"
                      accept="image/*" 
                      onChange={e => handleFileChange(e, setLetterheadFile, setLetterheadPreview)} 
                      className="hidden"
                    />
                    <label htmlFor="letter-upload" className="inline-block px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg cursor-pointer hover:bg-slate-800 transition-all active:scale-95">
                      Upload Head
                    </label>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Minimal Letterhead Overlay</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Primary Details */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.25em] flex items-center gap-2">
              <span className="h-1 w-4 bg-blue-600 rounded-full" />
              Core_Identity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company Name</label>
                <input type="text" placeholder="e.g. Miratech Industries" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-slate-300" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entity Primary Email</label>
                <input type="email" placeholder="billing@company.com" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-slate-300" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operational Currency</label>
                <input type="text" placeholder="USD" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-slate-300" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
                <input type="text" placeholder="+1 (555) 000-0000" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-slate-300" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="col-span-1 md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Official Site Reference</label>
                <input type="url" placeholder="https://www.company.com" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-slate-300" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
              </div>
              <div className="col-span-1 md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Physical Address</label>
                <input type="text" placeholder="123 Industrial Way, Silicon Valley, CA" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-slate-300" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="col-span-1 md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Narrative</label>
                <textarea rows={3} placeholder="Briefly describe the entity's core operations..." className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-slate-300 resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
            </div>
          </section>

          {/* Authorization & Governance */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.25em] flex items-center gap-2">
              <span className="h-1 w-4 bg-blue-600 rounded-full" />
              Security_Deployment
            </h3>
            <div className="bg-slate-900 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Master Email</label>
                <input type="email" placeholder="admin@enterprise.com" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-600" value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Protocol (Password)</label>
                <input type="password" placeholder="••••••••" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-600" value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})} required />
              </div>
              <div className="col-span-1 md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Deployment Status</label>
                <select className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white focus:border-blue-500 outline-none transition-all cursor-pointer appearance-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option value="active">ACTIVE_PROTOCOL</option>
                  <option value="pending">PENDING_REVIEW</option>
                  <option value="suspended">SUSPENDED_OPS</option>
                </select>
              </div>
            </div>
          </section>

          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-[0.25em] shadow-2xl shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Initializing...
              </span>
            ) : (
              'Execute_deployment'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

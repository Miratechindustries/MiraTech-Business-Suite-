'use client';

import { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAction } from '../lib/audit';
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Palette, 
  Trash2, 
  Edit3, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  X,
  Plus
} from "lucide-react";
import { SUBSCRIPTION_PLANS, getLockedFeaturesForPlan } from '../lib/subscriptions';

export default function CompaniesTable() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit State
  const [editingCompany, setEditingCompany] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPrimaryColor, setEditPrimaryColor] = useState('#0F172A');
  const [editSecondaryColor, setEditSecondaryColor] = useState('#3B82F6');
  const [editLockedFeatures, setEditLockedFeatures] = useState<string[]>([]);
  const [editSubscriptionPlanId, setEditSubscriptionPlanId] = useState('starter');
  const [editSubscriptionStatus, setEditSubscriptionStatus] = useState('trialing');
  const [editLogo, setEditLogo] = useState('');
  const [editLetterheadLogo, setEditLetterheadLogo] = useState('');
  const [editFavicon, setEditFavicon] = useState('');
  const [editLetterheadWidthFit, setEditLetterheadWidthFit] = useState(false);
  const [editUseCompanyLetterhead, setEditUseCompanyLetterhead] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Delete State
  const [deleteConfirmCompany, setDeleteConfirmCompany] = useState<any | null>(null);
  const [typedConfirmName, setTypedConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({ ...doc.data() }));

      setCompanies(companiesData);
      setUsers(usersData);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch companies and system metadata.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getActiveUserCount = (companyId: string) => {
    return users.filter(u => u.companyId === companyId && (u.status === 'ACTIVE' || !u.status)).length;
  };

  const handleEditClick = (company: any) => {
    setEditingCompany(company);
    setEditName(company.name || '');
    setEditEmail(company.email || '');
    setEditPhone(company.phone || '');
    setEditAddress(company.address || '');
    setEditPrimaryColor(company.primaryColor || '#0F172A');
    setEditSecondaryColor(company.secondaryColor || '#3B82F6');
    setEditLockedFeatures(company.lockedFeatures || []);
    setEditSubscriptionPlanId(company.subscriptionPlanId || 'starter');
    setEditSubscriptionStatus(company.subscriptionStatus || 'trialing');
    setEditLogo(company.logo || '');
    setEditLetterheadLogo(company.letterheadLogo || '');
    setEditFavicon(company.favicon || '');
    setEditLetterheadWidthFit(company.letterheadWidthFit || false);
    setEditUseCompanyLetterhead(company.useCompanyLetterhead || false);
    setSuccessMsg(null);
    setError(null);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const updatedData = {
        name: editName,
        email: editEmail,
        phone: editPhone,
        address: editAddress,
        primaryColor: editPrimaryColor,
        secondaryColor: editSecondaryColor,
        lockedFeatures: getLockedFeaturesForPlan(editSubscriptionPlanId),
        subscriptionPlanId: editSubscriptionPlanId,
        subscriptionStatus: editSubscriptionStatus,
        logo: editLogo,
        letterheadLogo: editLetterheadLogo,
        favicon: editFavicon,
        letterheadWidthFit: editLetterheadWidthFit,
        useCompanyLetterhead: editUseCompanyLetterhead
      };

      // 1. Update in companies collection
      const companyRef = doc(db, 'companies', editingCompany.id);
      await updateDoc(companyRef, updatedData);

      // 2. Sync to businesses collection
      try {
        const businessRef = doc(db, 'businesses', editingCompany.id);
        await updateDoc(businessRef, updatedData);
      } catch (e) {
        console.warn('Businesses doc was not present, skipping sync');
      }

      // 3. Log Audit trail
      await logAction(
        'Company Profile Updated by Master',
        `Master admin updated contact and branding details for "${editName}" (${editingCompany.id}).`,
        editingCompany.id
      );

      // 4. Update local state
      setCompanies(prev => prev.map(c => c.id === editingCompany.id ? { ...c, ...updatedData } : c));
      setSuccessMsg('Company settings saved successfully.');
      setTimeout(() => {
        setEditingCompany(null);
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError('Failed to save company information updates.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (company: any) => {
    setDeleteConfirmCompany(company);
    setTypedConfirmName('');
    setError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmCompany) return;
    if (typedConfirmName.trim().toLowerCase() !== deleteConfirmCompany.name.trim().toLowerCase()) {
      setError('Confirmation match string failed. Please enter the precise company name.');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const cid = deleteConfirmCompany.id;

      // 1. Delete company document
      await deleteDoc(doc(db, 'companies', cid));

      // 2. Delete business document
      try {
        await deleteDoc(doc(db, 'businesses', cid));
      } catch (err) {
        console.warn('Business profile was not found to delete.');
      }

      // 3. Find and Delete associated Firestore users to avoid orphan profiles
      const userQueries = query(collection(db, 'users'), where('companyId', '==', cid));
      const userSnap = await getDocs(userQueries);
      
      let deletedUsersCount = 0;
      for (const userDoc of userSnap.docs) {
        await deleteDoc(doc(db, 'users', userDoc.id));
        deletedUsersCount++;
      }

      // 4. Record details in System Audit Log
      await logAction(
        'Company Extinguished',
        `Master admin permanently deleted company "${deleteConfirmCompany.name}" (${cid}) and purged ${deletedUsersCount} associated client users from Firestore.`,
        cid
      );

      // 5. Update local view state instantly
      setCompanies(prev => prev.filter(c => c.id !== cid));
      setUsers(prev => prev.filter(u => u.companyId !== cid));
      setDeleteConfirmCompany(null);
    } catch (err: any) {
      console.error(err);
      setError('Error while completing corporate teardown sequence: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && companies.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 bg-white border border-slate-100 rounded-lg">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        <span className="text-[10px] text-slate-400 font-medium font-sans">Querying enterprise directory...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upper Alerts & Status Box */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <h4 className="font-bold text-red-800">System Handshake Interrupted</h4>
            <p className="text-red-650 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 tracking-tight">Active Enterprises</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Edit, audit, or purge active business workspaces and brand assets.</p>
          </div>
          <span className="bg-slate-100 text-slate-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-slate-200">
            {companies.length} Registered
          </span>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30 border-b border-slate-100">
                <th className="p-4 pl-6">Company Name</th>
                <th className="p-4">Primary Contact & Support</th>
                <th className="p-4">Active Staff</th>
                <th className="p-4">Subscription Plan</th>
                <th className="p-4">Brand Asset Color</th>
                <th className="p-4">Registration Date</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/40 transition">
                  {/* Name Block */}
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-black uppercase text-xs" style={{ backgroundColor: c.primaryColor || '#0284c7' }}>
                        {(c.name || "A").charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono select-all">{c.id}</div>
                      </div>
                    </div>
                  </td>

                  {/* Primary Contact */}
                  <td className="p-4">
                    <div className="space-y-0.5">
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span>{c.email}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Active Users */}
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-150 text-slate-700">
                      <span>{getActiveUserCount(c.id)} accounts</span>
                    </span>
                  </td>

                  {/* Subscription Plan Column */}
                  <td className="p-4">
                    <div className="space-y-0.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border tracking-tight ${
                        c.subscriptionPlanId === 'enterprise'
                          ? 'bg-purple-50 text-purple-700 border-purple-150'
                          : c.subscriptionPlanId === 'elite'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-150'
                            : c.subscriptionPlanId === 'professional'
                              ? 'bg-blue-50 text-blue-700 border-blue-150'
                              : c.subscriptionPlanId === 'growth'
                                ? 'bg-amber-50 text-amber-700 border-amber-150'
                                : 'bg-slate-50 text-slate-700 border-slate-150'
                      }`}>
                        {SUBSCRIPTION_PLANS.find(p => p.id === (c.subscriptionPlanId || 'starter'))?.name || 'Starter'}
                      </span>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">
                        Status: {c.subscriptionStatus || 'trialing'}
                      </div>
                    </div>
                  </td>

                  {/* Brand Color Theme */}
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: c.primaryColor || '#0F172A' }} />
                      <span className="font-mono text-slate-500 uppercase text-[10px]">{c.primaryColor || '#0f172a'}</span>
                    </div>
                  </td>

                  {/* Created At */}
                  <td className="p-4 text-slate-500">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A'}
                  </td>

                  {/* Action Column */}
                  <td className="p-4 pr-6 text-right space-x-2">
                    <button
                      onClick={() => handleEditClick(c)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-705 rounded-md font-semibold transition cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3 text-slate-500" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(c)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-red-100 hover:border-red-200 bg-red-50/50 hover:bg-red-50 text-red-650 rounded-md font-semibold transition cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Company Modal Dialog */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-3xs">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-650" />
                  Edit Enterprise Workspace
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Workspace ID: {editingCompany.id}</p>
              </div>
              <button 
                onClick={() => setEditingCompany(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCompany} className="p-6 space-y-4">
              {successMsg && (
                <div className="flex items-center gap-2 p-3 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg">
                  <CheckCircle2 className="h-4 w-4" />
                  {successMsg}
                </div>
              )}

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Company Legal Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/20 focus:outline-hidden focus:border-slate-405"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/20 focus:outline-hidden focus:border-slate-405"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      required
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/20 focus:outline-hidden focus:border-slate-405"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">Corporate Headquarters Address</label>
                  <textarea
                    required
                    rows={2}
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/20 focus:outline-hidden focus:border-slate-405"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Primary Brand Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editPrimaryColor}
                        onChange={(e) => setEditPrimaryColor(e.target.value)}
                        className="h-8 w-10 border border-slate-200 rounded-md cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editPrimaryColor}
                        onChange={(e) => setEditPrimaryColor(e.target.value)}
                        className="flex-1 px-2.5 py-1 border border-slate-200 rounded-md font-mono text-[11px] uppercase"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Secondary Brand Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editSecondaryColor}
                        onChange={(e) => setEditSecondaryColor(e.target.value)}
                        className="h-8 w-10 border border-slate-200 rounded-md cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editSecondaryColor}
                        onChange={(e) => setEditSecondaryColor(e.target.value)}
                        className="flex-1 px-2.5 py-1 border border-slate-200 rounded-md font-mono text-[11px] uppercase"
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-3">
                  <span className="block font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                    🖼️ Brand Image Assets
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Logo Upload */}
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-655 text-[10px] uppercase">
                        Company Logo
                      </label>
                      <div className="h-16 w-full bg-white border border-slate-200 rounded-lg flex items-center justify-center p-1 overflow-hidden relative group">
                        {editLogo ? (
                          <img
                            src={editLogo}
                            alt="Logo"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[9px] text-slate-400 font-bold uppercase">No Logo</span>
                        )}
                      </div>
                      <label className="block cursor-pointer text-center px-1.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-[10px] text-slate-700 font-bold rounded-md shadow-3xs transition">
                        Upload Logo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 3145728) {
                                alert("Image must be smaller than 3MB.");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => setEditLogo(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Letterhead Upload */}
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-655 text-[10px] uppercase">
                        Letterhead Logo
                      </label>
                      <div className="h-16 w-full bg-white border border-slate-200 rounded-lg flex items-center justify-center p-1 overflow-hidden relative group">
                        {editLetterheadLogo ? (
                          <img
                            src={editLetterheadLogo}
                            alt="Letterhead"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[9px] text-slate-400 font-bold uppercase">No Letterhead</span>
                        )}
                      </div>
                      <label className="block cursor-pointer text-center px-1.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-[10px] text-slate-700 font-bold rounded-md shadow-3xs transition">
                        Upload Logo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 3145728) {
                                alert("Image must be smaller than 3MB.");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => setEditLetterheadLogo(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Favicon/Icon Upload */}
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-655 text-[10px] uppercase">
                        Favicon (Icon)
                      </label>
                      <div className="h-16 w-full bg-white border border-slate-200 rounded-lg flex items-center justify-center p-1 overflow-hidden relative group">
                        {editFavicon ? (
                          <img
                            src={editFavicon}
                            alt="Favicon"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[9px] text-slate-400 font-bold uppercase">No Icon</span>
                        )}
                      </div>
                      <label className="block cursor-pointer text-center px-1.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-[10px] text-slate-700 font-bold rounded-md shadow-3xs transition">
                        Upload Icon
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 3145728) {
                                alert("Image must be smaller than 3MB.");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => setEditFavicon(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editUseCompanyLetterhead}
                        onChange={(e) => setEditUseCompanyLetterhead(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-bold text-[10px] text-slate-700">Extend Letterhead as Full-Width Top Banner</span>
                    </label>

                    {editUseCompanyLetterhead && (
                      <label className="flex items-center gap-2 cursor-pointer select-none pl-5 animate-fade-in">
                        <input
                          type="checkbox"
                          checked={editLetterheadWidthFit}
                          onChange={(e) => setEditLetterheadWidthFit(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-bold text-[10px] text-slate-700">Stretched Width Fit (Full Width & Cover)</span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-105">
                  <span className="block font-bold text-slate-800 text-xs mb-1 bg-blue-50/50 p-2.5 rounded-lg border border-blue-105 flex items-center justify-between">
                    <span>💳 Corporate Subscription Setup</span>
                  </span>
                  <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                    <div>
                      <label className="block font-bold text-slate-605 mb-1">Assigned Plan Option</label>
                      <select
                        value={editSubscriptionPlanId}
                        onChange={(e) => setEditSubscriptionPlanId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-slate-50/30 font-bold"
                      >
                        {SUBSCRIPTION_PLANS.map(p => (
                          <option key={p.id} value={p.id}>{p.name} - E{p.price}/mo</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-605 mb-1">Billing Status</label>
                      <select
                        value={editSubscriptionStatus}
                        onChange={(e) => setEditSubscriptionStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-slate-50/30 font-bold"
                      >
                        <option value="trialing">14-Day Free Trial</option>
                        <option value="active">Active Subscription</option>
                        <option value="cancelled">Cancelled Plan</option>
                        <option value="unpaid">Unpaid / Suspended</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <span className="block font-bold text-slate-700 text-xs mb-1">
                    🔐 Access Governance & Locked Features (Aligned automatically with plan)
                  </span>
                  <p className="text-[10px] text-slate-400 mb-3">
                    The following features are automatically configured, allowed, or restricted based on the corporate subscription plan selected above.
                  </p>

                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    {[
                      { id: "dashboard", label: "Dashboard" },
                      { id: "inventory", label: "Inventory" },
                      { id: "clients", label: "Clients/Customers" },
                      { id: "quotations", label: "Quotations" },
                      { id: "invoices", label: "Invoices & Ledger" },
                      { id: "receipts", label: "Receipts" },
                      { id: "transactions", label: "Transactions" },
                      { id: "reports", label: "Reports & Analytics" },
                      { id: "audit_center", label: "Audit Center" },
                      { id: "audit", label: "Audit Logs" },
                      { id: "settings", label: "Settings" },
                      { id: "subscriptions", label: "Subscriptions Panel" },
                    ].map((feat) => {
                      const isLocked = getLockedFeaturesForPlan(editSubscriptionPlanId).includes(feat.id);
                      return (
                        <div
                          key={feat.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition ${
                            isLocked
                              ? "bg-red-50/60 border-red-150 text-red-650 opacity-60"
                              : "bg-emerald-50/40 border-emerald-150 text-emerald-800"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!isLocked}
                            readOnly
                            className="rounded text-indigo-600 focus:ring-0 cursor-not-allowed pointer-events-none"
                          />
                          <span className="font-semibold text-[10px]">{feat.label} {isLocked ? '(Locked)' : '(Allowed)'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-50 rounded-lg cursor-pointer transition flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save Workspace Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-3xs">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 bg-red-50 flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-650 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-red-900 tracking-tight">Extinguish Workspace</h3>
                <p className="text-[10px] text-red-600 mt-0.5">This action is permanent and irreversible.</p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-lg space-y-1 text-slate-650">
                <p>This teardown sequence will permanently extinguish:</p>
                <ul className="list-disc pl-5 font-bold space-y-0.5 mt-1 text-slate-800">
                  <li>Enterprise profile: &quot;{deleteConfirmCompany.name}&quot;</li>
                  <li>Branding, colors, document configurations</li>
                  <li>Associated client staff user directories ({getActiveUserCount(deleteConfirmCompany.id)} users)</li>
                </ul>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Type <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-red-600 select-all">{deleteConfirmCompany.name}</span> to authorize destruction:
                </label>
                <input
                  type="text"
                  value={typedConfirmName}
                  onChange={(e) => setTypedConfirmName(e.target.value)}
                  placeholder="Exact company name"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/20 focus:outline-hidden focus:border-red-400 placeholder-slate-400 font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmCompany(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting || typedConfirmName.trim().toLowerCase() !== deleteConfirmCompany.name.trim().toLowerCase()}
                  className="px-5 py-2 bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 rounded-lg cursor-pointer transition flex items-center gap-1.5 shadow-xs"
                >
                  {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Confirm Permanent Destruct
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

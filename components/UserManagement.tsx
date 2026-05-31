'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Role } from '../lib/types';
import { logAction } from '../lib/audit';
import { 
  Users, 
  Plus, 
  Trash2, 
  Loader2, 
  Eye, 
  EyeOff, 
  Check, 
  ShieldAlert, 
  UserPlus2, 
  Key, 
  UserCheck2 
} from 'lucide-react';

export default function UserManagement() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('STAFF');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    try {
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompanies(companiesData);

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    } catch (err) {
      console.error("Error loading user management directory:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const togglePasswordVisibility = (userId: string) => {
    setRevealedPasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Helper to register users in Firebase Auth securely without breaking master session
  const createAuthUserSecondary = async (emailInput: string, passwordInput: string): Promise<string> => {
    const secondaryAppName = `UserMgtApp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailInput, passwordInput);
      const uid = userCredential.user.uid;
      await signOut(secondaryAuth);
      return uid;
    } finally {
      await deleteApp(secondaryApp);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !selectedCompanyId) {
      setError('Please fill in all layout fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // 1. Check if email is already listed locally
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('This email address is already registered in the system.');
      }

      // 2. Auth Creation
      const userUid = await createAuthUserSecondary(email, password);

      // 3. User Document Creation using setDoc with Auth UID
      const userPayload = {
        email,
        role,
        companyId: selectedCompanyId,
        businessId: selectedCompanyId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        rawPassword: password // Plain password credentials auditable by Master Admin
      };

      await setDoc(doc(db, 'users', userUid), userPayload);

      // Log database audit trail
      await logAction(
        'User Account Provisioned',
        `Provisioned credentials and authorized level ${role} for account "${email}" (UID: ${userUid}).`,
        selectedCompanyId
      );

      setSuccess(`Account ${email} created & provisioned successfully with UID: ${userUid}`);
      setEmail('');
      setPassword('');
      fetchData();
    } catch (err: any) {
      console.error(err);
      if (err?.code === 'auth/email-already-in-use' || err?.message?.includes('email-already-in-use')) {
        setError('This email address is already in use by another account in Firebase Authentication.');
      } else {
        setError(err?.message || 'Failed to populate user registration credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (userId: string) => {
    try {
      const u = users.find(x => x.id === userId);
      await updateDoc(doc(db, 'users', userId), { status: 'DEACTIVATED' });
      
      // Log Action
      await logAction(
        'User Suspended',
        `Deactivated and suspended system access for account "${u?.email || 'Unknown'}" (ID: ${userId}).`,
        u?.companyId || 'SYSTEM'
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to deactivate user');
    }
  };

  const handleActivate = async (userId: string) => {
    try {
      const u = users.find(x => x.id === userId);
      await updateDoc(doc(db, 'users', userId), { status: 'ACTIVE' });
      
      // Log Action
      await logAction(
        'User Restored',
        `Restored and activated system access for account "${u?.email || 'Unknown'}" (ID: ${userId}).`,
        u?.companyId || 'SYSTEM'
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to activate user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const u = users.find(x => x.id === userId);
    if (!u) return;

    if (!confirm(`Are you absolutely sure you want to permanently delete user account "${u.email}" from the registry?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));

      // Log Action
      await logAction(
        'User Permanently Deleted',
        `Permanently removed and purged access for user account "${u.email}" (ID: ${userId}).`,
        u.companyId || 'SYSTEM'
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete user');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
        <Users className="w-5.5 h-5.5 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-900 tracking-tight">System Roster & Credentials Manager</h2>
          <p className="text-xs text-slate-500 font-medium">Verify account directories and inspect emails & plain-text password credentials.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Creation Form */}
        <div className="lg:col-span-4">
          <form onSubmit={handleInvite} className="space-y-4 bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
            <h3 className="font-bold text-xs uppercase tracking-widest text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <UserPlus2 className="w-4 h-4 text-blue-600" /> Create Custom Account
            </h3>

            {error && (
              <p className="text-[11px] font-semibold bg-red-50 text-red-600 p-2.5 border border-red-150 rounded-lg">
                {error}
              </p>
            )}

            {success && (
              <p className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 p-2.5 border border-emerald-150 rounded-lg">
                {success}
              </p>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">User Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="employee@business.com" 
                className="w-full text-xs font-medium border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden transition" 
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Authentication Password</label>
              <input 
                type="text" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Plain password (min 8 chars)" 
                className="w-full text-xs font-mono font-medium border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden transition text-slate-700" 
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Authorization Privilege</label>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value as Role)} 
                className="w-full text-xs font-bold border border-slate-200 p-2 rounded-lg bg-slate-50"
              >
                <option value="STAFF">Staff (Standard Ledger Clerk)</option>
                <option value="BUSINESS_ADMIN">Business Admin (Workspace Owner)</option>
                <option value="MASTER_ADMIN">Master Admin (System Supervisor)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Corporate Association</label>
              <select 
                value={selectedCompanyId} 
                onChange={(e) => setSelectedCompanyId(e.target.value)} 
                className="w-full text-xs font-bold border border-slate-200 p-2 rounded-lg bg-slate-50"
                required
              >
                <option value="">Select Company</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 text-xs rounded-lg transition shadow-xs cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Provisioning Auth Account...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Provision User Account
                </>
              )}
            </button>
          </form>
        </div>

        {/* Existing Users Table */}
        <div className="lg:col-span-8">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <h3 className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs uppercase tracking-widest text-slate-600 flex items-center gap-1.5">
              <UserCheck2 className="w-4 h-4 text-emerald-600" /> Active System & Credentials Directory
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200 leading-none">
                    <th className="p-3">User Email Address</th>
                    <th className="p-3">Role Status</th>
                    <th className="p-3">Workspace Business</th>
                    <th className="p-3">Email Password Credentials</th>
                     <th className="p-3 text-right pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-xs text-slate-700 divide-y divide-slate-100">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-slate-50/45 transition">
                      <td className="p-3 font-semibold text-slate-800">{u.email}</td>
                      <td className="p-3 font-bold text-[10px]">
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase border tracking-wider ${
                          u.role === 'MASTER_ADMIN' 
                            ? 'bg-rose-50 text-rose-700 border-rose-100' 
                            : u.role === 'BUSINESS_ADMIN' 
                              ? 'bg-blue-50 text-blue-700 border-blue-105' 
                              : 'bg-amber-50 text-amber-700 border-amber-105'
                        }`}>
                          {u.role || 'STAFF'}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-600">
                        {companies.find(c => c.id === u.companyId)?.name || 'Direct / System Node'}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {u.rawPassword ? (
                          <div className="flex items-center gap-1.5">
                            <input 
                              type={revealedPasswords[u.id] ? "text" : "password"} 
                              value={u.rawPassword} 
                              readOnly 
                              className="bg-transparent border-0 font-mono text-xs text-slate-700 focus:ring-0 p-0 w-24 outline-hidden leading-none select-all"
                            />
                            <button 
                              onClick={() => togglePasswordVisibility(u.id)}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                              title="Toggle plain-text view"
                            >
                              {revealedPasswords[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-sans text-slate-400">Master Secret Only</span>
                        )}
                      </td>
                      <td className="p-3 text-right pr-6 space-x-2">
                        {u.role !== 'MASTER_ADMIN' && u.email?.toLowerCase() !== 'miratechindustries@gmail.com' ? (
                          <>
                            {u.status === 'DEACTIVATED' ? (
                              <button 
                                onClick={() => handleActivate(u.id)} 
                                className="text-[11px] font-extrabold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-1 rounded transition cursor-pointer"
                              >
                                Activate
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleDeactivate(u.id)} 
                                className="text-[11px] font-extrabold text-slate-550 hover:text-slate-705 hover:bg-slate-100/70 px-2 py-1 rounded transition cursor-pointer"
                              >
                                Deactivate
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteUser(u.id)} 
                              className="inline-flex items-center justify-center p-1.5 text-red-550 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Permanently Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold italic">Locked System super</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

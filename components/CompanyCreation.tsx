'use client';

import { useState } from 'react';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from '../lib/firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { SUBSCRIPTION_PLANS, getLockedFeaturesForPlan } from '../lib/subscriptions';
import { 
  Building2, 
  User, 
  Users, 
  Mail, 
  Lock, 
  Plus, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  Eye, 
  EyeOff,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StaffInput {
  email: string;
  password: string;
}

export default function CompanyCreation() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Status logs shown during workspace provisioning
  const [statusLogs, setStatusLogs] = useState<string[]>([]);

  // Company details
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [subscriptionPlanId, setSubscriptionPlanId] = useState('starter');

  // Primary Admin Account
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);

  // Staff accounts listing
  const [staffList, setStaffList] = useState<StaffInput[]>([]);
  const [currentStaffEmail, setCurrentStaffEmail] = useState('');
  const [currentStaffPassword, setCurrentStaffPassword] = useState('');
  const [showStaffPass, setShowStaffPass] = useState(false);

  const addStaffMember = () => {
    if (!currentStaffEmail || !currentStaffPassword) {
      setError('Please provide staff email and password first');
      return;
    }
    if (currentStaffPassword.length < 8) {
      setError('Staff password must be at least 8 characters');
      return;
    }
    if (staffList.some(s => s.email.toLowerCase() === currentStaffEmail.toLowerCase())) {
      setError('Email is already added to provision list');
      return;
    }
    setStaffList([...staffList, { email: currentStaffEmail, password: currentStaffPassword }]);
    setCurrentStaffEmail('');
    setCurrentStaffPassword('');
    setError(null);
  };

  const removeStaffMember = (index: number) => {
    setStaffList(staffList.filter((_, i) => i !== index));
  };

  const logStatus = (message: string) => {
    setStatusLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Helper to create Firebase Auth user without breaking master session
  const createAuthUserSecondary = async (emailInput: string, passwordInput: string): Promise<string> => {
    const secondaryAppName = `ProvisionApp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !address || !adminEmail || !adminPassword) {
      setError('Please fill in all company and admin fields.');
      return;
    }
    if (adminPassword.length < 8) {
      setError('Admin password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError(null);
    setStatusLogs([]);
    logStatus(`Initializing corporate workspace provisioning for: "${name}"...`);

    try {
      // 1. Create the Administration Auth Account
      logStatus(`Provisioning corporate administrator account: ${adminEmail}...`);
      const adminUid = await createAuthUserSecondary(adminEmail, adminPassword);
      logStatus(`Corporate Administrator authentication provisioned successfully. (UID: ${adminUid})`);

      // 2. Create Staff Auth Accounts
      const staffUids: string[] = [];
      for (const staff of staffList) {
        logStatus(`Provisioning staff account: ${staff.email}...`);
        const staffUid = await createAuthUserSecondary(staff.email, staff.password);
        staffUids.push(staffUid);
        logStatus(`Staff account ${staff.email} authenticated. (UID: ${staffUid})`);
      }

      // 3. Write Company Workspace Profiles (Write to both /companies and /businesses using adminUid as unified key)
      logStatus(`Syncing company visual letterhead & profiles...`);
      const companyPayload = {
        id: adminUid,
        ownerId: adminUid,
        name,
        email,
        phone,
        address,
        createdAt: new Date().toISOString(),
        primaryColor: "#0F172A",
        secondaryColor: "#3B82F6",
        favicon: "",
        logo: "",
        letterheadLogo: "",
        subscriptionPlanId,
        subscriptionStatus: 'trialing',
        subscriptionTrialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        subscriptionTrialStartedAt: new Date().toISOString(),
        lockedFeatures: getLockedFeaturesForPlan(subscriptionPlanId)
      };

      await setDoc(doc(db, 'companies', adminUid), companyPayload);
      await setDoc(doc(db, 'businesses', adminUid), companyPayload);
      logStatus(`Tenant profiles established on /companies/${adminUid} and /businesses/${adminUid}.`);

      // 4. Create User Documents in Firestore
      logStatus(`Mapping administrator role in workspace metadata...`);
      await setDoc(doc(db, 'users', adminUid), {
        email: adminEmail,
        role: 'BUSINESS_ADMIN',
        companyId: adminUid,
        businessId: adminUid,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        rawPassword: adminPassword, // Enables master admin inspection
      });

      for (let i = 0; i < staffList.length; i++) {
        const staff = staffList[i];
        const staffUid = staffUids[i];
        logStatus(`Mapping staff role for: ${staff.email}...`);
        await setDoc(doc(db, 'users', staffUid), {
          email: staff.email,
          role: 'STAFF',
          companyId: adminUid,
          businessId: adminUid,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          rawPassword: staff.password, // Enables master admin inspection
        });
      }

      // 5. Append Centralized Audit logs
      logStatus(`Recording workspace system event audit log...`);
      await addDoc(collection(db, 'audit_logs'), {
        companyId: adminUid,
        businessId: adminUid,
        action: 'COMPANY_PROVISIONED_BY_MASTER_ADMIN',
        detail: `Master Admin successfully provisioned corporate workspace '${name}' with admin account ${adminEmail} and ${staffList.length} staff member accounts.`,
        timestamp: new Date().toISOString(),
        actor: 'Master Admin'
      });

      logStatus(`Workspace directory provisioned & synced successfully!`);
      setSuccess(true);
      
      // Clear forms
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setAdminEmail('');
      setAdminPassword('');
      setStaffList([]);
    } catch (err: any) {
      console.error(err);
      let errMsg = err?.message || 'Failed to complete provision sequence.';
      if (err?.code === 'auth/email-already-in-use' || err?.message?.includes('email-already-in-use')) {
        errMsg = 'One of the provided emails is already in use by another account in Firebase Authentication.';
      }
      setError(errMsg);
      logStatus(`[FATAL ERROR] Provisioning canceled: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-900 tracking-tight">Provision Corporate Tenant Workspace</h2>
          <p className="text-xs text-slate-500 font-medium">Instantly establish an isolated business node with associated Admin and Staff accounts.</p>
        </div>
        <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
          <Briefcase className="w-3.5 h-3.5" /> Private Gateway
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-6">
        {error && (
          <div className="p-4 text-xs font-semibold bg-red-50 text-red-600 border border-red-150 rounded-xl">
            {error}
          </div>
        )}

        <AnimatePresence>
          {success && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-3 p-4 bg-emerald-50 text-emerald-800 border border-emerald-250 rounded-xl"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Corporate Provision Complete!</p>
                <p className="text-xs text-emerald-600 mt-0.5">The tenant environment and login accounts are fully functional. Administrators and employees can now log in securely using their email and passwords.</p>
                <button 
                  type="button" 
                  onClick={() => setSuccess(false)}
                  className="mt-2 text-xs font-extrabold underline block hover:text-emerald-950"
                >
                  Configure Another Business
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Legal Company profile */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Building2 className="w-4.5 h-4.5 text-blue-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Company Information</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Legal Company Name</label>
                <input 
                  type="text" 
                  value={name} 
                  required
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. MiraTech Systems Ltd" 
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contact Email</label>
                  <input 
                    type="email" 
                    value={email} 
                    required
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="corp@domain.com" 
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contact Phone</label>
                  <input 
                    type="tel" 
                    value={phone} 
                    required
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="+27 12 345 6789" 
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Corporate HQ Address</label>
                <textarea 
                  value={address} 
                  required
                  rows={3}
                  onChange={(e) => setAddress(e.target.value)} 
                  placeholder="e.g. Block A, 12 Tech Drive, Sandton, Johannesburg" 
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Initial Subscription Tier (14-Day Trial Included)</label>
                <select
                  value={subscriptionPlanId}
                  onChange={(e) => setSubscriptionPlanId(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden transition"
                >
                  {SUBSCRIPTION_PLANS.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - E{plan.price.toLocaleString()}/mo
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Corporate Administrator Account Setup */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <User className="w-4.5 h-4.5 text-blue-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Corporate Administrator</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-150 rounded-lg text-[11px] text-blue-700 leading-normal font-sans">
                The administrator holds full corporate read/write control over this organization, including staff roster logs and visual customizations.
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Administrator Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input 
                    type="email" 
                    value={adminEmail} 
                    required
                    onChange={(e) => setAdminEmail(e.target.value)} 
                    placeholder="admin@tenantdomain.com" 
                    className="w-full pl-9 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Administrator Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input 
                    type={showAdminPass ? "text" : "password"} 
                    value={adminPassword} 
                    required
                    onChange={(e) => setAdminPassword(e.target.value)} 
                    placeholder="Temporary login password (min 8 chars)" 
                    className="w-full pl-9 pr-10 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowAdminPass(!showAdminPass)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Employee/Staff Provision dynamic listing */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-blue-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Roster Staff Accounts ({staffList.length})</h3>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {/* Adding item form */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Staff Email Address</label>
                <input 
                  type="email" 
                  value={currentStaffEmail}
                  onChange={(e) => setCurrentStaffEmail(e.target.value)}
                  placeholder="staff@tenantdomain.com" 
                  className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-105 transition"
                />
              </div>

              <div className="md:col-span-5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Staff Login Password</label>
                <div className="relative">
                  <input 
                    type={showStaffPass ? "text" : "password"} 
                    value={currentStaffPassword}
                    onChange={(e) => setCurrentStaffPassword(e.target.value)}
                    placeholder="Login password (min 8 chars)" 
                    className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg pl-3 pr-10 py-2 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-105 transition"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowStaffPass(!showStaffPass)} 
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showStaffPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <button 
                  type="button" 
                  onClick={addStaffMember}
                  className="w-full inline-flex items-center justify-center gap-1 bg-slate-800 text-white hover:bg-slate-900 font-bold text-xs px-3 py-2 rounded-lg cursor-pointer transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Log
                </button>
              </div>
            </div>

            {/* Added list display */}
            {staffList.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-450 font-medium font-sans">Optional: Dynamic staff roster is currently empty. Staff can also be added later under User Management.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="p-3">Roster Email</th>
                      <th className="p-3">Assigned Role</th>
                      <th className="p-3">Plain Password credentials</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((st, sIdx) => (
                      <tr key={sIdx} className="border-b last:border-0 text-xs text-slate-700 hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800">{st.email}</td>
                        <td className="p-3 text-[10px]"><span className="bg-amber-50 text-amber-700 px-2.0 py-0.5 rounded-full font-bold border border-amber-100 uppercase tracking-wide">STAFF</span></td>
                        <td className="p-3 font-mono text-slate-500">{st.password}</td>
                        <td className="p-3 text-center">
                          <button 
                            type="button" 
                            onClick={() => removeStaffMember(sIdx)}
                            className="text-red-500 hover:text-red-700 p-1 rounded-md transition hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Advanced Provisioning Log section */}
        {statusLogs.length > 0 && (
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 overflow-hidden shadow-md">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 font-sans flex items-center gap-1.5 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span> Provisioning Console Log Trace
            </h4>
            <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[10px] text-slate-350 leading-relaxed">
              {statusLogs.map((logStr, lIdx) => (
                <div key={lIdx} className={logStr.includes('ERROR') ? 'text-red-400 font-bold' : logStr.includes('successfully') || logStr.includes('Complete') ? 'text-emerald-400' : ''}>
                  {logStr}
                </div>
              ))}
            </div>
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading || !name}
          className="w-full flex items-center justify-center gap-2 bg-[#0066FF] text-white hover:bg-blue-700 font-bold text-sm py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-55"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Provisioning Corporate Workspace Infrastructure...
            </>
          ) : (
            `Launch & Provision Active Corporate Tenant (${staffList.length + 1} Accounts)`
          )}
        </button>
      </form>
    </div>
  );
}

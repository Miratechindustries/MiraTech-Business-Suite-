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
  Briefcase,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StaffInput {
  email: string;
  password: string;
  departments: string[];
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
  const [currentStaffDepts, setCurrentStaffDepts] = useState<string[]>([]);

  // Customizable Theme / Branding Settings
  const [themePreset, setThemePreset] = useState("default");
  const [primaryColor, setPrimaryColor] = useState("#0F172A");
  const [secondaryColor, setSecondaryColor] = useState("#3B82F6");
  const [themeMode, setThemeMode] = useState("light");
  const [fontFamily, setFontFamily] = useState("inter");
  const [cardRadius, setCardRadius] = useState("md");

  // Customizable Security Settings
  const [inactivityTimeout, setInactivityTimeout] = useState(900);
  const [threatLevel, setThreatLevel] = useState("elevated");
  const [mfaEnforced, setMfaEnforced] = useState(true);
  const [argon2Iterations, setArgon2Iterations] = useState(4);
  const [argon2SaltLength, setArgon2SaltLength] = useState(16);

  const AVAILABLE_DEPARTMENTS = [
    { id: "sales", name: "Sales & CRM" },
    { id: "finance", name: "Finance & Accounting" },
    { id: "hr", name: "HR & Payroll" },
    { id: "inventory", name: "Inventory Stock" },
    { id: "projects", name: "Projects & Tasks" },
    { id: "reports", name: "Reports & Analytics" },
    { id: "support", name: "Customer Support" },
    { id: "procurement", name: "Procurement" },
    { id: "marketing", name: "Marketing Hub" },
    { id: "audit", name: "Security Audit Logs" },
    { id: "executive", name: "Executive Lounge" }
  ];

  const applyPreset = (preset: string) => {
    setThemePreset(preset);
    if (preset === "default") {
      setPrimaryColor("#0F172A");
      setSecondaryColor("#3B82F6");
    } else if (preset === "corporate") {
      setPrimaryColor("#1E3A8A");
      setSecondaryColor("#3B82F6");
    } else if (preset === "forest") {
      setPrimaryColor("#064E3B");
      setSecondaryColor("#10B981");
    } else if (preset === "sunset") {
      setPrimaryColor("#78350F");
      setSecondaryColor("#F59E0B");
    } else if (preset === "midnight") {
      setPrimaryColor("#1E1B4B");
      setSecondaryColor("#6366F1");
    } else if (preset === "ocean") {
      setPrimaryColor("#0C4A6E");
      setSecondaryColor("#0EA5E9");
    } else if (preset === "neon") {
      setPrimaryColor("#581C87");
      setSecondaryColor("#D946EF");
    }
  };

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
    setStaffList([...staffList, { 
      email: currentStaffEmail, 
      password: currentStaffPassword,
      departments: currentStaffDepts
    }]);
    setCurrentStaffEmail('');
    setCurrentStaffPassword('');
    setCurrentStaffDepts([]);
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
        primaryColor,
        secondaryColor,
        themePreset,
        themeMode,
        fontFamily,
        cardRadius,
        inactivityTimeout,
        threatLevel,
        mfaEnforced,
        argon2Iterations,
        argon2SaltLength,
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
          departments: staff.departments || []
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
      setThemePreset('default');
      setPrimaryColor('#0F172A');
      setSecondaryColor('#3B82F6');
      setThemeMode('light');
      setFontFamily('inter');
      setCardRadius('md');
      setInactivityTimeout(900);
      setThreatLevel('elevated');
      setMfaEnforced(true);
      setArgon2Iterations(4);
      setArgon2SaltLength(16);
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

        {/* Theme and Security Customizations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Theme Settings Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-blue-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Enterprise Theme and Branding</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Theme Palette Preset</label>
                  <select
                    value={themePreset}
                    onChange={(e) => applyPreset(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden transition"
                  >
                    <option value="default">Default Slate</option>
                    <option value="corporate">Corporate Blue</option>
                    <option value="forest">Emerald Forest</option>
                    <option value="sunset">Amber Sunset</option>
                    <option value="midnight">Indigo Midnight</option>
                    <option value="ocean">Ocean Sky</option>
                    <option value="neon">Vibrant Purple</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Default Theme Mode</label>
                  <select
                    value={themeMode}
                    onChange={(e) => setThemeMode(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden transition"
                  >
                    <option value="light">Pure Light</option>
                    <option value="warm">Warm Cream</option>
                    <option value="dim">Dim Gray</option>
                    <option value="dark">Dark Charcoal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Corporate Primary Color</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={primaryColor} 
                      onChange={(e) => {
                        setPrimaryColor(e.target.value);
                        setThemePreset("custom");
                      }}
                      className="w-10 h-10 border border-slate-200 rounded-lg p-0 cursor-pointer bg-transparent"
                    />
                    <input 
                      type="text" 
                      value={primaryColor} 
                      onChange={(e) => {
                        setPrimaryColor(e.target.value);
                        setThemePreset("custom");
                      }}
                      className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-2 focus:bg-white focus:outline-hidden transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Corporate Secondary Color</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={secondaryColor} 
                      onChange={(e) => {
                        setSecondaryColor(e.target.value);
                        setThemePreset("custom");
                      }}
                      className="w-10 h-10 border border-slate-200 rounded-lg p-0 cursor-pointer bg-transparent"
                    />
                    <input 
                      type="text" 
                      value={secondaryColor} 
                      onChange={(e) => {
                        setSecondaryColor(e.target.value);
                        setThemePreset("custom");
                      }}
                      className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-2 focus:bg-white focus:outline-hidden transition"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Corporate Font Family</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden transition"
                  >
                    <option value="inter">Inter (Modern Sans)</option>
                    <option value="space_grotesk">Space Grotesk (Tech Sans)</option>
                    <option value="playfair">Playfair Display (Serif)</option>
                    <option value="jetbrains_mono">JetBrains Mono (Mono Code)</option>
                    <option value="outfit">Outfit (Geometric Sans)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Border Card Radius</label>
                  <select
                    value={cardRadius}
                    onChange={(e) => setCardRadius(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden transition"
                  >
                    <option value="none">Square (none)</option>
                    <option value="md">Medium (md)</option>
                    <option value="lg">Large (lg)</option>
                    <option value="xl">Extra Large (xl)</option>
                    <option value="full">Capsule (full)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Security Protocols Settings Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-blue-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Security & Operational Protocols</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Inactivity TTL Timeout</label>
                  <select
                    value={inactivityTimeout}
                    onChange={(e) => setInactivityTimeout(parseInt(e.target.value))}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden transition"
                  >
                    <option value="300">5 Minutes</option>
                    <option value="900">15 Minutes</option>
                    <option value="1800">30 Minutes</option>
                    <option value="3600">1 Hour</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">WAF Threat Engine Mode</label>
                  <select
                    value={threatLevel}
                    onChange={(e) => setThreatLevel(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden transition"
                  >
                    <option value="low">Low Mode</option>
                    <option value="elevated">Elevated WAF</option>
                    <option value="high">High Restriction</option>
                    <option value="paranoia">Paranoia Lock</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Argon2 Password passes</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={16}
                    value={argon2Iterations}
                    onChange={(e) => setArgon2Iterations(parseInt(e.target.value))}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Argon2 Salt Size (Bytes)</label>
                  <input 
                    type="number" 
                    min={8} 
                    max={64}
                    value={argon2SaltLength}
                    onChange={(e) => setArgon2SaltLength(parseInt(e.target.value))}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-hidden transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-150">
                <div>
                  <span className="text-[10px] font-bold text-slate-700 block">Enforce MFA Authentication</span>
                  <span className="text-[9px] text-slate-400 font-semibold block leading-tight">Restrict standard staff portals to OTP metrics</span>
                </div>
                <input
                  type="checkbox"
                  checked={mfaEnforced}
                  onChange={(e) => setMfaEnforced(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
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
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Staff Email Address</label>
                  <input 
                    type="email" 
                    value={currentStaffEmail}
                    onChange={(e) => setCurrentStaffEmail(e.target.value)}
                    placeholder="staff@tenantdomain.com" 
                    className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-105 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Staff Login Password</label>
                  <div className="relative">
                    <input 
                      type={showStaffPass ? "text" : "password"} 
                      value={currentStaffPassword}
                      onChange={(e) => setCurrentStaffPassword(e.target.value)}
                      placeholder="Login password (min 8 chars)" 
                      className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg pl-3 pr-10 py-2.5 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-105 transition"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowStaffPass(!showStaffPass)} 
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showStaffPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Assign Staff Departments / Allowed Workspaces
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {AVAILABLE_DEPARTMENTS.map((dept) => {
                    const isChecked = currentStaffDepts.includes(dept.id);
                    return (
                      <label key={dept.id} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setCurrentStaffDepts(currentStaffDepts.filter(id => id !== dept.id));
                            } else {
                              setCurrentStaffDepts([...currentStaffDepts, dept.id]);
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span>{dept.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-200 pt-3">
                <button 
                  type="button" 
                  onClick={addStaffMember}
                  className="inline-flex items-center justify-center gap-1.5 bg-slate-800 text-white hover:bg-slate-900 font-bold text-xs px-5 py-2.5 rounded-lg cursor-pointer transition shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add Staff To Provision List
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
                      <th className="p-3">Assigned Role / Workspace Access</th>
                      <th className="p-3">Plain Password credentials</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((st, sIdx) => (
                      <tr key={sIdx} className="border-b last:border-0 text-xs text-slate-700 hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800">{st.email}</td>
                        <td className="p-3 text-[10px]">
                          <div className="space-y-1">
                            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-100 uppercase tracking-wide">STAFF</span>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {st.departments && st.departments.length > 0 ? (
                                st.departments.map(d => (
                                  <span key={d} className="bg-slate-100 text-slate-600 text-[8px] font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                    {AVAILABLE_DEPARTMENTS.find(ad => ad.id === d)?.name || d}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[8px] font-bold text-red-500 bg-red-50 border border-red-150 px-1.5 rounded-md">No workspace access</span>
                              )}
                            </div>
                          </div>
                        </td>
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

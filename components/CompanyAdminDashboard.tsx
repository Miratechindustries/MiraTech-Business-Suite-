'use client';

import { useState, useEffect, useCallback } from 'react';
import { db, auth as importAuth, handleFirestoreError, OperationType, isOfflineError } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, addDoc, deleteDoc, query, where } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { useUserStore, useToastStore } from '../lib/store';
import { logAction } from '../lib/audit';
import { Role, CompanyData } from '../lib/types';
import { 
  SUPPORTED_CURRENCIES, 
  formatCurrency, 
  getCurrencySymbol, 
  getCurrencyInfo, 
  convertFromUSD,
  formatPlanPrice 
} from '../lib/currency';
import { 
  SUBSCRIPTION_PLANS, 
  SubscriptionPlan, 
  getConvertedPlanPrice, 
  calculateTrialDaysRemaining, 
  isTrialActive, 
  checkUserQuota 
} from '../lib/subscriptions';
import { 
  Building2, 
  Users, 
  Palette, 
  CreditCard, 
  Shield, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Coins, 
  Plus, 
  Trash2, 
  Edit3, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  FileText, 
  Stamp, 
  Image as ImageIcon, 
  Lock, 
  Unlock, 
  Check, 
  AlertTriangle, 
  Loader2, 
  Crown, 
  Key, 
  RefreshCw, 
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Smartphone,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CompanyOnboarding from './CompanyOnboarding';

export default function CompanyAdminDashboard() {
  const { currentUser, setCurrentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'branding' | 'billing' | 'onboarding'>('overview');
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  // Edit Company Profile fields
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [industry, setIndustry] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('SZL');

  // Brand / Letterhead fields
  const [logo, setLogo] = useState('');
  const [letterheadHeader, setLetterheadHeader] = useState('');
  const [letterheadFooter, setLetterheadFooter] = useState('');
  const [digitalStamp, setDigitalStamp] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0F172A');
  const [secondaryColor, setSecondaryColor] = useState('#3B82F6');
  const [themePreset, setThemePreset] = useState('corporate');

  // Add User Modal / Form State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserAuthMethod, setNewUserAuthMethod] = useState<'google' | 'password'>('google');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newUserRole, setNewUserRole] = useState<Role>('STAFF');
  const [newUserPosition, setNewUserPosition] = useState('Operations Officer');
  const [newUserDepts, setNewUserDepts] = useState<string[]>(['sales']);
  const [canApproveQuotes, setCanApproveQuotes] = useState(false);
  const [canApproveInvoices, setCanApproveInvoices] = useState(false);
  const [canOverrideHR, setCanOverrideHR] = useState(false);
  const [canFinalizeDocuments, setCanFinalizeDocuments] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);

  // Billing / Payment Modal State
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'unayo' | 'card' | 'eft'>('momo');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const DEPARTMENTS = [
    { id: 'sales', label: 'Sales & CRM' },
    { id: 'finance', label: 'Finance & Invoicing' },
    { id: 'hr', label: 'HR & Payroll' },
    { id: 'inventory', label: 'Inventory Stock' },
    { id: 'projects', label: 'Projects & Tasks' },
    { id: 'procurement', label: 'Procurement' },
    { id: 'support', label: 'Customer Support' },
    { id: 'pos', label: 'POS Point of Sale' }
  ];

  const targetCompanyId = currentUser?.companyId || currentUser?.businessId || importAuth.currentUser?.uid;

  const isCompanyAdmin = 
    currentUser?.role === 'BUSINESS_ADMIN' ||
    currentUser?.role === 'COMPANY_ADMIN' ||
    currentUser?.role === 'COMPANY_OWNER' ||
    currentUser?.role === 'MANAGING_DIRECTOR' ||
    currentUser?.role === 'MASTER_ADMIN';

  const fetchCompanyData = useCallback(async () => {
    if (!targetCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // 1. Fetch Company Doc
      const docRef = doc(db, 'companies', targetCompanyId);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data() as CompanyData;
        setCompany(data);
        setName(data.name || '');
        setRegistrationNumber(data.registrationNumber || '');
        setTaxNumber(data.taxNumber || '');
        setIndustry(data.industry || 'Technology & Software');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setWebsite(data.website || '');
        setAddress(data.address || '');
        setCity(data.city || 'Mbabane');
        setCountry(data.country || 'Eswatini');
        setCurrency(data.currency || 'SZL');
        setLogo(data.logo || '');
        setLetterheadHeader(data.letterheadHeader || data.letterheadLogo || '');
        setLetterheadFooter(data.letterheadFooter || 'Corporate Disclaimers & Banking Details');
        setDigitalStamp(data.digitalStamp || '');
        setPrimaryColor(data.primaryColor || '#0F172A');
        setSecondaryColor(data.secondaryColor || '#3B82F6');
        setThemePreset(data.themePreset || 'corporate');

        // Check if onboarding needs to be completed
        if (data.isOnboardingCompleted === false) {
          setActiveTab('onboarding');
        }
      } else {
        // Look up in businesses collection
        const bSnap = await getDoc(doc(db, 'businesses', targetCompanyId));
        if (bSnap.exists()) {
          const bData = bSnap.data() as any;
          setCompany(bData);
          setName(bData.name || '');
          setCurrency(bData.currency || 'SZL');
        }
      }

      // 2. Fetch Users associated with this Company
      const usersQuery = query(collection(db, 'users'), where('companyId', '==', targetCompanyId));
      const usersSnap = await getDocs(usersQuery);
      const usersList = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // If no users returned with companyId, also check businessId
      if (usersList.length === 0) {
        const bUsersQuery = query(collection(db, 'users'), where('businessId', '==', targetCompanyId));
        const bUsersSnap = await getDocs(bUsersQuery);
        const bUsersList = bUsersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCompanyUsers(bUsersList);
      } else {
        setCompanyUsers(usersList);
      }

      // 3. Fetch Pending Invitations / Pre-Authorizations for this Company
      try {
        const invQuery = query(
          collection(db, 'user_invitations'),
          where('companyId', '==', targetCompanyId),
          where('status', '==', 'pending')
        );
        const invSnap = await getDocs(invQuery);
        const invList = invSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPendingInvitations(invList);
      } catch (invErr) {
        console.warn('Error loading pending invitations:', invErr);
      }
    } catch (err: any) {
      console.warn('Error loading company portal data:', err);
      // Try local cache
      const cached = localStorage.getItem(`miratech_offline_company_${targetCompanyId}`);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          setCompany(data);
          setName(data.name || '');
          setCurrency(data.currency || 'SZL');
        } catch (e) {}
      }
    } finally {
      setLoading(false);
    }
  }, [targetCompanyId]);

  useEffect(() => {
    fetchCompanyData();
  }, [fetchCompanyData]);

  // Handle saving company settings
  const handleSaveCompanySettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetCompanyId || !isCompanyAdmin) {
      addToast('Permission denied: Only Company Administrators can modify company settings.', 'error');
      return;
    }

    setSavingSettings(true);
    const currencyInfo = getCurrencyInfo(currency);

    const updatedData: Partial<CompanyData> = {
      name: name.trim(),
      registrationNumber: registrationNumber.trim(),
      taxNumber: taxNumber.trim(),
      industry,
      phone: phone.trim(),
      email: email.trim(),
      website: website.trim(),
      address: address.trim(),
      city: city.trim(),
      country: country.trim(),
      currency: currencyInfo.code,
      currencySymbol: currencyInfo.symbol,
      logo,
      letterheadLogo: letterheadHeader || logo,
      letterheadHeader,
      letterheadFooter,
      digitalStamp,
      primaryColor,
      secondaryColor,
      themePreset,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'companies', targetCompanyId), updatedData);
      await updateDoc(doc(db, 'businesses', targetCompanyId), updatedData);

      localStorage.setItem(
        `miratech_offline_company_${targetCompanyId}`,
        JSON.stringify({ ...company, ...updatedData })
      );

      setCompany((prev: any) => ({ ...prev, ...updatedData }));

      await logAction(
        'Company Settings Updated',
        `Admin updated company profile for '${name}', active currency set to ${currencyInfo.code} (${currencyInfo.symbol}).`,
        targetCompanyId
      );

      addToast('Company settings & letterhead synchronized successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to update company settings:', err);
      addToast(err?.message || 'Error updating settings. Saved to local cache.', 'warning');
    } finally {
      setSavingSettings(false);
    }
  };

  // Create User Account or Pre-Authorize Google Sign-In
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCompanyId || !isCompanyAdmin) return;

    // Total accounts count (active + pending invitations)
    const totalUserCount = companyUsers.length + pendingInvitations.length;
    const quota = checkUserQuota(totalUserCount, company?.subscriptionPlanId);
    if (!quota.allowed) {
      addToast(
        `User limit reached (${quota.current}/${quota.maxUsers} users). Please upgrade your subscription plan to add more team members.`,
        'warning'
      );
      return;
    }

    if (!newUserEmail || !newUserEmail.includes('@')) {
      addToast('Please enter a valid email address for the user account.', 'warning');
      return;
    }

    // Check if email is already active or invited
    const cleanEmail = newUserEmail.trim().toLowerCase();
    const alreadyActive = companyUsers.some((u) => u.email?.toLowerCase() === cleanEmail);
    const alreadyInvited = pendingInvitations.some((i) => i.email?.toLowerCase() === cleanEmail);

    if (alreadyActive) {
      addToast(`An active account with ${cleanEmail} already exists in this portal.`, 'warning');
      return;
    }
    if (alreadyInvited) {
      addToast(`A pending invitation for ${cleanEmail} is already active.`, 'warning');
      return;
    }

    setIsCreatingUser(true);

    if (newUserAuthMethod === 'google') {
      // Pre-authorize email for Google Sign-In Auto-Detection
      try {
        const invitePayload = {
          companyId: targetCompanyId,
          companyName: company?.name || name,
          email: cleanEmail,
          name: newUserName.trim() || cleanEmail.split('@')[0],
          role: newUserRole,
          position: newUserPosition.trim() || 'Operations Officer',
          departments: newUserDepts.length > 0 ? newUserDepts : ['sales'],
          canApproveQuotations: canApproveQuotes,
          canApproveInvoices: canApproveInvoices,
          canOverrideHR: canOverrideHR,
          canFinalizeDocuments: canFinalizeDocuments,
          approvalRights: canApproveQuotes || canApproveInvoices || canOverrideHR || canFinalizeDocuments,
          authMethod: 'google',
          status: 'pending',
          invitedBy: currentUser?.email || 'Company Administrator',
          invitedAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'user_invitations'), invitePayload);
        setPendingInvitations((prev) => [...prev, { id: docRef.id, ...invitePayload }]);

        await logAction(
          'Google SSO User Pre-Authorized',
          `Pre-authorized ${cleanEmail} for Google Sign-In with role ${newUserRole} in ${company?.name || 'company portal'}.`,
          targetCompanyId
        );

        addToast(`✨ Added ${cleanEmail}! When they sign in with Google, they will be automatically connected to this company portal.`, 'success');
        setShowAddUserModal(false);
        setNewUserEmail('');
        setNewUserName('');
        setNewUserPassword('');
        setNewUserDepts(['sales']);
        setCanApproveQuotes(false);
        setCanApproveInvoices(false);
        setCanOverrideHR(false);
        setCanFinalizeDocuments(false);
      } catch (err: any) {
        console.error('Failed to pre-authorize user:', err);
        addToast(err?.message || 'Failed to pre-authorize user.', 'error');
      } finally {
        setIsCreatingUser(false);
      }
    } else {
      // Email and Password creation
      if (!newUserPassword) {
        addToast('Please enter an account password.', 'warning');
        setIsCreatingUser(false);
        return;
      }

      if (newUserPassword.length < 8) {
        addToast('Password must be at least 8 characters long.', 'warning');
        setIsCreatingUser(false);
        return;
      }

      const secondaryAppName = `PortalProvision_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      try {
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, newUserPassword);
        const uid = userCred.user.uid;
        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);

        const userDocData = {
          id: uid,
          email: cleanEmail,
          name: newUserName.trim() || cleanEmail.split('@')[0],
          displayName: newUserName.trim() || cleanEmail.split('@')[0],
          role: newUserRole,
          position: newUserPosition.trim() || 'Operations Officer',
          companyId: targetCompanyId,
          businessId: targetCompanyId,
          companyName: company?.name || name,
          departments: newUserDepts.length > 0 ? newUserDepts : ['sales'],
          canApproveQuotations: canApproveQuotes,
          canApproveInvoices: canApproveInvoices,
          canOverrideHR: canOverrideHR,
          canFinalizeDocuments: canFinalizeDocuments,
          approvalRights: canApproveQuotes || canApproveInvoices || canOverrideHR || canFinalizeDocuments,
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', uid), userDocData);

        setCompanyUsers((prev) => [...prev, userDocData]);
        setShowAddUserModal(false);
        setNewUserEmail('');
        setNewUserName('');
        setNewUserPassword('');
        setNewUserDepts(['sales']);
        setCanApproveQuotes(false);
        setCanApproveInvoices(false);
        setCanOverrideHR(false);
        setCanFinalizeDocuments(false);

        await logAction(
          'Company Portal User Provisioned',
          `Provisioned user account for ${cleanEmail} with role ${newUserRole} in ${company?.name || 'company portal'}.`,
          targetCompanyId
        );

        addToast(`Successfully created portal access account for ${cleanEmail}!`, 'success');
      } catch (err: any) {
        console.error('Failed to create company user:', err);
        addToast(err?.message || 'Failed to create user account.', 'error');
      } finally {
        setIsCreatingUser(false);
      }
    }
  };

  // Revoke/delete pending invitation
  const handleRevokeInvitation = async (invId: string, email: string) => {
    if (!confirm(`Cancel Google Sign-In pre-authorization for ${email}?`)) return;
    try {
      await deleteDoc(doc(db, 'user_invitations', invId));
      setPendingInvitations((prev) => prev.filter((i) => i.id !== invId));
      addToast(`Canceled Google SSO authorization for ${email}`, 'info');
      await logAction(
        'Google SSO Authorization Revoked',
        `Revoked pending invitation for ${email}`,
        targetCompanyId
      );
    } catch (err: any) {
      addToast('Failed to revoke invitation', 'error');
    }
  };

  // Process Subscription Plan Upgrade / Payment
  const handleProcessUpgrade = async () => {
    if (!selectedPlanForUpgrade || !targetCompanyId) return;
    setPaymentProcessing(true);

    const priceInfo = getConvertedPlanPrice(selectedPlanForUpgrade, currency, billingCycle);

    try {
      // Simulate real-time gateway handshake
      await new Promise((res) => setTimeout(res, 1600));

      const now = new Date();
      const updatedCompanyData: Partial<CompanyData> = {
        subscriptionPlanId: selectedPlanForUpgrade.id as any,
        subscriptionStatus: 'active',
        trialActive: false,
        billingCycle,
        maxUsers: selectedPlanForUpgrade.maxUsers,
        updatedAt: now.toISOString()
      };

      await updateDoc(doc(db, 'companies', targetCompanyId), updatedCompanyData);

      // Record transaction
      await addDoc(collection(db, 'companies', targetCompanyId, 'transactions'), {
        type: 'Subscription Payment',
        planId: selectedPlanForUpgrade.id,
        planName: selectedPlanForUpgrade.name,
        amount: priceInfo.convertedAmount,
        currency: priceInfo.currencyCode,
        currencySymbol: priceInfo.symbol,
        billingCycle,
        method: paymentMethod,
        date: now.toISOString(),
        status: 'completed',
        reference: `MIRA-SUB-${Date.now().toString(36).toUpperCase()}`
      });

      setCompany((prev: any) => ({ ...prev, ...updatedCompanyData }));
      setSelectedPlanForUpgrade(null);

      await logAction(
        'Subscription Upgraded',
        `Company upgraded to ${selectedPlanForUpgrade.name} (${priceInfo.formattedPrice}/${billingCycle}) via ${paymentMethod.toUpperCase()}.`,
        targetCompanyId
      );

      addToast(`🎉 Subscription activated! Welcome to ${selectedPlanForUpgrade.name}.`, 'success');
    } catch (err: any) {
      console.error('Payment processing failed:', err);
      addToast('Payment authorization failed. Please try again.', 'error');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const trialDaysLeft = calculateTrialDaysRemaining(company?.trialEndsAt);
  const isTrial = isTrialActive(company);
  const activePlan = SUBSCRIPTION_PLANS.find((p) => p.id === company?.subscriptionPlanId) || SUBSCRIPTION_PLANS[0];
  const quota = checkUserQuota(companyUsers.length, activePlan.id);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 space-y-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-xs font-bold uppercase tracking-wider">Loading Company Admin Command Center...</p>
      </div>
    );
  }

  if (!isCompanyAdmin) {
    return (
      <div className="p-8 text-center bg-white border border-rose-200 rounded-2xl max-w-xl mx-auto space-y-4 my-8 font-sans">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Administrator Access Restricted</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          The Company Admin Dashboard and settings configuration are strictly reserved for Company Administrators and Managing Directors.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header Card */}
      <div className="bg-slate-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-white/10 text-indigo-200 rounded-full text-xs font-bold backdrop-blur-xs border border-white/10 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-300" />
                Company Admin Dashboard
              </span>
              <span className="px-2.5 py-1 bg-indigo-900/80 text-blue-200 rounded-full text-xs font-mono font-bold border border-indigo-700">
                Operating Currency: {getCurrencySymbol(company?.currency || currency)} ({getCurrencyInfo(company?.currency || currency).code})
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              {company?.name || name || 'Corporate Portal'}
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl font-normal">
              Manage company credentials, customize official PDF letterhead & logos, assign user emails and roles, and configure your multi-tier subscription with dynamic currency exchange.
            </p>
          </div>

          {/* 14-Day Free Trial Tracker Widget */}
          <div className="bg-white/10 border border-white/15 rounded-xl p-4 backdrop-blur-md min-w-[240px] shrink-0 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                {isTrial ? '14-Day Free Trial' : 'Subscription Status'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-black ${
                  isTrial
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                }`}
              >
                {isTrial ? `${trialDaysLeft} Days Left` : company?.subscriptionStatus || 'Active'}
              </span>
            </div>

            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500"
                style={{ width: isTrial ? `${Math.min(100, (trialDaysLeft / 14) * 100)}%` : '100%' }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
              <span>{activePlan.name}</span>
              <button
                type="button"
                onClick={() => setActiveTab('billing')}
                className="text-amber-300 hover:text-amber-200 font-bold underline cursor-pointer"
              >
                {isTrial ? 'Upgrade Plan' : 'Manage Billing'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-8 pt-4 border-t border-white/10 flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'overview', label: 'Company Overview', icon: Building2 },
            { id: 'users', label: 'Portal Users & Roles', icon: Users, badge: companyUsers.length },
            { id: 'branding', label: 'Letterhead & Brand Assets', icon: Palette },
            { id: 'billing', label: 'Subscription & Currency', icon: CreditCard },
            { id: 'onboarding', label: 'Setup Wizard', icon: Sparkles }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-slate-200 text-slate-900' : 'bg-white/20 text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Active Team Seats</span>
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {companyUsers.length} <span className="text-xs text-slate-400 font-normal">/ {activePlan.maxUsers >= 9999 ? '∞' : activePlan.maxUsers} max</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {quota.allowed ? `${quota.remaining} seats remaining` : 'User seat limit reached'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Operating Currency</span>
                <Coins className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {getCurrencySymbol(company?.currency || currency)} <span className="text-xs font-bold text-slate-600">{getCurrencyInfo(company?.currency || currency).code}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {getCurrencyInfo(company?.currency || currency).name}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Active Tier</span>
                <Crown className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-lg font-black text-slate-900">
                {activePlan.name.split(' (')[0]}
              </div>
              <p className="text-[11px] text-emerald-600 font-bold">
                {formatCurrency(convertFromUSD(activePlan.usdPrice, company?.currency || currency), company?.currency || currency)}/mo
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Letterhead Status</span>
                <Palette className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                {company?.letterheadHeader || company?.logo ? (
                  <span className="text-emerald-600 flex items-center gap-1 text-sm font-extrabold">
                    <CheckCircle2 className="w-4 h-4" /> Customized
                  </span>
                ) : (
                  <span className="text-amber-600 text-sm font-bold">Standard</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Frames all PDF quotes & invoices</p>
            </div>
          </div>

          {/* Quick Action Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => {
                setShowAddUserModal(true);
                setActiveTab('users');
              }}
              className="p-5 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 hover:border-indigo-300 rounded-2xl text-left transition shadow-3xs group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">Assign User to Portal</h3>
              <p className="text-xs text-slate-600 mt-1">
                Invite employees, assign operational roles, and configure department permissions.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('branding')}
              className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 hover:border-purple-300 rounded-2xl text-left transition shadow-3xs group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition">
                <Palette className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">Design Letterhead & Brand</h3>
              <p className="text-xs text-slate-600 mt-1">
                Upload corporate banner, official seal stamp, and banking details for PDF documents.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('billing')}
              className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 hover:border-emerald-300 rounded-2xl text-left transition shadow-3xs group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition">
                <Coins className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">Currency & Subscriptions</h3>
              <p className="text-xs text-slate-600 mt-1">
                Switch operational currency (SZL, ZAR, USD) and manage 14-day trial / plan tiers.
              </p>
            </button>
          </div>

          {/* Corporate Profile Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Registered Corporate Information
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('branding')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Profile
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Legal Name</span>
                <span className="font-bold text-slate-800 text-sm">{company?.name || name || 'Not Specified'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Registration / CIPC Number</span>
                <span className="font-medium text-slate-800">{company?.registrationNumber || 'Not Specified'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Tax / VAT ID</span>
                <span className="font-medium text-slate-800">{company?.taxNumber || 'Not Specified'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Corporate Email</span>
                <span className="font-medium text-slate-800">{company?.email || currentUser?.email || 'Not Specified'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Corporate Phone</span>
                <span className="font-medium text-slate-800">{company?.phone || 'Not Specified'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Website</span>
                <span className="font-medium text-slate-800">{company?.website || 'Not Specified'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Physical Address</span>
                <span className="font-medium text-slate-800">
                  {company?.address ? `${company.address}, ${company.city || ''}, ${company.country || ''}` : 'Not Specified'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">System Operating Currency</span>
                <span className="font-extrabold text-indigo-700">
                  {getCurrencySymbol(company?.currency)} ({company?.currency || 'SZL'})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PORTAL USERS & ROLES */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Header & Stats Banner */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Company Portal User Access & Role Directory
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Assign user email accounts to your company portal, manage permissions, and assign operational roles with automatic Google SSO detection.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Capacity Used</span>
                  <span className="text-xs font-mono font-extrabold text-slate-800">
                    {companyUsers.length + pendingInvitations.length} / {activePlan.maxUsers >= 9999 ? '∞' : activePlan.maxUsers} Accounts
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewUserAuthMethod('google');
                    setShowAddUserModal(true);
                  }}
                  className="px-4 py-2 bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add Team Member
                </button>
              </div>
            </div>

            {/* Active Users Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Active Portal Accounts ({companyUsers.length})
                </h3>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3 px-4">User Account</th>
                      <th className="py-3 px-4">Auth Method</th>
                      <th className="py-3 px-4">Assigned Role</th>
                      <th className="py-3 px-4">Corporate Position</th>
                      <th className="py-3 px-4">Permitted Departments</th>
                      <th className="py-3 px-4">Approvals</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {companyUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No active team members yet. Click &quot;Add Team Member&quot; above to authorize staff.
                        </td>
                      </tr>
                    ) : (
                      companyUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-xs">
                                {user.name ? user.name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-extrabold text-slate-900 block">{user.name || user.displayName || user.email}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {user.isGoogleUser ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-[10px] font-bold">
                                🌟 Google SSO
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[10px] font-bold">
                                🔑 Password
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                user.role === 'BUSINESS_ADMIN' || user.role === 'COMPANY_ADMIN'
                                  ? 'bg-purple-100 text-purple-800'
                                  : user.role === 'DEPARTMENT_MANAGER'
                                  ? 'bg-blue-100 text-blue-800'
                                  : user.role === 'ACCOUNTANT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-700">{user.position || 'Staff'}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {user.departments && user.departments.length > 0 ? (
                                user.departments.map((d: string) => (
                                  <span
                                    key={d}
                                    className="px-1.5 py-0.2 bg-slate-100 border border-slate-200 rounded text-[9px] font-medium uppercase text-slate-600"
                                  >
                                    {d}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 text-[10px]">All Access</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1 text-[10px]">
                              {user.canApproveQuotations && (
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold">
                                  Quotes
                                </span>
                              )}
                              {user.canApproveInvoices && (
                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-bold">
                                  Invoices
                                </span>
                              )}
                              {user.canOverrideHR && (
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-bold">
                                  HR
                                </span>
                              )}
                              {user.canFinalizeDocuments && (
                                <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-bold">
                                  Tax Docs
                                </span>
                              )}
                              {!user.canApproveQuotations && !user.canApproveInvoices && !user.canOverrideHR && !user.canFinalizeDocuments && (
                                <span className="text-slate-400">Standard</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {user.email !== currentUser?.email && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm(`Revoke portal access for ${user.email}?`)) {
                                    try {
                                      await deleteDoc(doc(db, 'users', user.id));
                                      setCompanyUsers((prev) => prev.filter((u) => u.id !== user.id));
                                      addToast(`Revoked access for ${user.email}`, 'info');
                                    } catch (e) {
                                      addToast('Failed to remove user', 'error');
                                    }
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Revoke Access"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pending Pre-Authorized Google SSO Invitations Section */}
            {pendingInvitations.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold text-amber-700 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" /> Pre-Authorized Google SSO Invitations ({pendingInvitations.length})
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      These email addresses are authorized. When the user logs in with Google Sign-In, the system will automatically detect them and link them to this portal.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-amber-200/60 bg-amber-50/20 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-amber-200/50 text-[10px] font-bold text-amber-800 uppercase tracking-wider bg-amber-100/40">
                        <th className="py-2.5 px-4">Authorized Email</th>
                        <th className="py-2.5 px-4">Name / Title</th>
                        <th className="py-2.5 px-4">Designated Role</th>
                        <th className="py-2.5 px-4">Assigned Depts</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {pendingInvitations.map((inv) => (
                        <tr key={inv.id} className="hover:bg-amber-50/60 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-[10px]">
                                {inv.email.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-bold text-slate-900 font-mono text-xs">{inv.email}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700">
                            {inv.name || 'Team Member'} <span className="text-slate-400 text-[10px]">({inv.position || 'Staff'})</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 bg-white border border-amber-300 text-amber-900 font-extrabold rounded-md text-[10px]">
                              {inv.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {inv.departments?.map((d: string) => (
                                <span key={d} className="px-1.5 py-0.2 bg-white border border-slate-200 text-slate-600 rounded text-[9px] uppercase font-bold">
                                  {d}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-extrabold animate-pulse">
                              <Sparkles className="w-3 h-3 text-amber-600" /> Awaiting Google Sign-In
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `Hi! You have been invited to join ${company?.name || 'our company'} on Mira Business Suite. Simply click 'Sign in with Google' using your email (${inv.email}) to access our portal!`
                                  );
                                  addToast('Copied invitation message to clipboard!', 'success');
                                }}
                                className="px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 cursor-pointer"
                                title="Copy invitation instructions"
                              >
                                Copy Instructions
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Cancel Authorization"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Provision User Modal */}
          <AnimatePresence>
            {showAddUserModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-indigo-600" />
                        Add Portal Team Member
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Configure access credentials and operational permissions for your company.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddUserModal(false)}
                      className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                    {/* Auth Method Selector */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1.5">
                        Authentication Method <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewUserAuthMethod('google')}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                            newUserAuthMethod === 'google'
                              ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
                            <span>🌟 Google Sign-In SSO</span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight">
                            Auto-detected when the user logs in with Google. No password needed.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNewUserAuthMethod('password')}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                            newUserAuthMethod === 'password'
                              ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
                            <span>🔑 Email & Password</span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight">
                            Set up direct login credentials with a custom password.
                          </p>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="e.g. Sipho Dlamini"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Email Address <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="employee@gmail.com"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                        />
                      </div>
                    </div>

                    {newUserAuthMethod === 'password' && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Initial Account Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            placeholder="Min 8 characters"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Portal Role</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as Role)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-medium"
                        >
                          <option value="COMPANY_ADMIN">Company Administrator</option>
                          <option value="DEPARTMENT_MANAGER">Department Manager</option>
                          <option value="SALES_REP">Sales Representative</option>
                          <option value="ACCOUNTANT">Accountant / Finance</option>
                          <option value="INVENTORY_OFFICER">Inventory Officer</option>
                          <option value="HR_OFFICER">HR & Payroll Officer</option>
                          <option value="STAFF">Standard Staff</option>
                          <option value="READ_ONLY">Auditor (Read-Only)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Corporate Position</label>
                        <input
                          type="text"
                          value={newUserPosition}
                          onChange={(e) => setNewUserPosition(e.target.value)}
                          placeholder="e.g. Accounts Supervisor"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1.5">
                        Permitted Department Modules
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {DEPARTMENTS.map((dept) => {
                          const isChecked = newUserDepts.includes(dept.id);
                          return (
                            <button
                              key={dept.id}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  setNewUserDepts(newUserDepts.filter((d) => d !== dept.id));
                                } else {
                                  setNewUserDepts([...newUserDepts, dept.id]);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                isChecked
                                  ? 'bg-indigo-900 text-white shadow-3xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {dept.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Approval Authority Permissions
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={canApproveQuotes}
                            onChange={(e) => setCanApproveQuotes(e.target.checked)}
                            className="rounded text-indigo-600"
                          />
                          <span className="text-xs font-semibold text-slate-700">Approve Quotations</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={canApproveInvoices}
                            onChange={(e) => setCanApproveInvoices(e.target.checked)}
                            className="rounded text-indigo-600"
                          />
                          <span className="text-xs font-semibold text-slate-700">Approve Invoices</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={canOverrideHR}
                            onChange={(e) => setCanOverrideHR(e.target.checked)}
                            className="rounded text-indigo-600"
                          />
                          <span className="text-xs font-semibold text-slate-700">HR & Payroll Override</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={canFinalizeDocuments}
                            onChange={(e) => setCanFinalizeDocuments(e.target.checked)}
                            className="rounded text-indigo-600"
                          />
                          <span className="text-xs font-semibold text-slate-700">Finalize Tax Docs</span>
                        </label>
                      </div>
                    </div>

                    {newUserAuthMethod === 'google' && (
                      <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Auto-Detection Active:</strong> When {newUserEmail || 'this user'} clicks &quot;Sign in with Google&quot;, the system will automatically associate them with your company and grant immediate access.
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowAddUserModal(false)}
                        className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingUser}
                        className="px-5 py-2 bg-indigo-900 hover:bg-indigo-950 text-white font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        {isCreatingUser ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                          </>
                        ) : newUserAuthMethod === 'google' ? (
                          'Pre-Authorize Google SSO'
                        ) : (
                          'Create Account'
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* TAB 3: BRANDING & LETTERHEAD */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveCompanySettings} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-indigo-600" />
                  Corporate Identity, Letterhead & PDF Visuals
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Configure corporate registration details, letterhead banner, digital seal stamps, and brand colors.
                </p>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {savingSettings ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Save & Sync Letterhead
                  </>
                )}
              </button>
            </div>

            {/* Company Identification Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Legal Company Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Registration / CIPC Number
                </label>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="REG-2024-88491"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tax / VAT ID (TIN)
                </label>
                <input
                  type="text"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  placeholder="VAT-100294819"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Corporate Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Corporate Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Operating Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-bold text-indigo-900"
                >
                  {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol}) — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Physical Headquarters Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  City & Country
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Country"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Asset Uploads */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              {/* Logo */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2 text-center">
                <span className="text-xs font-bold text-slate-700 uppercase block">Company Logo / Icon</span>
                <div className="h-24 bg-white border border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden">
                  {logo ? (
                    <img src={logo} alt="Logo" className="max-h-20 max-w-full object-contain p-1" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setLogo(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="text-[11px] text-slate-500 w-full"
                />
              </div>

              {/* Letterhead Banner */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2 text-center">
                <span className="text-xs font-bold text-slate-700 uppercase block">Letterhead Header Banner</span>
                <div className="h-24 bg-white border border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden">
                  {letterheadHeader ? (
                    <img src={letterheadHeader} alt="Header" className="max-h-20 max-w-full object-contain p-1" />
                  ) : (
                    <FileText className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setLetterheadHeader(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="text-[11px] text-slate-500 w-full"
                />
              </div>

              {/* Digital Stamp */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2 text-center">
                <span className="text-xs font-bold text-slate-700 uppercase block">Digital Stamp / Seal</span>
                <div className="h-24 bg-white border border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden">
                  {digitalStamp ? (
                    <img src={digitalStamp} alt="Stamp" className="max-h-20 max-w-full object-contain p-1" />
                  ) : (
                    <Stamp className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setDigitalStamp(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="text-[11px] text-slate-500 w-full"
                />
              </div>
            </div>

            {/* Letterhead Footer */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Official Letterhead Footer & Banking Instructions
              </label>
              <textarea
                rows={2}
                value={letterheadFooter}
                onChange={(e) => setLetterheadFooter(e.target.value)}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
              />
            </div>

            {/* Live Letterhead Preview */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-xs space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Live Document Letterhead Output Preview
              </span>
              <div
                className="p-5 rounded-xl border text-white flex items-center justify-between shadow-xs"
                style={{ backgroundColor: primaryColor }}
              >
                <div className="flex items-center gap-3">
                  {logo && <img src={logo} alt="Logo" className="w-12 h-12 object-contain bg-white rounded p-1" />}
                  <div>
                    <h4 className="font-black text-base">{name || 'Your Company Name'}</h4>
                    <p className="text-xs text-slate-300">
                      {phone || '+268 7600 0000'} | {email || 'info@company.com'} | VAT: {taxNumber || '100294819'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-300 block">TAX INVOICE</span>
                  <span className="font-mono font-bold text-base">
                    {formatCurrency(14850, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: SUBSCRIPTION & DYNAMIC CURRENCY */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  Business Suite Subscriptions & Currency Rates
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Transparent multi-tier pricing with real-time currency conversion based on current foreign exchange rates.
                </p>
              </div>

              {/* Currency Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Workspace Currency:</span>
                <select
                  value={currency}
                  onChange={async (e) => {
                    const newCurr = e.target.value;
                    setCurrency(newCurr);
                    if (targetCompanyId && isCompanyAdmin) {
                      const cInfo = getCurrencyInfo(newCurr);
                      await updateDoc(doc(db, 'companies', targetCompanyId), {
                        currency: cInfo.code,
                        currencySymbol: cInfo.symbol
                      });
                      addToast(`Currency switched to ${cInfo.name} (${cInfo.symbol})`, 'success');
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-extrabold text-indigo-900 focus:outline-hidden cursor-pointer"
                >
                  {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Trial Status Banner */}
            {isTrial && (
              <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                    {trialDaysLeft}d
                  </div>
                  <div>
                    <h4 className="font-extrabold text-emerald-950 text-sm">14-Day Free Trial In Progress</h4>
                    <p className="text-xs text-emerald-800">
                      You have full access to all features in the {activePlan.name}. You can activate your paid plan anytime below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Billing Cycle Switcher */}
            <div className="flex items-center justify-center gap-2">
              <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-1.5 rounded-lg transition cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-4 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    billingCycle === 'annual'
                      ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Annual Billing
                  <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[9px] font-bold">
                    2 Months Free
                  </span>
                </button>
              </div>
            </div>

            {/* 3 Pricing Tiers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const isCurrent = company?.subscriptionPlanId === plan.id;
                const priceInfo = getConvertedPlanPrice(plan, currency, billingCycle);

                return (
                  <div
                    key={plan.id}
                    className={`p-6 rounded-2xl border transition-all flex flex-col justify-between relative ${
                      isCurrent
                        ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-lg'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-2.5 right-6 px-3 py-0.5 bg-indigo-600 text-white text-[10px] font-extrabold rounded-full shadow-xs">
                        MOST POPULAR
                      </span>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-slate-900 text-base">{plan.name}</h3>
                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-extrabold rounded-md">
                            CURRENT PLAN
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 leading-normal min-h-[36px]">
                        {plan.description}
                      </p>

                      <div className="py-3 border-y border-slate-100">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                            {priceInfo.formattedPrice}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          USD Base: ${plan.usdPrice} / mo ({currency})
                        </span>
                      </div>

                      <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center gap-2 text-xs font-bold text-indigo-900">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <span>
                          {plan.maxUsers >= 9999 ? 'Unlimited User Accounts' : `Up to ${plan.maxUsers} User Seats`}
                        </span>
                      </div>

                      <ul className="space-y-2 text-xs text-slate-600 pt-2">
                        {plan.features.slice(0, 8).map((featId) => (
                          <li key={featId} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="capitalize">{featId.replace('_', ' ')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedPlanForUpgrade(plan)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            : 'bg-indigo-900 hover:bg-indigo-950 text-white shadow-xs'
                        }`}
                      >
                        {isCurrent ? 'Renew / Extend Subscription' : `Upgrade to ${plan.name.split(' (')[0]}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment & Checkout Modal */}
          <AnimatePresence>
            {selectedPlanForUpgrade && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-indigo-600" />
                        Complete Subscription Payment
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {selectedPlanForUpgrade.name} ({billingCycle})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPlanForUpgrade(null)}
                      className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Amount Due</span>
                      <span className="text-2xl font-black text-slate-900 font-mono">
                        {getConvertedPlanPrice(selectedPlanForUpgrade, currency, billingCycle).formattedPrice}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold">
                      {currency} ({getCurrencySymbol(currency)})
                    </span>
                  </div>

                  {/* Payment Methods */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">
                      Select Payment Gateway
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'momo', label: 'Eswatini MTN MoMo (+268)' },
                        { id: 'unayo', label: 'Standard Bank Unayo' },
                        { id: 'card', label: 'Visa / Mastercard Secure' },
                        { id: 'eft', label: 'Corporate Bank Transfer (EFT)' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id as any)}
                          className={`p-3 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                            paymentMethod === m.id
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-950'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mobile phone input for MoMo */}
                  {paymentMethod === 'momo' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        MTN Mobile Number
                      </label>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={paymentPhone}
                          onChange={(e) => setPaymentPhone(e.target.value)}
                          placeholder="+268 7600 0000"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setSelectedPlanForUpgrade(null)}
                      className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={paymentProcessing}
                      onClick={handleProcessUpgrade}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {paymentProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Authorizing Payment...
                        </>
                      ) : (
                        `Authorize Payment (${getConvertedPlanPrice(selectedPlanForUpgrade, currency, billingCycle).formattedPrice})`
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* TAB 5: ONBOARDING WIZARD */}
      {activeTab === 'onboarding' && (
        <div className="space-y-4">
          <CompanyOnboarding
            initialCompanyData={company}
            onCompleted={() => {
              fetchCompanyData();
              setActiveTab('overview');
            }}
          />
        </div>
      )}
    </div>
  );
}

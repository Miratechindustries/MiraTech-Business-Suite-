'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db, googleSignIn } from '../../lib/firebase';
import { useUserStore, useToastStore } from '../../lib/store';
import { logAction } from '../../lib/audit';
import { SUPPORTED_CURRENCIES, getCurrencyInfo } from '../../lib/currency';
import { SUBSCRIPTION_PLANS, getConvertedPlanPrice } from '../../lib/subscriptions';
import {
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  Coins,
  ArrowRight,
  Loader2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Shield,
  HelpCircle,
  X,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function RegisterPage() {
  const router = useRouter();
  const { setCurrentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mode: Google Fast-Registration or Email & Password
  const [authMethod, setAuthMethod] = useState<'google' | 'password'>('google');

  // Connected Google User (if signed in via Google first)
  const [connectedGoogleUser, setConnectedGoogleUser] = useState<any | null>(null);

  // Form Fields
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [currency, setCurrency] = useState('SZL');
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'business' | 'enterprise'>('starter');

  // Admin Account Fields (for password mode or editing Google defaults)
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Mandatory Terms of Service & Privacy Policy Checkbox
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Modals for legal transparency
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // 1. Google Sign-In Registration Handler
  const handleGoogleRegister = async () => {
    setError(null);
    setGoogleLoading(true);

    try {
      const res = await googleSignIn();
      if (!res || !res.user) {
        setGoogleLoading(false);
        return;
      }

      const gUser = res.user;
      setConnectedGoogleUser(gUser);
      setAdminEmail(gUser.email || '');
      setAdminName(gUser.displayName || gUser.email?.split('@')[0] || '');

      // Check if this Google user already has an active company or user profile in Firestore
      const userDocRef = doc(db, 'users', gUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists() && (userDoc.data().companyId || userDoc.data().businessId)) {
        const existingData = { id: userDoc.id, ...userDoc.data() };
        setCurrentUser(existingData as any);
        addToast(`Welcome back, ${gUser.displayName || gUser.email}! Redirecting to company portal...`, 'success');
        router.push('/');
        return;
      }

      // Check if this Google user's email was pre-authorized by an administrator
      if (gUser.email) {
        try {
          const invQuery = query(
            collection(db, 'user_invitations'),
            where('email', '==', gUser.email.toLowerCase()),
            where('status', '==', 'pending')
          );
          const invSnap = await getDocs(invQuery);
          if (!invSnap.empty) {
            const invDoc = invSnap.docs[0];
            const inv = invDoc.data();

            const linkedPayload = {
              id: gUser.uid,
              email: gUser.email.toLowerCase(),
              name: gUser.displayName || inv.name || 'Team Member',
              displayName: gUser.displayName || inv.name || 'Team Member',
              photoURL: gUser.photoURL || '',
              role: inv.role || 'STAFF',
              position: inv.position || 'Staff Member',
              companyId: inv.companyId,
              businessId: inv.companyId,
              companyName: inv.companyName || '',
              departments: inv.departments || ['sales'],
              canApproveQuotations: inv.canApproveQuotations || false,
              canApproveInvoices: inv.canApproveInvoices || false,
              canOverrideHR: inv.canOverrideHR || false,
              canFinalizeDocuments: inv.canFinalizeDocuments || false,
              canRejectDocuments: inv.canRejectDocuments || false,
              approvalRights: inv.approvalRights || false,
              isGoogleUser: true,
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString()
            };

            await setDoc(userDocRef, linkedPayload, { merge: true });
            await updateDoc(doc(db, 'user_invitations', invDoc.id), {
              status: 'accepted',
              claimedAt: new Date().toISOString(),
              claimedByUid: gUser.uid
            });

            await logAction(
              'Google Sign-In Auto-Detection',
              `User ${gUser.email} authenticated via Google Auth and was automatically linked to company '${inv.companyName || inv.companyId}' as ${inv.role}.`,
              inv.companyId
            );

            setCurrentUser(linkedPayload as any);
            addToast(`🎉 Welcome to ${inv.companyName}! You have been automatically linked as ${inv.role}.`, 'success');
            router.push('/');
            return;
          }
        } catch (invErr) {
          console.warn('Error checking invitations during Google sign-up:', invErr);
        }
      }

      // If user already typed company name and accepted terms, finalize registration immediately!
      if (companyName.trim() && acceptedTerms) {
        await finalizeCompanyCreation(gUser.uid, gUser.email || '', gUser.displayName || adminName, true);
      } else {
        // Switch view to let user enter company details and confirm terms
        addToast('Google account verified! Please enter your company details and accept terms below.', 'info');
      }
    } catch (err: any) {
      console.error('Google registration failed:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in was closed before completion. Please try again.');
      } else if (err.code === 'auth/blocked-by-popup-killer') {
        setError('Popup was blocked by your browser. Please allow popups for this domain.');
      } else {
        setError(err.message || 'Google authentication failed. Please try again or use email.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // 2. Finalize Company Creation & Provisioning
  const finalizeCompanyCreation = async (
    uid: string,
    email: string,
    displayName: string,
    isGoogleAuth: boolean
  ) => {
    if (!companyName.trim()) {
      setError('Please provide a legal company name.');
      return;
    }

    if (!acceptedTerms) {
      setError('You must read and agree to the Terms of Service and Privacy Policy to create a company.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const companyId = uid;
      const now = new Date();
      const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14-day free trial
      const currencyInfo = getCurrencyInfo(currency);

      const companyData = {
        id: companyId,
        ownerId: uid,
        name: companyName.trim(),
        email: email.trim(),
        phone: companyPhone.trim(),
        address: '',
        city: 'Mbabane',
        country: 'Eswatini',
        currency: currencyInfo.code,
        currencySymbol: currencyInfo.symbol,
        isOnboardingCompleted: false, // Opens 5-step onboarding wizard
        subscriptionPlanId: selectedPlan,
        subscriptionStatus: 'trial',
        trialActive: true,
        trialStartedAt: now.toISOString(),
        trialEndsAt: trialEnds.toISOString(),
        maxUsers: selectedPlan === 'starter' ? 10 : selectedPlan === 'business' ? 35 : 9999,
        themePreset: 'corporate',
        primaryColor: '#0F172A',
        secondaryColor: '#3B82F6',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      const userProfile = {
        id: uid,
        email: email.trim(),
        name: displayName.trim() || 'Company Administrator',
        displayName: displayName.trim() || 'Company Administrator',
        role: 'BUSINESS_ADMIN',
        position: 'Managing Director / Company Owner',
        companyId: companyId,
        businessId: companyId,
        companyName: companyName.trim(),
        departments: ['sales', 'finance', 'hr', 'inventory', 'projects', 'procurement', 'support', 'pos'],
        canApproveQuotations: true,
        canApproveInvoices: true,
        canOverrideHR: true,
        canFinalizeDocuments: true,
        canRejectDocuments: true,
        approvalRights: true,
        isGoogleUser: isGoogleAuth,
        status: 'ACTIVE',
        createdAt: now.toISOString(),
        lastLoginAt: now.toISOString()
      };

      // Write documents to Firestore
      await setDoc(doc(db, 'companies', companyId), companyData);
      await setDoc(doc(db, 'businesses', companyId), companyData);
      await setDoc(doc(db, 'users', uid), userProfile);

      // Local offline backup
      localStorage.setItem(`miratech_offline_company_${companyId}`, JSON.stringify(companyData));

      // Audit Log
      await logAction(
        'Company Self-Registration',
        `Company '${companyName}' registered by ${email} (${isGoogleAuth ? 'Google SSO' : 'Email/Password'}). 14-Day Free Trial initiated with currency ${currencyInfo.code} (${currencyInfo.symbol}) on ${selectedPlan.toUpperCase()} tier.`,
        companyId
      );

      setCurrentUser(userProfile as any);
      addToast(`🎉 Company created successfully! Welcome to your 14-day free trial.`, 'success');
      router.push('/');
    } catch (err: any) {
      console.error('Company provisioning failed:', err);
      setError(err.message || 'Failed to complete company registration. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Email & Password Registration Form Handler
  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to proceed.');
      return;
    }

    if (!companyName.trim()) {
      setError('Please provide a legal company name.');
      return;
    }

    if (!adminEmail || !adminPassword) {
      setError('Please enter an administrator email address and password.');
      return;
    }

    if (adminPassword.length < 8) {
      setError('Administrator password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
      const user = userCredential.user;
      await finalizeCompanyCreation(user.uid, user.email || adminEmail.trim(), adminName || 'Company Administrator', false);
    } catch (err: any) {
      console.error('Registration failed:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already registered. Please sign in or use a different email.');
      } else {
        setError(err.message || 'Failed to register account.');
      }
      setLoading(false);
    }
  };

  const selectedCurrencyInfo = getCurrencyInfo(currency);
  const planInfo = SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlan) || SUBSCRIPTION_PLANS[0];
  const convertedPrice = getConvertedPlanPrice(planInfo, currency, 'monthly');

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center space-y-3 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-300 text-xs font-bold border border-white/10 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Enterprise Self-Service Company Registration
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Register Your Company
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
          Start your <strong>14-day free trial</strong> today. Choose your operating currency, configure custom branding, and invite your team.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-3xl sm:px-10 border border-white/20 space-y-6">
          {/* 14-Day Free Trial Callout */}
          <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 rounded-2xl border border-emerald-200/80 flex items-center gap-3">
            <span className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 shadow-xs">
              <Clock className="w-5 h-5" />
            </span>
            <div className="text-xs text-emerald-950">
              <span className="font-extrabold block text-emerald-900">
                14-Day Full Access Free Trial Included
              </span>
              No credit card required upfront. Instant access to custom letterheads, multi-currency invoicing, and role-based staff portals.
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              {error}
            </div>
          )}

          {/* Registration Mode Selection / Google Fast-Registration */}
          <div className="space-y-3">
            <div className="text-center">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                Recommended Fast Registration
              </span>
            </div>

            {connectedGoogleUser ? (
              <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-xs overflow-hidden">
                    {connectedGoogleUser.photoURL ? (
                      <img src={connectedGoogleUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      connectedGoogleUser.email?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-900">{connectedGoogleUser.displayName || 'Google User'}</span>
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-md">
                        ✓ Verified Google Account
                      </span>
                    </div>
                    <span className="text-slate-500 font-medium block">{connectedGoogleUser.email}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConnectedGoogleUser(null);
                    setAdminEmail('');
                    setAdminName('');
                  }}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                type="button"
                id="google-register-btn"
                onClick={handleGoogleRegister}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white text-slate-700 hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 font-extrabold text-xs rounded-xl shadow-xs transition duration-200 cursor-pointer disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.3-4.74 3.3-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                <span>Sign up with Google (Instant Administrator SSO)</span>
              </button>
            )}

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-slate-200" />
              <button
                type="button"
                onClick={() => setAuthMethod(authMethod === 'google' ? 'password' : 'google')}
                className="text-[10px] text-slate-400 hover:text-indigo-600 font-bold uppercase tracking-wider"
              >
                {authMethod === 'google' ? 'Or use Email & Password' : 'Or use Google One-Click'}
              </button>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          </div>

          <form
            onSubmit={(e) => {
              if (connectedGoogleUser) {
                e.preventDefault();
                finalizeCompanyCreation(
                  connectedGoogleUser.uid,
                  connectedGoogleUser.email,
                  connectedGoogleUser.displayName || adminName,
                  true
                );
              } else if (authMethod === 'google') {
                e.preventDefault();
                handleGoogleRegister();
              } else {
                handleEmailPasswordSubmit(e);
              }
            }}
            className="space-y-5 text-xs"
          >
            {/* Step 1: Company Profile */}
            <div className="space-y-3">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                1. Corporate Identity & Regional Currency
              </span>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Legal Company Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. MiraTech Innovations Ltd"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Operating Currency <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Coins className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-950 text-xs"
                    >
                      {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} ({c.symbol}) — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    All quotations, invoices, ledgers and documents will use {selectedCurrencyInfo.code} ({selectedCurrencyInfo.symbol}).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Company Phone / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="+268 7600 0000"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Administrator Credentials (shown if password mode or if Google account is not connected yet) */}
            {authMethod === 'password' && !connectedGoogleUser && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  2. Administrator Account Credentials
                </span>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Administrator Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Dr. Sipho Dlamini"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Administrator Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@yourcompany.com"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
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
              </div>
            )}

            {/* Step 3: Plan Tier Selection */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  3. Select Trial Subscription Tier
                </span>
                <span className="text-[10px] text-indigo-600 font-bold">14 Days Free Access</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'starter', label: 'Starter', priceUSD: 200, users: '10 Users' },
                  { id: 'business', label: 'Business', priceUSD: 700, users: '35 Users' },
                  { id: 'enterprise', label: 'Enterprise', priceUSD: 1500, users: 'Unlimited' }
                ].map((p) => {
                  const planObj = SUBSCRIPTION_PLANS.find((sp) => sp.id === p.id) || SUBSCRIPTION_PLANS[0];
                  const cPrice = getConvertedPlanPrice(planObj, currency, 'monthly');
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlan(p.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                        selectedPlan === p.id
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-950 ring-1 ring-indigo-500 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-extrabold block text-[11px]">{p.label}</span>
                      <span className="text-[10px] font-black text-indigo-900 block mt-0.5">
                        {cPrice.formattedPrice}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">{p.users}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 4: Mandatory Terms of Service & Privacy Policy Checkbox */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-start gap-3 p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80">
                <input
                  type="checkbox"
                  id="terms-checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                  required
                />
                <label htmlFor="terms-checkbox" className="text-xs text-slate-600 leading-relaxed cursor-pointer select-none">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTermsModal(true);
                    }}
                    className="font-extrabold text-indigo-700 hover:text-indigo-900 underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    Terms of Service
                  </button>{' '}
                  and have read and accepted the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPrivacyModal(true);
                    }}
                    className="font-extrabold text-indigo-700 hover:text-indigo-900 underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  . I understand that my company is entitled to a 14-day full feature trial.
                </label>
              </div>

              {!acceptedTerms && (
                <p className="text-[10px] text-amber-700 font-medium flex items-center gap-1.5 px-2">
                  <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Mandatory: You must check the box to accept the Terms of Service before registering.
                </p>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                id="submit-register-company-btn"
                disabled={loading || googleLoading || !acceptedTerms}
                className="w-full py-3.5 px-4 bg-indigo-950 hover:bg-black text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Provisioning Company Portal & Activating Trial...
                  </>
                ) : connectedGoogleUser ? (
                  <>
                    Complete Registration with Google & Launch Trial <ArrowRight className="w-4 h-4" />
                  </>
                ) : authMethod === 'google' ? (
                  <>
                    Continue with Google & Start 14-Day Free Trial <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Create Company & Start 14-Day Free Trial <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have a registered company account or invited by an admin?{' '}
              <button
                type="button"
                onClick={() => router.push('/')}
                className="font-extrabold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
              >
                Sign in to your portal
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Terms of Service Modal */}
      <AnimatePresence>
        {showTermsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-xs"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Terms of Service</h3>
                    <p className="text-[11px] text-slate-500">MiraTech Corporate ERP & Business Suite SLA</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-slate-600 leading-relaxed">
                <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-indigo-950">
                  <span className="font-extrabold block text-xs mb-1">1. Summary & 14-Day Free Trial</span>
                  Upon registration, your company receives an immediate 14-day full access trial to all features in the selected tier ({planInfo.name} Plan). No upfront payment or credit card is charged. After 14 days, continued access requires activating a subscription in your chosen operating currency ({currency}).
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-1">2. Multi-Tenant Architecture & Data Isolation</h4>
                  <p>
                    Every company registered within MiraTech operates in a cryptographically isolated tenant namespace. Your financial ledgers, customer rosters, inventory items, and quotations are strictly segregated from other corporate tenants.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-1">3. Administrative Authority & Staff Roles</h4>
                  <p>
                    The company administrator has sole authority to configure company letterheads, digital stamps, bank account details, operating currency, and add staff members. Pre-authorized email addresses will be automatically assigned to your tenant upon their Google or email sign-in.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-1">4. Operating Currencies & Conversions</h4>
                  <p>
                    All accounting records, tax documents, and customer invoices are generated in your configured company currency ({currency}). Standard subscription plans will be billed in accordance with real-time exchange rates.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-1">5. Data Ownership & Export</h4>
                  <p>
                    You retain 100% ownership of your corporate data. You may export official invoices, quotations, and financial statements as PDFs or synchronize ledgers to Google Workspace Sheets at any time.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAcceptedTerms(true);
                    setShowTermsModal(false);
                    addToast('Terms of Service accepted', 'success');
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  I Agree & Accept Terms
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Policy Modal */}
      <AnimatePresence>
        {showPrivacyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-xs"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Privacy Policy</h3>
                    <p className="text-[11px] text-slate-500">Corporate Confidentiality & Data Protection Governance</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-slate-600 leading-relaxed">
                <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-emerald-950">
                  <span className="font-extrabold block text-xs mb-1">Confidential Corporate Ledger Protection</span>
                  MiraTech implements strict enterprise security measures in compliance with the Eswatini Data Protection Act, POPIA, and international security standards.
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-1">1. Information We Collect</h4>
                  <p>
                    We collect essential business information required to run your enterprise suite: legal company name, business tax identifiers, administrator contact details, and user authentication tokens provided by Firebase Auth and Google Sign-In.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-1">2. Google Sign-In & Single Sign-On (SSO)</h4>
                  <p>
                    When using &quot;Sign in with Google&quot;, we receive basic profile info (email address, display name, avatar URL) solely to identify your account and automatically match you to your invited company portal. We do not access external personal data without explicit permission.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-1">3. Google Workspace OAuth Permissions</h4>
                  <p>
                    Optional Google Sheets and Google Drive integrations are used exclusively to export approved financial reports and store backup PDF records directly into your chosen company Google Drive folder.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-1">4. Data Retention & Privacy Controls</h4>
                  <p>
                    Your business documents are encrypted at rest and in transit. Company administrators may update, purge, or export their data at any point from the Company Admin Command Center.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAcceptedTerms(true);
                    setShowPrivacyModal(false);
                    addToast('Privacy Policy accepted', 'success');
                  }}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  I Have Read & Accept
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { doc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db, auth as importAuth, handleFirestoreError, OperationType, isOfflineError } from '../lib/firebase';
import { useUserStore, useToastStore } from '../lib/store';
import { logAction } from '../lib/audit';
import { SUPPORTED_CURRENCIES, formatCurrency, getCurrencySymbol, getCurrencyInfo, convertFromUSD } from '../lib/currency';
import { SUBSCRIPTION_PLANS, getConvertedPlanPrice } from '../lib/subscriptions';
import { Role } from '../lib/types';
import {
  Building2,
  Globe,
  Coins,
  Palette,
  Users,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  FileText,
  Trash2,
  Plus,
  Stamp,
  Image as ImageIcon,
  Check,
  Crown,
  Zap,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CompanyOnboardingProps {
  initialCompanyData?: any;
  onCompleted?: () => void;
}

interface TeamInvite {
  email: string;
  role: Role;
  position: string;
  departments: string[];
}

export default function CompanyOnboarding({ initialCompanyData, onCompleted }: CompanyOnboardingProps) {
  const { currentUser, setCurrentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);

  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Legal Profile & Contacts
  const [name, setName] = useState(initialCompanyData?.name || '');
  const [registrationNumber, setRegistrationNumber] = useState(initialCompanyData?.registrationNumber || '');
  const [taxNumber, setTaxNumber] = useState(initialCompanyData?.taxNumber || '');
  const [industry, setIndustry] = useState(initialCompanyData?.industry || 'Technology & Software');
  const [phone, setPhone] = useState(initialCompanyData?.phone || '');
  const [email, setEmail] = useState(initialCompanyData?.email || currentUser?.email || '');
  const [website, setWebsite] = useState(initialCompanyData?.website || '');
  const [address, setAddress] = useState(initialCompanyData?.address || '');
  const [city, setCity] = useState(initialCompanyData?.city || 'Mbabane');
  const [country, setCountry] = useState(initialCompanyData?.country || 'Eswatini');

  // Step 2: Operating Currency
  const [currency, setCurrency] = useState(initialCompanyData?.currency || 'SZL');

  // Step 3: Brand & Letterhead
  const [logo, setLogo] = useState(initialCompanyData?.logo || '');
  const [letterheadHeader, setLetterheadHeader] = useState(initialCompanyData?.letterheadHeader || initialCompanyData?.letterheadLogo || '');
  const [letterheadFooter, setLetterheadFooter] = useState(
    initialCompanyData?.letterheadFooter ||
      'Banking Details: First National Bank (FNB) | Account No: 62881920391 | Branch Code: 280164 | Regulated Corporate Entity'
  );
  const [digitalStamp, setDigitalStamp] = useState(initialCompanyData?.digitalStamp || '');
  const [primaryColor, setPrimaryColor] = useState(initialCompanyData?.primaryColor || '#0F172A');
  const [secondaryColor, setSecondaryColor] = useState(initialCompanyData?.secondaryColor || '#3B82F6');
  const [themePreset, setThemePreset] = useState(initialCompanyData?.themePreset || 'corporate');

  // Step 4: Team Invitations
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('STAFF');
  const [invitePosition, setInvitePosition] = useState('Operations Officer');
  const [inviteDepts, setInviteDepts] = useState<string[]>(['sales']);

  // Step 5: Subscription Plan Selection
  const [selectedPlanId, setSelectedPlanId] = useState<'starter' | 'business' | 'enterprise'>(
    initialCompanyData?.subscriptionPlanId || 'starter'
  );
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

  const handleApplyColorPreset = (preset: string) => {
    setThemePreset(preset);
    if (preset === 'corporate') {
      setPrimaryColor('#0F172A');
      setSecondaryColor('#3B82F6');
    } else if (preset === 'emerald') {
      setPrimaryColor('#064E3B');
      setSecondaryColor('#10B981');
    } else if (preset === 'violet') {
      setPrimaryColor('#4C1D95');
      setSecondaryColor('#8B5CF6');
    } else if (preset === 'sunset') {
      setPrimaryColor('#78350F');
      setSecondaryColor('#F59E0B');
    } else if (preset === 'ocean') {
      setPrimaryColor('#0C4A6E');
      setSecondaryColor('#0EA5E9');
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void,
    fieldLabel: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast(`${fieldLabel} must be under 2MB for fast document synchronization.`, 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setter(reader.result as string);
      addToast(`${fieldLabel} loaded successfully!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleAddTeamInvite = () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      addToast('Please enter a valid email address for portal invitation.', 'warning');
      return;
    }

    if (teamInvites.some((t) => t.email.toLowerCase() === inviteEmail.toLowerCase())) {
      addToast('This email is already in your invitation list.', 'warning');
      return;
    }

    setTeamInvites((prev) => [
      ...prev,
      {
        email: inviteEmail.trim(),
        role: inviteRole,
        position: invitePosition,
        departments: inviteDepts.length > 0 ? inviteDepts : ['sales']
      }
    ]);

    setInviteEmail('');
    addToast(`Added ${inviteEmail} to pending invitations`, 'info');
  };

  const handleRemoveTeamInvite = (index: number) => {
    setTeamInvites((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCompleteOnboarding = async () => {
    const targetCompanyId = currentUser?.companyId || currentUser?.businessId || importAuth.currentUser?.uid;
    if (!targetCompanyId) {
      addToast('Error: No active workspace found to associate company configuration.', 'error');
      return;
    }

    if (!name.trim()) {
      addToast('Please provide a legal company name.', 'error');
      setCurrentStep(1);
      return;
    }

    setSaving(true);

    const now = new Date();
    const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days free trial
    const currencyInfo = getCurrencyInfo(currency);

    const companyPayload: any = {
      ownerId: importAuth.currentUser?.uid || targetCompanyId,
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
      useCompanyLetterhead: true,
      letterheadWidthFit: false,
      primaryColor,
      secondaryColor,
      themePreset,
      themeMode: 'light',
      fontFamily: 'inter',
      cardRadius: 'md',
      sidebarStyle: 'flat',
      isOnboardingCompleted: true,
      subscriptionPlanId: selectedPlanId,
      subscriptionStatus: 'trial',
      trialActive: true,
      trialStartedAt: now.toISOString(),
      trialEndsAt: trialEnds.toISOString(),
      billingCycle,
      maxUsers: selectedPlanId === 'starter' ? 10 : selectedPlanId === 'business' ? 35 : 9999,
      updatedAt: now.toISOString()
    };

    try {
      // 1. Update Company document in Firestore
      try {
        await setDoc(doc(db, 'companies', targetCompanyId), companyPayload, { merge: true });
        await setDoc(doc(db, 'businesses', targetCompanyId), companyPayload, { merge: true });
      } catch (fErr) {
        if (!isOfflineError(fErr)) throw fErr;
        console.warn('[Onboarding Offline] Saved locally');
      }

      // Save locally to cache
      localStorage.setItem(`miratech_offline_company_${targetCompanyId}`, JSON.stringify(companyPayload));

      // 2. Dispatch User Invitations
      if (teamInvites.length > 0) {
        for (const inv of teamInvites) {
          try {
            await addDoc(collection(db, 'user_invitations'), {
              companyId: targetCompanyId,
              companyName: name,
              email: inv.email,
              role: inv.role,
              position: inv.position,
              departments: inv.departments,
              invitedBy: currentUser?.email || 'Company Administrator',
              invitedAt: new Date().toISOString(),
              status: 'pending'
            });
          } catch (invErr) {
            console.warn('Failed to dispatch user invitation record:', invErr);
          }
        }
      }

      // 3. Log Audit Trail
      try {
        await logAction(
          'Company Onboarding Completed',
          `Company '${name}' configured profile, chosen currency ${currencyInfo.code} (${currencyInfo.symbol}), initialized 14-day free trial on ${selectedPlanId.toUpperCase()} plan, and invited ${teamInvites.length} staff members.`,
          targetCompanyId
        );
      } catch (auditErr) {
        console.warn('Audit record warning:', auditErr);
      }

      // 4. Update Current User store
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          companyId: targetCompanyId,
          role: currentUser.role === 'STAFF' ? 'BUSINESS_ADMIN' : currentUser.role
        });
      }

      addToast(`🎉 Welcome to MiraTech! Company profile and 14-Day Free Trial activated.`, 'success');

      if (onCompleted) {
        onCompleted();
      }
    } catch (err: any) {
      console.error('Failed to complete onboarding:', err);
      addToast(err?.message || 'Failed to save company settings. Please verify network connectivity.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { num: 1, label: 'Company Profile', icon: Building2 },
    { num: 2, label: 'Operating Currency', icon: Coins },
    { num: 3, label: 'Letterhead & Brand', icon: Palette },
    { num: 4, label: 'Portal Users & Roles', icon: Users },
    { num: 5, label: 'Choose Plan & Trial', icon: Crown }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto font-sans p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-bold backdrop-blur-xs border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Company Setup & Enterprise Onboarding
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Configure Your Corporate Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed font-normal">
            Establish your company credentials, customize your official letterhead, assign roles to your team, and activate your <strong>14-day free trial</strong> with automatic currency conversion.
          </p>
        </div>
      </div>

      {/* Step Progress Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs">
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 sm:pb-0">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;

            return (
              <div key={s.num} className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrentStep(s.num)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-900 text-white shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      isCurrent
                        ? 'bg-white text-indigo-950'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3 h-3 stroke-[3]" /> : s.num}
                  </span>
                  <span className="hidden md:inline">{s.label}</span>
                </button>

                {idx < steps.length - 1 && (
                  <div className="w-4 sm:w-8 h-0.5 bg-slate-200 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 sm:p-8">
        <AnimatePresence mode="wait">
          {/* STEP 1: COMPANY IDENTIFICATION & CONTACTS */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  Step 1: Legal Company Identification & Contacts
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your registered legal entity credentials. These details will be automatically synchronized with your company settings.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Legal Company Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Swazi Precision Engineering Ltd"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Industry / Business Domain
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition font-medium text-slate-900"
                  >
                    <option value="Technology & Software">Technology & Software</option>
                    <option value="Retail & Wholesale / POS">Retail & Wholesale / POS</option>
                    <option value="Engineering & Construction">Engineering & Construction</option>
                    <option value="Accounting & Financial Services">Accounting & Financial Services</option>
                    <option value="Manufacturing & Industrial">Manufacturing & Industrial</option>
                    <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
                    <option value="Healthcare & Pharmaceuticals">Healthcare & Pharmaceuticals</option>
                    <option value="Agriculture & Food Production">Agriculture & Food Production</option>
                    <option value="Corporate Consulting">Corporate Consulting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Company Registration / CIPC Number
                  </label>
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="e.g. REG-2024-88491 / 2021/123456/07"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tax / VAT Number (TIN / VAT ID)
                  </label>
                  <input
                    type="text"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    placeholder="e.g. VAT-100294819 / TIN-992102"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Official Corporate Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="info@yourcompany.com"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Corporate Phone / WhatsApp Business
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+268 7600 0000 / +27 11 000 0000"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Website URL
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://www.yourcompany.com"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Country & City
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City (e.g. Mbabane)"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition font-medium text-slate-900"
                    />
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Country (e.g. Eswatini)"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Physical Corporate Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Plot 42, Industrial Estate, 3rd Floor Corporate Suite"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition font-medium text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: OPERATING CURRENCY SELECTION */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-indigo-600" />
                  Step 2: Operational Currency & Financial Base
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Pick your primary operating currency. All quotations, invoices, reports, and subscription pricing will automatically convert and display using your chosen currency symbol.
                </p>
              </div>

              {/* Currency Selector Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Object.values(SUPPORTED_CURRENCIES).map((curr) => {
                  const isSelected = currency === curr.code;
                  const sampleAmount = convertFromUSD(200, curr.code);
                  const sampleFormatted = formatCurrency(sampleAmount, curr.code);

                  return (
                    <button
                      key={curr.code}
                      type="button"
                      onClick={() => setCurrency(curr.code)}
                      className={`p-4 rounded-xl border text-left transition relative cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{curr.flag}</span>
                          <div>
                            <span className="font-extrabold text-slate-900 text-sm block">
                              {curr.code} ({curr.symbol})
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">{curr.name}</span>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono text-[10px]">Sample $200 Plan:</span>
                        <span className="font-extrabold font-mono text-indigo-900">{sampleFormatted}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Live Currency Preview Box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Active Currency Configuration Summary
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Selected Currency</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {getCurrencyInfo(currency).name}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Document Prefix Symbol</span>
                    <span className="font-extrabold text-indigo-700 text-lg font-mono">
                      {getCurrencySymbol(currency)}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Exchange Rate Benchmark</span>
                    <span className="font-mono text-slate-700">
                      $1.00 USD = {getCurrencySymbol(currency)}
                      {getCurrencyInfo(currency).exchangeRateToUSD.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: LETTERHEAD, LOGOS & BRANDING */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-indigo-600" />
                  Step 3: Letterhead Header, Logos & Brand Assets
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Upload your corporate logo and letterhead banner. These assets will frame all generated PDF quotations, invoices, and receipts.
                </p>
              </div>

              {/* Theme Color Presets */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Corporate Palette Preset
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'corporate', label: 'Navy Corporate', p: '#0F172A', s: '#3B82F6' },
                    { id: 'emerald', label: 'Emerald Trust', p: '#064E3B', s: '#10B981' },
                    { id: 'violet', label: 'Royal Violet', p: '#4C1D95', s: '#8B5CF6' },
                    { id: 'sunset', label: 'Warm Amber', p: '#78350F', s: '#F59E0B' },
                    { id: 'ocean', label: 'Ocean Blue', p: '#0C4A6E', s: '#0EA5E9' }
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyColorPreset(preset.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                        themePreset === preset.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center -space-x-1">
                        <span className="w-3.5 h-3.5 rounded-full border border-white" style={{ backgroundColor: preset.p }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white" style={{ backgroundColor: preset.s }} />
                      </div>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Uploads Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Logo */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50 text-center">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Company Logo / Icon
                  </span>
                  <div className="h-28 flex items-center justify-center bg-white border border-dashed border-slate-300 rounded-lg overflow-hidden relative">
                    {logo ? (
                      <img src={logo} alt="Company Logo" className="max-h-24 max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-slate-400 text-xs flex flex-col items-center">
                        <ImageIcon className="w-6 h-6 mb-1 text-slate-300" />
                        No logo loaded
                      </div>
                    )}
                  </div>
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setLogo, 'Company Logo')}
                      className="hidden"
                    />
                    <span className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 inline-block cursor-pointer transition shadow-2xs">
                      Upload Logo
                    </span>
                  </label>
                </div>

                {/* Letterhead Header Banner */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50 text-center">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Letterhead Top Banner
                  </span>
                  <div className="h-28 flex items-center justify-center bg-white border border-dashed border-slate-300 rounded-lg overflow-hidden relative">
                    {letterheadHeader ? (
                      <img
                        src={letterheadHeader}
                        alt="Letterhead Header"
                        className="max-h-24 max-w-full object-contain p-1"
                      />
                    ) : (
                      <div className="text-slate-400 text-xs flex flex-col items-center">
                        <FileText className="w-6 h-6 mb-1 text-slate-300" />
                        No banner loaded
                      </div>
                    )}
                  </div>
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setLetterheadHeader, 'Letterhead Banner')}
                      className="hidden"
                    />
                    <span className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 inline-block cursor-pointer transition shadow-2xs">
                      Upload Banner
                    </span>
                  </label>
                </div>

                {/* Digital Stamp / Signature */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50 text-center">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Digital Stamp / Seal
                  </span>
                  <div className="h-28 flex items-center justify-center bg-white border border-dashed border-slate-300 rounded-lg overflow-hidden relative">
                    {digitalStamp ? (
                      <img
                        src={digitalStamp}
                        alt="Digital Stamp"
                        className="max-h-24 max-w-full object-contain p-1"
                      />
                    ) : (
                      <div className="text-slate-400 text-xs flex flex-col items-center">
                        <Stamp className="w-6 h-6 mb-1 text-slate-300" />
                        No seal loaded
                      </div>
                    )}
                  </div>
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setDigitalStamp, 'Digital Stamp')}
                      className="hidden"
                    />
                    <span className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 inline-block cursor-pointer transition shadow-2xs">
                      Upload Stamp
                    </span>
                  </label>
                </div>
              </div>

              {/* Letterhead Footer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Official Letterhead Footer & Banking Instructions
                </label>
                <textarea
                  rows={2}
                  value={letterheadFooter}
                  onChange={(e) => setLetterheadFooter(e.target.value)}
                  placeholder="Banking details, corporate registration disclaimers, or tax notes appearing at bottom of all invoices."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                />
              </div>

              {/* Live Preview of an Invoice Header */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Live Document Letterhead Preview
                </span>
                <div
                  className="p-4 rounded-lg border text-white flex items-center justify-between"
                  style={{ backgroundColor: primaryColor }}
                >
                  <div className="flex items-center gap-3">
                    {logo && (
                      <img src={logo} alt="Logo" className="w-10 h-10 object-contain bg-white rounded p-1" />
                    )}
                    <div>
                      <h3 className="font-extrabold text-sm tracking-tight">{name || 'Your Company Name'}</h3>
                      <p className="text-[10px] text-slate-300">{phone || '+268 7600 0000'} | {email || 'info@company.com'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-300 block">TAX INVOICE</span>
                    <span className="font-mono font-bold text-sm">
                      {formatCurrency(12500, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: TEAM INVITATIONS & PORTAL ROLES */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Step 4: Portal Users, Emails & Role Assignments
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Assign user email accounts to your corporate portal and set their operational roles. (You can also add or remove users later from the Company Admin Dashboard).
                </p>
              </div>

              {/* Add User Bar */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Add User To Invitation Roster
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">User Email</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="employee@company.com"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">System Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as Role)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                    >
                      <option value="COMPANY_ADMIN">Company Administrator (Full Control)</option>
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
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Corporate Position</label>
                    <input
                      type="text"
                      value={invitePosition}
                      onChange={(e) => setInvitePosition(e.target.value)}
                      placeholder="e.g. Senior Accountant"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Department Checkboxes */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                    Permitted Department Hubs
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DEPARTMENTS.map((dept) => {
                      const isChecked = inviteDepts.includes(dept.id);
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setInviteDepts(inviteDepts.filter((d) => d !== dept.id));
                            } else {
                              setInviteDepts([...inviteDepts, dept.id]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                            isChecked
                              ? 'bg-indigo-900 text-white shadow-2xs'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {dept.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddTeamInvite}
                  className="px-4 py-2 bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add to Roster
                </button>
              </div>

              {/* Roster Listing */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Pending Portal Invitations ({teamInvites.length})
                </span>

                {teamInvites.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    No team invitations added yet. You can invite your team members now or manage users anytime from the Company Admin dashboard.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teamInvites.map((inv, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-3xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                            {inv.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 text-xs block">{inv.email}</span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <span className="font-bold text-indigo-700">{inv.role}</span>
                              <span>•</span>
                              <span>{inv.position}</span>
                              <span>•</span>
                              <span>{inv.departments.join(', ')}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveTeamInvite(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 5: SUBSCRIPTION PLANS & 14-DAY FREE TRIAL */}
          {currentStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-indigo-600" />
                  Step 5: Business Suite Plan & 14-Day Free Trial
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Select your initial tier. Every newly registered company gets a <strong>full-featured 14-day free trial</strong>. You are only required to complete payment after the trial period.
                </p>
              </div>

              {/* 14-Day Free Trial Callout Banner */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 shadow-3xs">
                <span className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
                  <Clock className="w-5 h-5" />
                </span>
                <div className="text-xs text-emerald-950">
                  <span className="font-extrabold block text-emerald-900 text-sm">
                    14-Day Free Trial Automatically Activated
                  </span>
                  No credit card required upfront. Full access to all business features according to the plan tier you select.
                </div>
              </div>

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

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const priceInfo = getConvertedPlanPrice(plan, currency, billingCycle);

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id as any)}
                      className={`p-6 rounded-2xl border transition-all relative flex flex-col justify-between cursor-pointer ${
                        isSelected
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
                          {isSelected && (
                            <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
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
                            Base: ${plan.usdPrice} USD / mo ({currency})
                          </span>
                        </div>

                        {/* User Limit Badge */}
                        <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center gap-2 text-xs font-bold text-indigo-900">
                          <Users className="w-4 h-4 text-indigo-600" />
                          <span>
                            {plan.maxUsers >= 9999 ? 'Unlimited User Accounts' : `Up to ${plan.maxUsers} User Seats`}
                          </span>
                        </div>

                        {/* Feature Highlights */}
                        <ul className="space-y-2 text-xs text-slate-600 pt-2">
                          {plan.features.slice(0, 7).map((featId) => (
                            <li key={featId} className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="capitalize">{featId.replace('_', ' ')}</span>
                            </li>
                          ))}
                          {plan.features.length > 7 && (
                            <li className="text-[11px] text-indigo-600 font-bold">
                              + {plan.features.length - 7} additional enterprise modules
                            </li>
                          )}
                        </ul>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-900 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected ? 'Selected Plan' : 'Select Plan'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <ArrowLeft className="w-4 h-4" /> Previous Step
            </button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => {
                if (currentStep === 1 && !name.trim()) {
                  addToast('Please enter your legal company name before proceeding.', 'warning');
                  return;
                }
                setCurrentStep((prev) => prev + 1);
              }}
              className="px-6 py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              Continue to Step {currentStep + 1} <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleCompleteOnboarding}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Provisioning Portal...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" /> Complete Onboarding & Activate 14-Day Trial
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useUserStore } from '../lib/store';
import { SUBSCRIPTION_PLANS, SubscriptionPlan, ALL_FEATURES, getLockedFeaturesForPlan, daysBetween } from '../lib/subscriptions';
import { logAction } from '../lib/audit';
import { 
  CreditCard, 
  Check, 
  AlertTriangle, 
  HelpCircle, 
  Layers, 
  Users, 
  Calendar, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  Clock,
  X,
  Smartphone,
  Shield,
  Upload,
  Globe,
  Building,
  DollarSign,
  FileText,
  User,
  Hash,
  Lock
} from 'lucide-react';

interface PaymentMethod {
  id: string;
  name: string;
  category: 'momo' | 'card' | 'bank' | 'remit';
  logoPlaceholder: string;
  description: string;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'eswatini_momo', name: 'Eswatini MTN MoMo', category: 'momo', logoPlaceholder: 'MTN MoMo (+268)', description: 'Immediate mobile money push request via Swaziland MTN.' },
  { id: 'unayo', name: 'Standard Bank Unayo', category: 'momo', logoPlaceholder: 'SB Unayo', description: 'Standard Bank Swaziland Unayo mobile wallet lookup transaction.' },
  { id: 'mpesa', name: 'M-Pesa Remit', category: 'momo', logoPlaceholder: 'M-Pesa', description: 'Regional Safaricom / Vodacom mobile cash payment link.' },
  { id: 'emoolah', name: 'eMoolah Wallet', category: 'momo', logoPlaceholder: 'eMoolah', description: 'Eswatini regional digital wallet direct payout.' },
  
  { id: 'mastercard', name: 'Mastercard International', category: 'card', logoPlaceholder: 'Mastercard Secure', description: 'Secure global network transaction validation.' },
  { id: 'visa', name: 'Visa Secure', category: 'card', logoPlaceholder: 'Visa 3D Secure', description: '3D Verified credit / debit bank card link.' },
  
  { id: 'eft', name: 'Direct Bank Transfer (EFT)', category: 'bank', logoPlaceholder: 'Swazi EFT', description: 'Verify bank deposit using Swaziland corporate branch details.' },
  
  { id: 'western_union', name: 'Western Union', category: 'remit', logoPlaceholder: 'WU Remit', description: 'Authenticate money order using global 10-digit MTCN.' },
  { id: 'moneygram', name: 'MoneyGram', category: 'remit', logoPlaceholder: 'MoneyGram', description: 'Authenticate money order using 8-digit MG Control Code.' },
  { id: 'mukuru', name: 'Mukuru Remit', category: 'remit', logoPlaceholder: 'Mukuru', description: 'Regional remittance hub pickup verification code.' }
];

export default function SubscriptionsView() {
  const { currentUser } = useUserStore();
  const [company, setCompany] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Checkout modal states
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(PAYMENT_METHODS[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionCode, setTransactionCode] = useState('');

  // Payment Form Fields
  const [momoPhone, setMomoPhone] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [remitSender, setRemitSender] = useState('');
  const [remitMtcn, setRemitMtcn] = useState('');
  const [popFileSimulated, setPopFileSimulated] = useState<string | null>(null);

  const fetchCompanyDetails = async () => {
    if (!currentUser?.companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const docRef = doc(db, 'companies', currentUser.companyId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCompany(data);
      } else {
        setError("Company record not found in system.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load subscriber metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyDetails();
  }, [currentUser?.companyId]);

  const handleOpenCheckout = (plan: SubscriptionPlan) => {
    if (!currentUser?.companyId || !company) return;
    
    // Check privilege
    if (currentUser.role !== 'BUSINESS_ADMIN' && currentUser.role !== 'MASTER_ADMIN') {
      setError("Only Corporate Administrators or System Supervisors can modify billing and subscription parameters.");
      return;
    }

    setSelectedPlan(plan);
    setError(null);
    setSuccess(null);
    // Preset mock data
    setMomoPhone(company.phone || '7600 0000');
    setCardName(currentUser.name || 'Company Director');
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !currentUser?.companyId) return;

    setIsProcessing(true);
    setError(null);

    // Form Validators
    if (selectedMethod.category === 'momo' && !momoPhone) {
      setError("Please input an active Mobile Account Number.");
      setIsProcessing(false);
      return;
    }
    if (selectedMethod.category === 'card' && (!cardNumber || !cardCvv || !cardExpiry)) {
      setError("Please complete all card details fields securely.");
      setIsProcessing(false);
      return;
    }
    if (selectedMethod.category === 'remit' && (!remitSender || !remitMtcn)) {
      setError("Verification requires Swaziland/Global reference check: Sender Name and Reference MTCN are mandatory.");
      setIsProcessing(false);
      return;
    }
    if (selectedMethod.id === 'eft' && !popFileSimulated) {
      setError("EFT settlement requires selecting/uploading your direct proof deposit slip PDF.");
      setIsProcessing(false);
      return;
    }

    // Generate a random mock reference authorization code
    const generatedRef = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
    setTransactionCode(generatedRef);

    // Dynamic timeout to simulate gateway verification handshakes
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const planLockedFeats = getLockedFeaturesForPlan(selectedPlan.id);
      
      const updateData: any = {
        subscriptionPlanId: selectedPlan.id,
        lockedFeatures: planLockedFeats,
        subscriptionStatus: 'active',
        subscriptionStartedAt: new Date().toISOString(),
        lastPaymentRef: generatedRef,
        lastPaymentMethod: selectedMethod.name,
        lastPaymentAmount: selectedPlan.price,
      };

      await updateDoc(doc(db, 'companies', currentUser.companyId), updateData);
      
      try {
        await updateDoc(doc(db, 'businesses', currentUser.companyId), updateData);
      } catch (err) {
        console.warn("Businesses mirror reference not present.");
      }

      await logAction(
        'Subscription Activated via Gateway',
        `Corporate workspace paid and activated "${selectedPlan.name}" (E${selectedPlan.price.toLocaleString()}/mo) via ${selectedMethod.name}. Ref: ${generatedRef}`,
        currentUser.companyId
      );

      setCompany(prev => ({ ...prev, ...updateData }));
      setSuccess(`Transaction Processed Securely! Workspace upgraded to "${selectedPlan.name}" with real-time provisioning.`);
      
      // Close modal
      setSelectedPlan(null);
      // reset form variables
      setCardNumber('');
      setCardCvv('');
      setCardExpiry('');
      setRemitMtcn('');
      setPopFileSimulated(null);
    } catch (err: any) {
      console.error(err);
      setError("The integration gateway service declined your connection: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getTrialDetails = () => {
    if (!company) return null;
    const createdAt = company.createdAt ? new Date(company.createdAt) : new Date();
    
    const trialEndsAt = company.subscriptionTrialEndsAt 
      ? new Date(company.subscriptionTrialEndsAt)
      : new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      
    const today = new Date();
    const daysLeft = daysBetween(today, trialEndsAt);
    const progressPercent = Math.max(0, Math.min(100, (daysLeft / 14) * 100));
    const isExpired = today > trialEndsAt;

    return {
      daysLeft: isExpired ? 0 : daysLeft,
      endsAtFormatted: trialEndsAt.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
      progressPercent,
      isExpired,
    };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-4">Synthesizing billing registry...</p>
      </div>
    );
  }

  const currentPlanId = company?.subscriptionPlanId || 'starter';
  const currentPlan = SUBSCRIPTION_PLANS.find(p => p.id === currentPlanId) || SUBSCRIPTION_PLANS[0];
  const trial = getTrialDetails();
  const isTrial = company?.subscriptionStatus === 'trialing' || !company?.subscriptionStatus;

  return (
    <div className="space-y-8 font-sans max-w-6xl mx-auto">
      {/* Upper Banner Status */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-900 tracking-tight">Corporate Subscription Billing & Limits</h2>
          <p className="text-xs text-slate-500 font-medium">Evaluate pricing plans, view staff roster quotas, or unlock enterprise workflows.</p>
        </div>
        <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-xs font-bold text-slate-700">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span>Active Layer: {currentPlan.name}</span>
        </div>
      </div>

      {success && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 text-emerald-800 border border-emerald-250 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <h4 className="font-bold">Upgrade Complete</h4>
            <p className="text-emerald-700 mt-0.5">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <h4 className="font-bold">Transaction Decelerated</h4>
            <p className="text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Trial Monitor Box */}
      {trial && (
        <div className={`p-6 border rounded-2xl ${isTrial ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-150' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border ${
                  isTrial ? 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {isTrial ? '14-Day Trial Active' : 'Paid Subscription Package'}
                </span>
                <span className="text-xs text-slate-400 font-semibold">•</span>
                <span className="text-xs font-bold text-slate-700">Expires: {trial.endsAtFormatted}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {isTrial 
                  ? `Your trial period ends in ${trial.daysLeft} days` 
                  : `Active Subscription: ${currentPlan.name}`}
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                {isTrial 
                  ? "Choose any of our robust monthly plan options below to establish your official production workspace key."
                  : "Thank you for supporting our platform! Your enterprise settings and visual branding preferences are locked to this workspace."}
              </p>
            </div>

            {isTrial && (
              <div className="w-full md:w-64 space-y-1.5 flex-shrink-0">
                <div className="flex justify-between text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">
                  <span>Trial Progress</span>
                  <span>{trial.daysLeft} Days left</span>
                </div>
                <div className="h-2 w-full bg-slate-250 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full" style={{ width: `${trial.progressPercent}%` }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roster Quotas Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Active Roster Limits of &quot;{currentPlan.name}&quot;</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your current plan dictates constraints on administrator and staff user account creations in User Management.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Admin Limit</span>
              <span className="text-2xl font-black text-slate-800">
                {currentPlan.maxAdmin === 9999 ? 'Unlimited' : currentPlan.maxAdmin}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Staff Allowed</span>
              <span className="text-2xl font-black text-slate-800">
                {currentPlan.maxStaff === 9999 ? 'Unlimited' : currentPlan.maxStaff}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Sparkles className="w-5 h-5 text-blue-550" />
            <h3 className="font-bold text-slate-900 text-sm">E800 to E7 500 Subscriptions Blueprint</h3>
          </div>
          <p className="text-xs text-slate-550 leading-relaxed">
            The platform is custom architected to support diverse financial operations, from basic ledger logs (Starter E800) to full HR, Payroll, and continuous Audit logs (Enterprise E7 500).
          </p>
          <ul className="text-xs space-y-2 text-slate-600 font-medium">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
              <span>Middle tiers partition CRM, Inventory, Bank processing and Reports.</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
              <span>Enterprise includes the specialized internal Audit Center + Payroll.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Subscription Option Matrix */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 text-base">Select Your Workspace billing Tier</h3>
        <p className="text-xs text-slate-500">Upgrading immediately provisions advanced workflows and elevates user rosters. Select your package below:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            
            return (
              <div 
                key={plan.id}
                className={`bg-white border text-center flex flex-col justify-between rounded-xl p-5 shadow-3xs transition-all ${
                  isCurrent 
                    ? 'ring-2 ring-blue-600 border-transparent relative scale-102 z-10' 
                    : 'border-slate-200 hover:border-slate-350'
                }`}
              >
                {/* Active Tag */}
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white font-extrabold text-[8px] uppercase tracking-wider px-3.5 py-0.5 rounded-full shadow-md">
                    Current Plan
                  </span>
                )}

                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-xs tracking-tight line-clamp-1">{plan.name}</h4>
                  <div className="pt-2">
                    <span className="text-xs font-bold text-slate-400">E</span>
                    <span className="text-xl font-black text-slate-900">{plan.price.toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-slate-450">/mo</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium min-h-12 leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                {/* Core constraints mini dashboard */}
                <div className="py-3 border-t border-b border-slate-100 my-4 space-y-1.5 text-[10px] text-slate-600 font-bold select-none text-left font-sans">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Admins</span>
                    <span>{plan.maxAdmin === 9999 ? 'Unlimited' : plan.maxAdmin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Staff Allowed</span>
                    <span>{plan.maxStaff === 9999 ? 'Unlimited' : plan.maxStaff}</span>
                  </div>
                </div>

                {/* Subscribing / subscribing selector */}
                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => handleOpenCheckout(plan)}
                  className={`w-full py-2 font-bold text-[11px] rounded-lg cursor-pointer transition shadow-3xs flex items-center justify-center gap-1.5 ${
                    isCurrent 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-150 cursor-default' 
                      : 'bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-50'
                  }`}
                >
                  {isCurrent ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Activated
                    </>
                  ) : (
                    'Activate Tier'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Allocations Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs overflow-hidden font-sans">
        <h4 className="font-bold text-slate-900 text-sm mb-4">Detailed Feature Allocation Matrix</h4>
        <div className="overflow-x-auto text-[11px]">
          <table className="w-full text-left font-medium border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                <th className="p-3 pl-4">Core Workflow Modules</th>
                {SUBSCRIPTION_PLANS.map(p => (
                  <th key={p.id} className="p-3 text-center">{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {[
                { id: 'quotations', name: 'Quotations & Estimates' },
                { id: 'invoices', name: 'Invoices & Ledgering' },
                { id: 'receipts', name: 'Receipts Management' },
                { id: 'inventory', name: 'Inventory Stock Control' },
                { id: 'clients', name: 'Client CRM & Directory' },
                { id: 'transactions', name: 'Transactions Registry' },
                { id: 'reports', name: 'Reports & Business Analytics' },
                { id: 'audit', name: 'Cyber Audit Logs Registry' },
                { id: 'payroll', name: 'Payroll & Employee HR' },
                { id: 'audit_center', name: 'Advanced Audit compliance Center' }
              ].map(f => (
                <tr key={f.id} className="hover:bg-slate-55/50 transition font-sans">
                  <td className="p-3 pl-4 font-bold text-slate-800">{f.name}</td>
                  {SUBSCRIPTION_PLANS.map(p => {
                    const hasFeat = p.features.includes(f.id);
                    return (
                      <td key={p.id} className="p-3 text-center">
                        {hasFeat ? (
                          <span className="inline-block p-1 bg-emerald-50 text-emerald-600 rounded-full">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="text-slate-300 font-sans italic text-[10px]">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECURE CHECKOUT MODAL INTERFACE */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col md:flex-row min-h-[550px] animate-fade-in animate-duration-150">
            
            {/* Left sidebar: Transaction Summary */}
            <div className="md:w-5/12 bg-slate-900 text-white p-6 md:p-8 flex flex-col justify-between relative font-sans">
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Checkout Portal</span>
                  <h3 className="text-xl font-extrabold tracking-tight mt-1">Tier Upgrades Workspace</h3>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-3 font-sans">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Selected Tier:</span>
                    <span className="font-extrabold text-blue-300">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-xs text-slate-400">Price due:</span>
                    <div className="text-right">
                      <span className="text-xl font-black text-white">E{selectedPlan.price.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400">/mo</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 font-sans">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Privileges Unlock:</h4>
                  <ul className="text-xs space-y-2">
                    {selectedPlan.features.slice(0, 5).map((feat, i) => (
                      <li key={i} className="flex items-center gap-2 text-slate-300 font-medium">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span className="capitalize">{ALL_FEATURES.find(f => f.id === feat)?.label || feat}</span>
                      </li>
                    ))}
                    {selectedPlan.features.length > 5 && (
                      <li className="text-[10px] text-blue-300 font-bold pl-6">
                        + {selectedPlan.features.length - 5} More Advanced modules configured
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 space-y-3 mt-6 md:mt-0 font-sans">
                <div className="flex items-center gap-2.5 text-xs text-slate-350 font-medium">
                  <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <p>Secured with military-grade 256-bit encryption. All interactions audited.</p>
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Workspace: {company?.name} • Swaziland/Global Region
                </div>
              </div>
            </div>

            {/* Right container: Payment options & dynamic forms */}
            <div className="md:w-7/12 p-6 md:p-8 flex flex-col justify-between font-sans">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Interactive Swaziland & Global Gateway</h3>
                    <p className="text-xs text-slate-500 font-medium">Select your financial engine of choice below to authenticate your subscription payment.</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedPlan(null)}
                    className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer transition text-xs"
                  >
                    Close
                  </button>
                </div>

                {/* Gateway Error display */}
                {error && (
                  <div className="flex items-start gap-2.5 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl mb-4 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Payment Channel categories select tabs */}
                <div className="grid grid-cols-4 gap-2 mb-4 font-sans">
                  {[
                    { id: 'momo', label: 'Momo & Wallet', icon: Smartphone },
                    { id: 'card', label: 'Credit Card', icon: CreditCard },
                    { id: 'bank', label: 'Bank (EFT)', icon: Building },
                    { id: 'remit', label: 'Remittances', icon: Globe }
                  ].map(cat => {
                    // Filter methods matching active category
                    const matchedMethods = PAYMENT_METHODS.filter(m => m.category === cat.id);
                    const isActiveCategory = selectedMethod.category === cat.id;
                    const CatIcon = cat.icon;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          const firstOfCat = PAYMENT_METHODS.find(m => m.category === cat.id);
                          if (firstOfCat) setSelectedMethod(firstOfCat);
                        }}
                        className={`p-2 py-2.5 border rounded-xl flex flex-col items-center gap-1.5 transition text-center cursor-pointer ${
                          isActiveCategory 
                            ? 'bg-blue-50 border-blue-600 text-blue-900 font-extrabold' 
                            : 'bg-white border-slate-200 hover:bg-slate-50/70 text-slate-600'
                        }`}
                      >
                        <CatIcon className={`w-4 h-4 ${isActiveCategory ? 'text-blue-700' : 'text-slate-400'}`} />
                        <span className="text-[9px] uppercase tracking-wider font-semibold">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-Methods List under active category */}
                <div className="mb-6 font-sans">
                  <label className="block text-[10px] font-black text-slate-450 uppercase tracking-widest mb-1.5">Specific Payment Method</label>
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
                    {PAYMENT_METHODS.filter(m => m.category === selectedMethod.category).map(method => {
                      const isSelected = selectedMethod.id === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setSelectedMethod(method)}
                          className={`p-2 px-3 border rounded-lg text-left transition text-xs cursor-pointer flex flex-col justify-between h-14 ${
                            isSelected 
                              ? 'bg-slate-900 border-slate-900 text-white font-extrabold shadow-sm' 
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{method.name}</span>
                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>}
                          </div>
                          <span className={`text-[8.5px] mt-1 block ${isSelected ? 'text-slate-400 font-semibold' : 'text-slate-400 font-medium'}`}>{method.logoPlaceholder}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* DYNAMIC FORMS ACCORDING TO SELECTION */}
                <form onSubmit={handleProcessPayment} className="space-y-4">
                  {/* Momo, Unayo, M-Pesa, eMoolah View Form */}
                  {selectedMethod.category === 'momo' && (
                    <div className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl font-sans">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Smartphone className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-800">{selectedMethod.name} Payout Authentication</h4>
                      </div>
                      <p className="text-[10.5px] text-slate-500 leading-relaxed mb-3">
                        We will push an interactive PIN confirmation request overlay dialog directly to your registered handset. Confirm the deposit of <strong className="text-slate-850 font-extrabold">E{selectedPlan.price.toLocaleString()}</strong> to complete.
                      </p>
                      
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Handset Mobile Number</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-extrabold text-slate-400 select-none">
                            +268
                          </span>
                          <input 
                            type="text" 
                            required
                            placeholder="7600 1234 / 7900 1234"
                            value={momoPhone}
                            onChange={(e) => setMomoPhone(e.target.value)}
                            className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg pl-14 pr-3 py-2.5 focus:outline-hidden focus:border-blue-500 transition"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Visa / Mastercard Forms */}
                  {selectedMethod.category === 'card' && (
                    <div className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl font-sans">
                      <div className="flex items-center gap-2 justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-blue-600" />
                          <h4 className="text-xs font-bold text-slate-800 font-sans">Secure Merchant Card Input Panel</h4>
                        </div>
                        <span className="text-[10px] bg-slate-200 text-slate-650 font-extrabold uppercase px-2 py-0.5 rounded-md border border-slate-300">
                          {selectedMethod.logoPlaceholder}
                        </span>
                      </div>

                      {/* Cool Credit Card Visualizer */}
                      <div className="bg-gradient-to-br from-slate-800 to-indigo-950 p-4 rounded-xl text-white space-y-4 shadow-sm border border-slate-750 font-mono relative overflow-hidden">
                        <div className="absolute right-3 top-3 opacity-10 font-bold text-4xl select-none uppercase">{selectedMethod.logoPlaceholder}</div>
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Workspace Gateway Tokenizer</span>
                          <Lock className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div className="text-sm font-bold tracking-widest py-1.5 whitespace-pre placeholder-slate-500">
                          {cardNumber ? cardNumber.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}
                        </div>
                        <div className="flex justify-between items-end text-[9px]">
                          <div>
                            <span className="text-slate-400 block uppercase font-bold text-[7px]">Cardholder Name</span>
                            <span className="font-bold text-xs capitalize">{cardName || 'Director Name'}</span>
                          </div>
                          <div className="text-right font-sans">
                            <span className="text-slate-300 block uppercase font-bold text-[7px]">Expires</span>
                            <span className="font-mono font-bold tracking-widest">{cardExpiry || 'MM/YY'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cardholder Full Name</label>
                          <input 
                            type="text" 
                            required
                            placeholder="Name as printed on credentials card"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-hidden focus:border-blue-500 transition"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">16-Digit Card Number</label>
                            <input 
                              type="text" 
                              required
                              maxLength={16}
                              placeholder="4111 0000 0000 0000"
                              value={cardNumber}
                              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                              className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-hidden focus:border-blue-500 transition"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Expiry Date</label>
                            <input 
                              type="text" 
                              required
                              maxLength={5}
                              placeholder="MM/YY"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              className="w-full text-xs font-mono text-center bg-white border border-slate-200 rounded-lg px-2 py-2.5 focus:outline-hidden focus:border-blue-500 transition"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">CVV / Security Code</label>
                            <input 
                              type="password" 
                              required
                              maxLength={3}
                              placeholder="•••"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                              className="w-full text-xs font-mono text-center bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-hidden focus:border-blue-500 transition"
                            />
                          </div>
                          <div className="flex items-end text-[10px] text-slate-450 font-semibold pb-2 select-none">
                            🔒 VISA Secure / MC ID check
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bank Transfer (EFT) Form */}
                  {selectedMethod.id === 'eft' && (
                    <div className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl text-xs font-sans">
                      <div className="flex items-center gap-2 mb-1">
                        <Building className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-800">Swaziland Corporate Banking Direct Details</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal mb-3">
                        Submit a direct electronic bank transfer (EFT) to the platform provider account below. You must upload a proof of payment slip.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2 bg-white border border-slate-200 rounded-xl p-3 font-semibold text-slate-700">
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase">Bank Name</span>
                          <span>Standard Bank Eswatini</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase">Account Number</span>
                          <span className="font-mono text-slate-800">90912192019</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase">Branch Code</span>
                          <span className="font-mono text-slate-800">660500</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase">Account Type</span>
                          <span>Corporate Cheque</span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-slate-100 flex justify-between items-center text-[10px] mt-2">
                          <span className="text-slate-450">Required Payment Reference:</span>
                          <span className="bg-blue-50 px-2 py-0.5 rounded text-blue-800 font-bold uppercase">{company?.name?.slice(0, 5) || 'SUB'}-EST</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Upload EFT confirmation Transfer Slip</label>
                        {popFileSimulated ? (
                          <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 text-blue-850 rounded-lg">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-500" />
                              <span className="font-mono text-[10px] font-bold">{popFileSimulated}</span>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setPopFileSimulated(null)}
                              className="text-xs text-red-500 font-extrabold hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => setPopFileSimulated('EFT_Proof_SUB_' + (company?.name || 'Workspace').replace(/\s+/g, '_') + '.pdf')}
                            className="border-2 border-dashed border-slate-250 hover:border-slate-400 hover:bg-slate-100/50 rounded-xl p-4 text-center cursor-pointer transition-all"
                          >
                            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                            <p className="text-[10px] text-slate-500 font-bold">Click here to attach Proof of Payment slip</p>
                            <p className="text-[8.5px] text-slate-400 mt-0.5">Supports PDF, PNG, JPG (Max 5MB)</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Western Union, MoneyGram, Mukuru view forms */}
                  {selectedMethod.category === 'remit' && (
                    <div className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl text-xs font-sans font-medium">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Globe className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-800">{selectedMethod.name} Settlement Input</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal mb-3">
                        Submit physical remittance deposits at any partner branch or online wallet. Provide the money transfer reference code (MTCN / pin code) below for real-time ledger allocation.
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sender Full Name (Remitter)</label>
                          <input 
                            type="text" 
                            required
                            placeholder="Jane Doe"
                            value={remitSender}
                            onChange={(e) => setRemitSender(e.target.value)}
                            className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-hidden focus:border-blue-500 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Transfer Code reference (MTCN / PIN)</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. 8-Digit or 10-Digit PIN"
                            value={remitMtcn}
                            onChange={(e) => setRemitMtcn(e.target.value)}
                            className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-hidden focus:border-blue-500 transition"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                    <button 
                      type="button" 
                      onClick={() => setSelectedPlan(null)}
                      className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Cancel Upgrade
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="px-6 py-2 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl transition cursor-pointer select-none flex items-center gap-2 min-w-[140px] justify-center shadow-3xs disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Authorization...
                        </>
                      ) : (
                        `Authorize E${selectedPlan.price.toLocaleString()}`
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

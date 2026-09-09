'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useUserStore } from '../lib/store';
import { 
  SUBSCRIPTION_PLANS, 
  SubscriptionPlan, 
  ALL_FEATURES, 
  getLockedFeaturesForPlan, 
  daysBetween,
  getPlanPrice,
  formatPlanPrice
} from '../lib/subscriptions';
import { logAction } from '../lib/audit';
import { getPaddle, PADDLE_PRICE_MAP, isPaddleConfigured, getPaddleEnvironment } from '../lib/paddle-client';
import { 
  Check, 
  AlertTriangle, 
  Layers, 
  Users, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  X,
  Shield,
  CreditCard,
  ExternalLink,
  Info,
  KeyRound,
  RefreshCw
} from 'lucide-react';

export default function SubscriptionsView() {
  const { currentUser } = useUserStore();
  const [company, setCompany] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Paddle Checkout states
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [paddleReady, setPaddleReady] = useState(false);
  const [paddleConfigured, setPaddleConfigured] = useState(false);

  const fetchCompanyDetails = useCallback(async () => {
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
  }, [currentUser?.companyId]);

  useEffect(() => {
    fetchCompanyDetails();
  }, [fetchCompanyDetails, currentUser?.companyId]);

  // Check Paddle configuration on mount
  useEffect(() => {
    const configured = isPaddleConfigured();
    setPaddleConfigured(configured);
    if (configured) {
      getPaddle().then((p) => {
        if (p) setPaddleReady(true);
      });
    }
  }, []);

  const handleOpenCheckout = async (plan: SubscriptionPlan) => {
    if (!currentUser?.companyId || !company) return;
    
    // Check privilege
    if (currentUser.role !== 'BUSINESS_ADMIN' && currentUser.role !== 'MASTER_ADMIN') {
      setError("Only Corporate Administrators or System Supervisors can modify billing and subscription parameters.");
      return;
    }

    setSelectedPlan(plan);
    setError(null);
    setSuccess(null);

    // If Paddle is fully configured with client token, initialize and open Paddle checkout overlay
    if (paddleConfigured) {
      setIsProcessing(true);
      try {
        const paddle = await getPaddle((event: any) => {
          if (event?.name === 'checkout.completed') {
            handlePaddleCheckoutSuccess(plan, event?.data);
          } else if (event?.name === 'checkout.error') {
            setError("Paddle checkout error: " + (event?.data?.message || "Payment authorization failed."));
            setIsProcessing(false);
          }
        });

        if (paddle) {
          const priceId = PADDLE_PRICE_MAP[plan.id] || 'pri_standard';
          paddle.Checkout.open({
            items: [{ priceId, quantity: 1 }],
            customData: {
              companyId: currentUser.companyId,
              userId: currentUser.id,
              userEmail: currentUser.email,
              tier: plan.id,
            },
            customer: {
              email: currentUser.email,
            },
            settings: {
              variant: 'one-page',
              displayMode: 'overlay',
              theme: 'light',
              locale: 'en',
              successUrl: window.location.href,
            },
          });
        } else {
          setError("Failed to initialize Paddle client. Check your network or NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.");
        }
      } catch (err: any) {
        console.error("Paddle checkout open error:", err);
        setError("Paddle checkout initiation failed: " + err.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handlePaddleCheckoutSuccess = async (plan: SubscriptionPlan, eventData?: any) => {
    if (!currentUser?.companyId) return;

    try {
      const planLockedFeats = getLockedFeaturesForPlan(plan.id);
      const subId = eventData?.id || eventData?.subscription_id || `sub_pdl_${Date.now()}`;
      const customerId = eventData?.customer_id || `ctm_pdl_${Date.now()}`;
      
      const calculatedPrice = getPlanPrice(plan, billingCycle);
      const formattedPrice = formatPlanPrice(plan, billingCycle, company?.currency || 'USD');

      const updateData: any = {
        subscriptionPlanId: plan.id,
        subscriptionPlan: plan.name,
        subscriptionBillingCycle: billingCycle,
        lockedFeatures: planLockedFeats,
        subscriptionStatus: 'active',
        subscriptionStartedAt: new Date().toISOString(),
        lastPaymentRef: subId,
        lastPaymentMethod: 'Paddle Billing (MoR)',
        lastPaymentAmount: calculatedPrice,
        paddleSubscriptionId: subId,
        paddleCustomerId: customerId,
      };

      await updateDoc(doc(db, 'companies', currentUser.companyId), updateData);
      
      try {
        await updateDoc(doc(db, 'businesses', currentUser.companyId), updateData);
      } catch (err) {
        console.warn("Businesses mirror reference not present.");
      }

      await logAction(
        'Paddle Subscription Activated',
        `Workspace upgraded to "${plan.name}" (${formattedPrice}/${billingCycle === 'annual' ? 'yr' : 'mo'}) via Paddle Billing. Subscription ID: ${subId}`,
        currentUser.companyId
      );

      setCompany((prev: any) => ({ ...prev, ...updateData }));
      setSuccess(`Transaction Processed via Paddle! Workspace upgraded to "${plan.name}" with real-time provisioning.`);
      setSelectedPlan(null);
    } catch (err: any) {
      console.error(err);
      setError("Failed to record Paddle upgrade in workspace: " + err.message);
    }
  };

  const handleSimulatePaddleSandboxUpgrade = async () => {
    if (!selectedPlan || !currentUser?.companyId) return;
    setIsProcessing(true);
    setError(null);

    try {
      await handlePaddleCheckoutSuccess(selectedPlan, {
        id: `sub_sdbx_${Math.floor(100000 + Math.random() * 900000)}`,
        customer_id: `ctm_sdbx_${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'active'
      });
    } catch (err: any) {
      setError("Sandbox testing error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenCustomerPortal = async () => {
    if (!currentUser?.companyId) return;
    setIsOpeningPortal(true);
    setError(null);

    try {
      const res = await fetch('/api/paddle/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: currentUser.companyId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to mint customer portal session.');
      }

      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        setError('No portal URL returned by Paddle.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to Paddle Customer Portal.');
    } finally {
      setIsOpeningPortal(false);
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
  const isPaidActive = company?.subscriptionStatus === 'active';
  const paddleEnv = getPaddleEnvironment();

  return (
    <div className="space-y-8 font-sans max-w-6xl mx-auto">
      {/* Upper Banner Status */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-900 tracking-tight">Paddle Subscriptions & Billing Engine</h2>
          <p className="text-xs text-slate-500 font-medium">Merchant of Record billing, automated global tax compliance, and self-service customer portal.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Gateway Status Badge */}
          <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-xs font-bold text-slate-700">
            <span className={`w-2 h-2 rounded-full ${paddleConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>Paddle {paddleEnv === 'production' ? 'Live' : 'Sandbox'}</span>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-xs font-bold text-slate-700">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Tier: {currentPlan.name}</span>
          </div>
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
            <h4 className="font-bold">Billing Gateway Alert</h4>
            <p className="text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Trial / Active Subscription Monitor Box */}
      <div className={`p-6 border rounded-2xl ${isTrial ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-150' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border ${
                isTrial ? 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' : 'bg-emerald-100 text-emerald-800 border-emerald-250'
              }`}>
                {isTrial ? '14-Day Trial Active' : 'Paid Paddle Subscription'}
              </span>
              <span className="text-xs text-slate-400 font-semibold">•</span>
              <span className="text-xs font-bold text-slate-700">
                {isTrial && trial ? `Expires: ${trial.endsAtFormatted}` : `Status: Active (${currentPlan.name})`}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {isTrial && trial
                ? `Your trial period ends in ${trial.daysLeft} days` 
                : `Active Subscription: ${currentPlan.name}`}
            </h3>
            <p className="text-xs text-slate-500 leading-normal">
              {isTrial 
                ? "Upgrade seamlessly through Paddle to activate continuous double-entry ledger, multi-user quotas, and enterprise modules."
                : "Your organization is securely billed via Paddle Merchant of Record. Invoices and tax receipts are available via the self-service portal."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isPaidActive && company?.paddleCustomerId && (
              <button
                type="button"
                onClick={handleOpenCustomerPortal}
                disabled={isOpeningPortal}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {isOpeningPortal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                <span>Paddle Customer Portal</span>
              </button>
            )}

            {isTrial && trial && (
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
      </div>

      {/* Roster Quotas Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Active Roster Limits of &quot;{currentPlan.name}&quot;</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your current subscription dictates constraints on administrator and staff user account creations in User Management.
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
            <Shield className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Paddle Merchant of Record Architecture</h3>
          </div>
          <p className="text-xs text-slate-550 leading-relaxed">
            All subscription payments, VAT/Sales tax calculation, and PCI-DSS compliance are handled through Paddle Billing.
          </p>
          <ul className="text-xs space-y-2 text-slate-600 font-medium">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span>Global currency conversion (USD, EUR, GBP, ZAR) and cross-border invoicing.</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span>Automated webhooks keep your workspace subscription tier in continuous synchronization.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Subscription Option Matrix */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Select Your Workspace Billing Tier</h3>
            <p className="text-xs text-slate-500">Upgrading through Paddle immediately provisions advanced workflows and elevates user quotas:</p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                billingCycle === 'annual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>Annual</span>
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full">
                -20%
              </span>
            </button>
          </div>
        </div>
        
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
                    <span className="text-xl font-black text-slate-900">
                      {formatPlanPrice(plan, billingCycle, company?.currency || 'USD')}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      /{billingCycle === 'annual' ? 'yr' : 'mo'}
                    </span>
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
                  disabled={isCurrent || isProcessing}
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
                { id: 'audit_center', name: 'Advanced Audit Compliance Center' }
              ].map(f => (
                <tr key={f.id} className="hover:bg-slate-50/50 transition font-sans">
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

      {/* PADDLE CHECKOUT MODAL (For Sandbox test / Token guide when overlay is opened or needs manual confirmation) */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-150 overflow-hidden flex flex-col animate-fade-in animate-duration-150">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Paddle Billing Gateway</span>
                <h3 className="text-lg font-bold mt-1">Upgrade to {selectedPlan.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatPlanPrice(selectedPlan, billingCycle, company?.currency || 'USD')} / {billingCycle === 'annual' ? 'year' : 'month'} • Merchant of Record checkout
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 text-xs">
              {paddleConfigured ? (
                <div className="space-y-4 text-center py-4">
                  <CreditCard className="w-12 h-12 text-blue-600 mx-auto animate-pulse" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-slate-900">Opening Hosted Paddle Checkout...</h4>
                    <p className="text-slate-500">
                      The Paddle secure payment overlay is launching. If popups are blocked, confirm below:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCheckout(selectedPlan)}
                    disabled={isProcessing}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                    <span>Relaunch Paddle Checkout Overlay</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900">
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
                      <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>Paddle Client Token Not Detected</span>
                    </div>
                    <p className="text-[11px] text-amber-750 leading-relaxed">
                      To run live client-side checkouts in this environment, provide <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">NEXT_PUBLIC_PADDLE_CLIENT_TOKEN</code> in your environment or Settings.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <span className="font-bold text-slate-800 block text-xs">Paddle Sandbox Test Simulation</span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      You can execute an end-to-end sandbox verification flow right now. This mimics the Paddle <code className="font-mono text-[10px]">subscription.created</code> lifecycle and provisions the workspace tier with real Firestore records and SecOps audit logging.
                    </p>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleSimulatePaddleSandboxUpgrade}
                      className="w-full mt-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>Execute Sandbox Upgrade to {selectedPlan.name}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-between items-center text-[10px] text-slate-400">
              <span>Paddle Merchant of Record • PCI-DSS Level 1 Compliant</span>
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

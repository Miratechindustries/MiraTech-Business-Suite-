'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useUserStore } from '../lib/store';
import { normalizePlanId } from '../lib/planAccess';
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
import { getPaddle, PADDLE_PRICE_MAP, isPaddleConfigured, getPaddleEnvironment, getPaddleEventLogs, PaddleEventLog } from '../lib/paddle-client';
import { safeFetchJson } from '../lib/safe-fetch';
import PaddleCheckoutModal from './PaddleCheckoutModal';
import SubscriptionActivationStatusChecker from './SubscriptionActivationStatusChecker';
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
  RefreshCw,
  FileText,
  Download,
  Receipt,
  Calendar,
  ArrowDownRight
} from 'lucide-react';

export default function SubscriptionsView() {
  const { currentUser, setCurrentUser } = useUserStore();
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
  const [autoRenewUpdating, setAutoRenewUpdating] = useState(false);
  const [paymentLogs, setPaymentLogs] = useState<PaddleEventLog[]>([]);

  // Payment History & Invoices from Paddle API
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [isLiveGateway, setIsLiveGateway] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<'invoices' | 'logs'>('invoices');

  const targetCompanyId = 
    currentUser?.companyId || 
    currentUser?.businessId || 
    (typeof window !== 'undefined' ? localStorage.getItem("mira_active_workspace_id") : null);

  // Fetch past invoices/receipts using Paddle API data
  const fetchPaymentHistory = useCallback(async (compIdParam?: string) => {
    const compId = compIdParam || targetCompanyId;
    if (!compId) return;
    setLoadingInvoices(true);
    setInvoicesError(null);
    try {
      const custId = company?.paddleCustomerId || '';
      const subId = company?.paddleSubscriptionId || '';
      const qParams = new URLSearchParams({ companyId: compId });
      if (custId) qParams.append('customerId', custId);
      if (subId) qParams.append('subscriptionId', subId);
      const { ok, data, error: fetchErr } = await safeFetchJson(`/api/paddle/transactions?${qParams.toString()}`);
      if (!ok) {
        throw new Error(fetchErr || "Failed to load payment history");
      }
      setInvoices(data.transactions || []);
      setIsLiveGateway(Boolean(data.isLiveGateway));
    } catch (err: any) {
      console.warn("Payment history fetch:", err.message);
      setInvoicesError(err.message || "Failed to load payment history");
    } finally {
      setLoadingInvoices(false);
    }
  }, [targetCompanyId, company?.paddleCustomerId, company?.paddleSubscriptionId]);

  const handleDownloadInvoice = async (txnId: string) => {
    try {
      setDownloadingInvoiceId(txnId);
      const { ok, data } = await safeFetchJson(`/api/paddle/transactions?action=invoice&transactionId=${encodeURIComponent(txnId)}`);
      if (ok && data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        await handleOpenCustomerPortal();
      }
    } catch (err: any) {
      console.error("Failed to download invoice PDF:", err);
      await handleOpenCustomerPortal();
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  // Real-time synchronization of company subscription metrics
  useEffect(() => {
    setPaymentLogs(getPaddleEventLogs());
    if (!targetCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'companies', targetCompanyId),
      (compSnap) => {
        if (compSnap.exists()) {
          setCompany({ id: compSnap.id, ...compSnap.data() });
          setLoading(false);
        } else {
          // Fallback to businesses collection
          getDoc(doc(db, 'businesses', targetCompanyId))
            .then((bizSnap) => {
              if (bizSnap.exists()) {
                setCompany({ id: bizSnap.id, ...bizSnap.data() });
              } else {
                setError("Company record not found in system.");
              }
            })
            .catch((err) => {
              console.warn("Error finding company fallback:", err);
              setError("Failed to load subscriber metrics.");
            })
            .finally(() => setLoading(false));
        }
      },
      (err) => {
        console.warn("Subscriptions real-time listener error:", err);
        setLoading(false);
      }
    );

    fetchPaymentHistory(targetCompanyId);

    return () => unsub();
  }, [targetCompanyId, fetchPaymentHistory]);

  const handleToggleAutoRenew = async (newVal: boolean) => {
    if (!targetCompanyId) return;
    if (currentUser?.role !== 'BUSINESS_ADMIN' && currentUser?.role !== 'MASTER_ADMIN') {
      setError("Only Corporate Administrators can modify subscription continuity settings.");
      return;
    }
    setAutoRenewUpdating(true);
    setError(null);
    try {
      const updateData = { autoRenew: newVal };
      await setDoc(doc(db, 'companies', targetCompanyId), updateData, { merge: true });
      try {
        await setDoc(doc(db, 'businesses', targetCompanyId), updateData, { merge: true });
      } catch (e) {}

      setCompany((prev: any) => ({ ...prev, autoRenew: newVal }));
      setSuccess(`Subscription auto-renew has been ${newVal ? 'enabled' : 'disabled'}.`);
      await logAction(
        'Subscription Auto-Renew Updated',
        `Auto-renew continuity toggled to ${newVal ? 'ON' : 'OFF'}`,
        targetCompanyId
      );
    } catch (err: any) {
      console.error(err);
      setError("Failed to update auto-renew preference: " + err.message);
    } finally {
      setAutoRenewUpdating(false);
    }
  };

  // Check Paddle configuration on mount
  const [checkoutModalPlan, setCheckoutModalPlan] = useState<SubscriptionPlan | null>(null);

  useEffect(() => {
    const configured = isPaddleConfigured();
    setPaddleConfigured(configured);
    if (configured) {
      getPaddle().then((p) => {
        if (p) setPaddleReady(true);
      });
    }
  }, []);

  const handleConfirmModalCheckout = () => {
    if (!checkoutModalPlan) return;
    const plan = checkoutModalPlan;
    setCheckoutModalPlan(null);
    handleOpenCheckout(plan);
  };

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
          } else if (event?.name === 'checkout.error' || event?.name === 'error') {
            const errDetail = event?.data?.message || event?.data?.error || "Price ID or catalog mismatch in Paddle account.";
            setError(`Paddle Catalog Notice: ${errDetail}. If your Paddle account uses custom Price IDs, configure NEXT_PUBLIC_PADDLE_PRICE_${plan.id.toUpperCase()} in Vercel, or click 'Simulate Sandbox Upgrade' below to test feature activation.`);
            setIsProcessing(false);
          }
        });

        if (paddle) {
          const priceId = PADDLE_PRICE_MAP[plan.id] || 'pri_standard';
          paddle.Checkout.open({
            items: [{ priceId, quantity: 1 }],
            customData: {
              companyId: targetCompanyId,
              userId: currentUser?.id,
              userEmail: currentUser?.email,
              tier: plan.id,
            },
            customer: {
              email: currentUser?.email,
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
    if (!targetCompanyId) return;

    try {
      const planLockedFeats = getLockedFeaturesForPlan(plan.id);
      const subId = eventData?.id || eventData?.subscription_id || `sub_pdl_${Date.now()}`;
      const customerId = eventData?.customer_id || `ctm_pdl_${Date.now()}`;
      
      const calculatedPrice = getPlanPrice(plan, billingCycle);
      const formattedPrice = formatPlanPrice(plan, billingCycle, 'ZAR');

      const nextRenewal = new Date();
      if (billingCycle === 'annual') {
        nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
      } else {
        nextRenewal.setMonth(nextRenewal.getMonth() + 1);
      }
      const nextBillingDateIso = nextRenewal.toISOString();

      const updateData: any = {
        subscriptionPlanId: plan.id,
        subscriptionPlan: plan.name,
        plan: plan.id,
        tier: plan.id,
        subscriptionBillingCycle: billingCycle,
        lockedFeatures: planLockedFeats,
        status: 'active',
        subscriptionStatus: 'active',
        next_billing_date: nextBillingDateIso,
        nextBillingDate: nextBillingDateIso,
        subscriptionRenewsAt: nextBillingDateIso,
        subscriptionStartedAt: new Date().toISOString(),
        lastPaymentRef: subId,
        lastPaymentMethod: 'Paddle Billing (MoR)',
        lastPaymentAmount: calculatedPrice,
        paddleSubscriptionId: subId,
        paddleCustomerId: customerId,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'companies', targetCompanyId), updateData, { merge: true });
      
      try {
        await setDoc(doc(db, 'businesses', targetCompanyId), updateData, { merge: true });
      } catch (err) {
        console.warn("Businesses mirror reference not present.");
      }

      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          companyId: targetCompanyId,
          businessId: targetCompanyId,
          subscriptionPlanId: plan.id,
          subscriptionPlan: plan.name,
        });
      }

      await logAction(
        'Paddle Subscription Activated',
        `Workspace upgraded to "${plan.name}" (${formattedPrice}/${billingCycle === 'annual' ? 'yr' : 'mo'}) via Paddle Billing. Subscription ID: ${subId}`,
        targetCompanyId
      );

      setCompany((prev: any) => ({ ...prev, ...updateData }));
      setSuccess(`Transaction Processed via Paddle! Workspace upgraded to "${plan.name}" with real-time provisioning.`);
      setSelectedPlan(null);
      fetchPaymentHistory(targetCompanyId);
    } catch (err: any) {
      console.error(err);
      setError("Failed to record Paddle upgrade in workspace: " + err.message);
    }
  };

  const handleSimulatePaddleSandboxUpgrade = async () => {
    if (!selectedPlan || !targetCompanyId) return;
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
    if (!targetCompanyId) return;
    setIsOpeningPortal(true);
    setError(null);

    try {
      const { ok, data, error: portalErr } = await safeFetchJson('/api/paddle/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: targetCompanyId }),
      });

      if (!ok) {
        throw new Error(portalErr || 'Failed to mint customer portal session.');
      }

      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        setError(data?.notice || 'No portal URL returned by Paddle.');
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

  if (loading && !company) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-4">Synthesizing billing registry...</p>
      </div>
    );
  }

  const currentPlanId = normalizePlanId(company?.subscriptionPlanId || company?.subscriptionPlan || company?.plan || company?.tier || 'starter');
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

      {/* Backend Subscription Activation Status Checker & Confirmation Flow */}
      {targetCompanyId && (
        <SubscriptionActivationStatusChecker companyId={targetCompanyId} />
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

      {/* Auto-Renew Subscription Continuity Control */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl mt-0.5">
            <RefreshCw className={`w-5 h-5 ${autoRenewUpdating ? 'animate-spin' : ''}`} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">Subscription Auto-Renewal</h4>
              <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border ${
                company?.autoRenew !== false ? 'bg-emerald-100 text-emerald-800 border-emerald-250' : 'bg-amber-100 text-amber-800 border-amber-250'
              }`}>
                {company?.autoRenew !== false ? 'Enabled (Continuous)' : 'Manual Renewal Only'}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-normal max-w-xl">
              Control your subscription continuity. When enabled, your subscription automatically renews at the end of each billing cycle through Paddle Merchant of Record.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={company?.autoRenew !== false}
              disabled={autoRenewUpdating}
              onChange={(e) => handleToggleAutoRenew(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <span className="text-xs font-bold text-slate-700">
            {company?.autoRenew !== false ? 'Auto-Renew ON' : 'Auto-Renew OFF'}
          </span>
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

      {/* Payment History & Invoices Section */}
      <div id="section-payment-history" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-150">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Payment History & Invoices</h3>
                <p className="text-xs text-slate-500 font-medium">Past billing statements, transaction receipts, and merchant records fetched via Paddle</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Gateway state pill */}
            {isLiveGateway ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-250">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                Paddle MoR Synced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                Workspace Ledger
              </span>
            )}

            {/* Tab Toggle between Invoices & Webhooks */}
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setHistoryTab('invoices')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  historyTab === 'invoices'
                    ? 'bg-white text-slate-900 shadow-3xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Invoices ({invoices.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('logs')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  historyTab === 'logs'
                    ? 'bg-white text-slate-900 shadow-3xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Events ({paymentLogs.length})
              </button>
            </div>

            {/* Refresh button */}
            <button
              type="button"
              onClick={() => fetchPaymentHistory()}
              disabled={loadingInvoices}
              title="Refresh transaction history from Paddle"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingInvoices ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {historyTab === 'invoices' ? (
          <div className="space-y-3">
            {loadingInvoices ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                <span className="text-xs font-semibold">Synchronizing invoices with Paddle API...</span>
              </div>
            ) : invoicesError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
                <span>{invoicesError}</span>
                <button
                  type="button"
                  onClick={() => fetchPaymentHistory()}
                  className="font-bold underline cursor-pointer ml-2"
                >
                  Retry
                </button>
              </div>
            ) : invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-150 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Receipt / Tax Doc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          <span className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{inv.invoiceNumber}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {inv.billedAt ? new Date(inv.billedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {inv.description}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {inv.amount}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            inv.status === 'completed' || inv.status === 'paid' || inv.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inv.status === 'billed'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : inv.status === 'past_due'
                              ? 'bg-amber-50 text-amber-800 border border-amber-300'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {(inv.status === 'completed' || inv.status === 'paid' || inv.status === 'active') && (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            )}
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoice(inv.id)}
                              disabled={downloadingInvoiceId === inv.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition cursor-pointer border border-slate-200 hover:border-indigo-200"
                            >
                              {downloadingInvoiceId === inv.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                              ) : (
                                <Download className="w-3 h-3 text-slate-500" />
                              )}
                              <span>PDF Invoice</span>
                            </button>
                            {inv.receiptUrl && (
                              <a
                                href={inv.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                                title="View Online Receipt"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No past billing receipts or invoices recorded yet.</p>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  When your workspace processes a subscription checkout or recurring billing cycle via Paddle, official tax-compliant PDF invoices will appear here automatically.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCustomerPortal}
                  disabled={isOpeningPortal}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition cursor-pointer shadow-3xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>Launch Paddle Customer Portal</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Webhook Event Stream */
          <div>
            {paymentLogs.length > 0 ? (
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {paymentLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-xl text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md ${
                          log.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                          log.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {log.name}
                        </span>
                        <span className="text-slate-400 text-[11px] font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-600 font-mono text-[11px] truncate max-w-md">{log.details}</p>
                    </div>
                    <span className={`font-bold text-[11px] uppercase ${
                      log.status === 'completed' ? 'text-emerald-600' : log.status === 'error' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400 space-y-1">
                <p>No recent payment transactions or webhooks recorded in this session yet.</p>
                <p className="text-[11px]">Paddle checkout completions and error logs will appear here automatically.</p>
              </div>
            )}
          </div>
        )}
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
                      {formatPlanPrice(plan, billingCycle, 'ZAR')}
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
                  onClick={() => setCheckoutModalPlan(plan)}
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
                  {formatPlanPrice(selectedPlan, billingCycle, 'ZAR')} / {billingCycle === 'annual' ? 'year' : 'month'} • Merchant of Record checkout
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
                <div className="space-y-4 text-center py-2">
                  <CreditCard className="w-10 h-10 text-blue-600 mx-auto animate-pulse" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-slate-900">Hosted Paddle Checkout Active</h4>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Click below to open the secure Paddle payment overlay. Note: If your custom <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">NEXT_PUBLIC_PADDLE_CLIENT_TOKEN</code> does not match default Price IDs, Paddle overlay may show a catalog error.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenCheckout(selectedPlan)}
                      disabled={isProcessing}
                      className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                      <span>Launch Paddle Overlay</span>
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleSimulatePaddleSandboxUpgrade}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>Simulate Sandbox Upgrade</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900">
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
                      <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>Paddle Client Token Not Configured</span>
                    </div>
                    <p className="text-[11px] text-amber-750 leading-relaxed">
                      To run live client-side checkouts in this environment, provide <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">NEXT_PUBLIC_PADDLE_CLIENT_TOKEN</code> in your environment variables.
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

            {/* Modal Footer & Paddle MoR Disclosure */}
            <div className="bg-slate-50 border-t border-slate-150 p-4 space-y-2 text-[11px] text-slate-500">
              <p className="leading-relaxed text-[10px] text-slate-400">
                Payments and subscriptions are securely processed by <strong>Paddle.com Market Ltd as Merchant of Record</strong>. Subscriptions renew automatically every {billingCycle === 'annual' ? 'year' : 'month'} until cancelled. View our{' '}
                <a href="/terms" target="_blank" className="text-blue-600 hover:underline">Terms of Service</a> and{' '}
                <a href="/refund" target="_blank" className="text-blue-600 hover:underline">Refund &amp; Cancellation Policy</a>.
              </p>
              <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[10px]">
                <span className="text-emerald-700 font-medium">✓ PCI-DSS Level 1 Encrypted • 14-Day Evaluation</span>
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
        </div>
      )}
      {/* Pre-Checkout Confirmation Modal */}
      <PaddleCheckoutModal
        isOpen={Boolean(checkoutModalPlan)}
        plan={checkoutModalPlan}
        billingCycle={billingCycle}
        onClose={() => setCheckoutModalPlan(null)}
        onConfirm={handleConfirmModalCheckout}
        loading={isProcessing}
      />
    </div>
  );
}

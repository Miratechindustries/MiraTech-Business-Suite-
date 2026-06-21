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
  Clock 
} from 'lucide-react';

export default function SubscriptionsView() {
  const { currentUser } = useUserStore();
  const [company, setCompany] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleUpdateSubscription = async (plan: SubscriptionPlan) => {
    if (!currentUser?.companyId || !company) return;
    
    // Check privilege
    if (currentUser.role !== 'BUSINESS_ADMIN' && currentUser.role !== 'MASTER_ADMIN') {
      setError("Only Corporate Administrators or System Supervisors can modify billing and subscription parameters.");
      return;
    }

    setUpdatingId(plan.id);
    setError(null);
    setSuccess(null);

    try {
      const planLockedFeats = getLockedFeaturesForPlan(plan.id);
      
      const updateData: any = {
        subscriptionPlanId: plan.id,
        lockedFeatures: planLockedFeats,
        subscriptionStatus: 'active', // moving to active paid tier
      };

      // If they upgrade, preserve trial period details but update tier
      if (!company.subscriptionStartedAt) {
        updateData.subscriptionStartedAt = new Date().toISOString();
      }

      await updateDoc(doc(db, 'companies', currentUser.companyId), updateData);
      
      // Secondary backup sync for business collection
      try {
        await updateDoc(doc(db, 'businesses', currentUser.companyId), updateData);
      } catch (err) {
        console.warn("Businesses mirror document not present to update.");
      }

      await logAction(
        'Subscription Modified',
        `Corporate workspace modified subscription tier to "${plan.name}" (E${plan.price.toLocaleString()}/mo).`,
        currentUser.companyId
      );

      setCompany(prev => ({ ...prev, ...updateData }));
      setSuccess(`Workspace successfully upgraded to "${plan.name}" plan! New capabilities are now initialized.`);
    } catch (err: any) {
      console.error(err);
      setError("Billing processor encountered a handshake issue: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // If trial calculation is running
  const getTrialDetails = () => {
    if (!company) return null;
    const createdAt = company.createdAt ? new Date(company.createdAt) : new Date();
    
    // Setup standard trial duration (14 days)
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
            const isUpgrading = updatingId === plan.id;
            
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
                <div className="py-3 border-t border-b border-slate-100 my-4 space-y-1.5 text-[10px] text-slate-600 font-bold select-none text-left">
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
                  disabled={isCurrent || isUpgrading}
                  onClick={() => handleUpdateSubscription(plan)}
                  className={`w-full py-1.5 font-bold text-[11px] rounded-lg cursor-pointer transition shadow-3xs flex items-center justify-center gap-1.5 ${
                    isCurrent 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                      : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50'
                  }`}
                >
                  {isUpgrading && <Loader2 className="w-3 h-3 animate-spin" />}
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
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs overflow-hidden">
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
                <tr key={f.id} className="hover:bg-slate-50/50 transition">
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
    </div>
  );
}

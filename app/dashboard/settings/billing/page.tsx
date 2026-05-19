'use client'

import React, { useEffect, useState, useCallback } from 'react';
import { 
  CreditCard, 
  Zap, 
  ShieldCheck, 
  Clock, 
  Check, 
  AlertCircle, 
  ArrowUpCircle,
  XCircle,
  Loader2,
  Users as UsersIcon,
  Building
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc, 
  addDoc,
  getDoc
} from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import { Subscription, SubscriptionPlan, UserProfile } from '@/lib/types';
import { toast } from 'sonner';

export default function BillingPage() {
  const { business, user } = useAppStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [businessUsersCount, setBusinessUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState('');

  const fetchData = useCallback(async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      // 1. Fetch Subscription
      const subQuery = query(
        collection(db, 'subscriptions'), 
        where('businessId', '==', business.id)
      );
      const subSnap = await getDocs(subQuery);
      if (!subSnap.empty) {
        setSubscription({ id: subSnap.docs[0].id, ...subSnap.docs[0].data() } as Subscription);
      }

      // 2. Fetch Active Plans
      const plansSnap = await getDocs(query(collection(db, 'plans'), where('status', '==', 'active')));
      setPlans(plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan)));

      // 3. Fetch Usage (Users)
      const usersQuery = query(collection(db, 'users'), where('businessId', '==', business.id));
      const usersSnap = await getDocs(usersQuery);
      setBusinessUsersCount(usersSnap.size);

    } catch (err) {
      console.error("Error fetching billing data:", err);
      toast.error("Failed to load billing information");
    } finally {
      setLoading(false);
    }
  }, [business]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleUpdatePlan = async (planId: string) => {
    if (!subscription || !business) return;
    setActionLoading('upgrading');
    try {
      // eslint-disable-next-line react-hooks/purity
      const now = Date.now();
      await updateDoc(doc(db, 'subscriptions', subscription.id), {
        planId,
        updatedAt: now,
        status: 'active', // If they were trialing or past_due, assume fix
      });
      toast.success("Plan updated successfully");
      fetchData();
    } catch (err) {
      toast.error("Failed to update plan");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    setActionLoading('cancelling');
    try {
      await updateDoc(doc(db, 'subscriptions', subscription.id), {
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        cancelReason: cancelFeedback,
        updatedAt: Date.now(),
      });
      toast.success("Subscription cancelled. You'll have access until the end of original period.");
      setShowCancelModal(false);
      fetchData();
    } catch (err) {
      toast.error("Failed to cancel subscription");
    } finally {
      setActionLoading(null);
    }
  };

  const currentPlan = plans.find(p => p.id === subscription?.planId) || (subscription?.planId === 'trial_default' ? {
    id: 'trial_default',
    name: 'Trial Period',
    price: 0,
    interval: 'monthly',
    features: ['Access to all core features', 'Basic support'],
    maxUsers: 5,
    maxBusinesses: 1,
    status: 'active',
  } : null);

  useEffect(() => {
    if (subscription?.status === 'trialing' && subscription.trialEndDate) {
      const daysLeft = Math.ceil((subscription.trialEndDate - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 3 && daysLeft > 0) {
        toast.warning(`Your trial ends in ${daysLeft} days. Upgrade now to keep access!`, {
          duration: 10000,
        });
      }
    }
  }, [subscription]);

  const trialDaysLeft = React.useMemo(() => {
    if (!subscription?.trialEndDate && !subscription?.currentPeriodEnd) return 0;
    // eslint-disable-next-line react-hooks/purity
    return Math.ceil(((subscription.trialEndDate || subscription.currentPeriodEnd) - Date.now()) / (1000 * 60 * 60 * 24));
  }, [subscription?.trialEndDate, subscription?.currentPeriodEnd]);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 pb-20">
      <header>
        <h1 className="text-3xl font-black text-slate-900 italic tracking-tight">Billing & Subscription</h1>
        <p className="text-slate-500 font-medium">Manage your plan and organization limits.</p>
      </header>

      {/* Trial Banner */}
      {subscription?.status === 'trialing' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
            <Clock size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">Trial Period Active</p>
            <p className="text-xs text-amber-700">Your trial ends on {new Date(subscription.trialEndDate || subscription.currentPeriodEnd).toLocaleDateString()}. Subscribe to a plan to avoid service interruption.</p>
          </div>
          <div className="text-amber-900 font-black text-xl italic">
            {trialDaysLeft} Days Left
          </div>
        </div>
      )}

      {/* Plan Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2rem] border-2 border-slate-100 p-8 shadow-sm">
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Current Plan</p>
              <h2 className="text-3xl font-black text-slate-900 italic">{currentPlan?.name || 'No Active Plan'}</h2>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
              subscription?.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
              subscription?.status === 'trialing' ? 'bg-blue-50 text-blue-600' :
              'bg-slate-100 text-slate-500'
            }`}>
              {subscription?.status || 'Inactive'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Plan Usage</h3>
              
              <div className="space-y-3">
                {/* User Limit */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="flex items-center gap-1.5 text-slate-600"><UsersIcon size={14} /> Users</span>
                    <span className="text-slate-900">{businessUsersCount} / {currentPlan?.maxUsers === 0 ? '∞' : currentPlan?.maxUsers}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        currentPlan?.maxUsers && businessUsersCount / currentPlan.maxUsers > 0.9 ? 'bg-rose-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${currentPlan?.maxUsers ? Math.min((businessUsersCount / currentPlan.maxUsers) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* (Placeholder for other limits if any) */}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Billing Information</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500">Next Invoice</span>
                  <span className="text-slate-900">{subscription ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500">Amount</span>
                  <span className="text-slate-900">${currentPlan?.price || 0} / {currentPlan?.interval || '周期'}</span>
                </div>
                {subscription?.cancelAtPeriodEnd && (
                  <div className="flex items-center gap-2 text-rose-600 text-xs font-bold mt-4 bg-rose-50 p-2 rounded-lg">
                    <AlertCircle size={14} />
                    Cancelling at end of period
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[2rem] p-8 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <CreditCard size={100} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Monthly Spend</p>
            <h2 className="text-5xl font-black italic tracking-tighter">${currentPlan?.price || 0}</h2>
          </div>
          
          <div className="mt-8 space-y-3">
            <button className="w-full py-3 bg-white text-slate-900 rounded-xl font-bold text-sm shadow-lg hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
              Update Payment Method
            </button>
            {!subscription?.cancelAtPeriodEnd && (
               <button 
                onClick={() => setShowCancelModal(true)}
                className="w-full py-3 bg-slate-800 text-slate-400 rounded-xl font-bold text-sm hover:text-rose-400 transition-all"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Plan Selection */}
      <section className="space-y-6">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] italic">Available Plans_</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p) => {
            const isCurrent = p.id === subscription?.planId;
            return (
              <div key={p.id} className={`bg-white border-2 rounded-[2rem] p-8 transition-all flex flex-col ${
                isCurrent ? 'border-blue-600 shadow-xl' : 'border-slate-100 hover:border-slate-200'
              }`}>
                <div className="flex-1">
                  <h4 className="text-xl font-black italic mb-2">{p.name}</h4>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-black">${p.price}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">/{p.interval}</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs font-bold text-slate-600">
                        <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                    <li className="flex items-start gap-2 text-xs font-bold text-slate-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      Up to {p.maxUsers === 0 ? 'Unlimited' : p.maxUsers} Users
                    </li>
                  </ul>
                </div>
                
                <button 
                  disabled={isCurrent || actionLoading !== null}
                  onClick={() => handleUpdatePlan(p.id)}
                  className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                    isCurrent 
                      ? 'bg-slate-100 text-slate-400 cursor-default' 
                      : 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95'
                  }`}
                >
                  {actionLoading === 'upgrading' ? <Loader2 size={16} className="animate-spin" /> : null}
                  {isCurrent ? 'Current Plan' : (p.price > (currentPlan?.price || 0) ? 'Upgrade Now' : 'Downgrade Plan')}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl space-y-6">
            <h2 className="text-3xl font-black text-slate-900 italic tracking-tighter">Wait, don&apos;t go!</h2>
            <p className="text-slate-500 font-medium">We&apos;re sorry to see you go. Could you tell us why you are cancelling? Your feedback helps us improve.</p>
            
            <textarea 
              className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-2 border-transparent focus:border-rose-500 outline-none min-h-[120px] transition-all"
              placeholder="The reason for my departure is..."
              value={cancelFeedback}
              onChange={(e) => setCancelFeedback(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button 
                onClick={() => setShowCancelModal(false)}
                className="py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors"
              >
                Never mind
              </button>
              <button 
                onClick={handleCancelSubscription}
                disabled={actionLoading !== null}
                className="py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-600/20 hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
              >
                {actionLoading === 'cancelling' && <Loader2 size={14} className="animate-spin" />}
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

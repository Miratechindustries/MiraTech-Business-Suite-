'use client';

import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface SubscriptionActivationStatusCheckerProps {
  companyId: string;
  onActivated?: () => void;
}

export default function SubscriptionActivationStatusChecker({
  companyId,
  onActivated,
}: SubscriptionActivationStatusCheckerProps) {
  const [status, setStatus] = useState<'checking' | 'active' | 'processing' | 'past_due'>('checking');
  const [planName, setPlanName] = useState<string>('Standard');
  const [renewalDate, setRenewalDate] = useState<string>('');
  const [retryCount, setRetryCount] = useState<number>(0);

  const onActivatedRef = useRef(onActivated);
  onActivatedRef.current = onActivated;
  const hasTriggeredActivatedRef = useRef(false);

  useEffect(() => {
    if (!companyId) return;

    let isMounted = true;
    const checkStatus = async () => {
      try {
        const docRef = doc(db, 'companies', companyId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const subStatus = (data.subscriptionStatus || data.status || 'trialing').toLowerCase();
        const plan = data.subscriptionPlanId || data.subscriptionPlan || data.plan || 'Standard';
        const renewal = data.subscriptionRenewalDate || data.next_billing_date || data.renewalDate || '';

        if (!isMounted) return;

        setPlanName(plan);
        setRenewalDate(renewal);

        if (subStatus === 'active' || subStatus === 'trialing') {
          setStatus('active');
          if (!hasTriggeredActivatedRef.current) {
            hasTriggeredActivatedRef.current = true;
            if (onActivatedRef.current) onActivatedRef.current();
          }
        } else if (subStatus === 'past_due') {
          setStatus('past_due');
        } else {
          setStatus('processing');
        }
      } catch (err) {
        console.error('Error checking subscription status:', err);
      }
    };

    checkStatus();
    const interval = setInterval(() => {
      if (isMounted) {
        setRetryCount(c => c + 1);
        checkStatus();
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [companyId]);

  if (status === 'active') {
    return (
      <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs space-y-4 animate-in fade-in">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Subscription Verified &amp; Active</span>
            <h3 className="font-extrabold text-lg text-slate-900">{planName} Plan Operational</h3>
          </div>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          Your backend webhook synchronization has completed successfully. All module entitlements, invoicing quotas, and security features are fully active.
        </p>
        {renewalDate && (
          <div className="text-[11px] text-slate-600 font-medium pt-1">
            Next automated renewal / billing cycle: <strong className="text-slate-900">{new Date(renewalDate).toLocaleDateString()}</strong>
          </div>
        )}
      </div>
    );
  }

  if (status === 'past_due') {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-xs">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Billing Attention Required</span>
            <h3 className="font-extrabold text-lg text-slate-900">Subscription Past Due</h3>
          </div>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          We encountered an issue processing your latest recurring payment. Please update your payment instrument in settings to restore full write access.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-blue-50/70 border border-blue-200 rounded-2xl shadow-xs space-y-4 animate-in fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs animate-spin">
          <Loader2 className="w-6 h-6" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Backend Webhook Synchronization</span>
          <h3 className="font-extrabold text-lg text-slate-900">Processing Subscription Activation...</h3>
        </div>
      </div>
      <p className="text-xs text-slate-700 leading-relaxed">
        We are waiting for cryptographic confirmation and webhook notification from our payment processor. This typically takes 3 to 10 seconds.
      </p>
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-blue-100">
        <span className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
          Polling backend entitlement state (Attempt {retryCount + 1})...
        </span>
        <span className="font-semibold text-blue-700">Secure Billing Sync</span>
      </div>
    </div>
  );
}

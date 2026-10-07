'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SubscriptionPlan, getPlanPrice } from '../lib/subscriptions';
import { ShieldCheck, Check, AlertCircle, X, ArrowRight, Lock, ExternalLink } from 'lucide-react';

interface PaddleCheckoutModalProps {
  isOpen: boolean;
  plan: SubscriptionPlan | null;
  billingCycle: 'monthly' | 'annual';
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export default function PaddleCheckoutModal({
  isOpen,
  plan,
  billingCycle,
  onClose,
  onConfirm,
  loading = false,
}: PaddleCheckoutModalProps) {
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptRefund, setAcceptRefund] = useState(false);

  if (!isOpen || !plan) return null;

  const price = getPlanPrice(plan, billingCycle);

  const handleProceed = () => {
    if (!acceptTerms || !acceptRefund) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">Pre-Checkout Confirmation</h3>
              <p className="text-[11px] text-slate-300">Secure Enterprise Subscription Checkout</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-xs text-slate-700">
          {/* Selected Plan Summary Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">Selected Subscription Plan</span>
                <h4 className="font-extrabold text-base text-slate-900">{plan.name}</h4>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-slate-900">${price}</span>
                <span className="text-[11px] text-slate-500 block">/{billingCycle === 'annual' ? 'year' : 'month'}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-slate-600 text-[11px]">
              <div className="flex justify-between">
                <span>Billing Interval:</span>
                <strong className="text-slate-900 capitalize">{billingCycle} (Auto-renewing)</strong>
              </div>
              <div className="flex justify-between">
                <span>Evaluation Trial:</span>
                <strong className="text-emerald-600">14-Day Free Trial Included</strong>
              </div>
              <div className="flex justify-between">
                <span>Secure Processor:</span>
                <strong className="text-slate-900">Certified payment gateway</strong>
              </div>
            </div>
          </div>

          {/* Subscription & Recurring Notice */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2 text-[11px] text-slate-700 leading-relaxed">
            <strong className="text-blue-900 block font-bold">Recurring Subscription &amp; Cancellation Terms</strong>
            <p>
              By checking out, you authorize our secure billing processor to charge your payment method automatically on a recurring {billingCycle} basis until you cancel. You may cancel instantly at any time via your workspace settings with zero cancellation fees.
            </p>
          </div>

          {/* Mandatory Checkboxes */}
          <div className="space-y-3 pt-1 border-t border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer shrink-0"
              />
              <span className="text-slate-700 leading-normal">
                I explicitly accept the{' '}
                <Link href="/terms" target="_blank" className="text-blue-600 underline font-bold hover:text-blue-800">
                  Terms &amp; Conditions
                </Link>{' '}
                and acknowledge that my order is processed via our secure PCI-compliant processor.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptRefund}
                onChange={(e) => setAcceptRefund(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer shrink-0"
              />
              <span className="text-slate-700 leading-normal">
                I have read and agree to the{' '}
                <Link href="/refund" target="_blank" className="text-blue-600 underline font-bold hover:text-blue-800">
                  Refund &amp; Cancellation Policy
                </Link>{' '}
                and the 14-day annual money-back guarantee terms.
              </span>
            </label>
          </div>

          {/* Footer Legal links */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-100">
            <Link href="/privacy" target="_blank" className="hover:text-blue-600 underline flex items-center gap-1">
              <span>Privacy Policy</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <Lock className="w-3 h-3" /> PCI-DSS Level 1 Secure Checkout
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!acceptTerms || !acceptRefund || loading}
            onClick={handleProceed}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span>Preparing Checkout...</span>
            ) : (
              <>
                <span>Proceed to Secure Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

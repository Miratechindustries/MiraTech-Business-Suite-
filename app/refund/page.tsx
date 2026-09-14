'use client';

import React from 'react';
import Link from 'next/link';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { RefreshCw, ShieldCheck, HelpCircle, Mail, ArrowRight } from 'lucide-react';

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header */}
          <div className="space-y-4 border-b border-slate-200 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Commercial Policy & Guarantees</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Refund &amp; Cancellation Policy
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span><strong>Effective Date:</strong> January 1, 2026</span>
              <span>•</span>
              <span><strong>Merchant of Record:</strong> Paddle.com</span>
              <span>•</span>
              <span><strong>Brand:</strong> MiraTech Business Suite / MiraTech Industries</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              MiraTech Business Suite is a cloud-based business management SaaS platform for small and medium-sized businesses. This policy outlines our evaluation trials, recurring subscription billing terms, cancellation procedures, and refund guidelines.
            </p>
          </div>

          {/* Refund Policy Text */}
          <div className="space-y-10 text-xs sm:text-sm text-slate-700 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
                1. 14-Day Free Evaluation Trial
              </h2>
              <p>
                Every newly provisioned corporate workspace receives a full-featured 14-day evaluation trial of their selected plan. No charges are processed during the trial period. You may explore all modules and test system capabilities without financial obligation. If you cancel prior to the 14th day, no subscription fees will ever be charged.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
                2. When Billing Begins & Recurring Schedules
              </h2>
              <p>
                Upon the conclusion of the 14-day free evaluation trial, your selected payment instrument will be billed automatically by our Merchant of Record (Paddle.com) for the chosen subscription tier (monthly or annual). Subscriptions renew automatically on a recurring schedule at the start of each billing cycle unless cancelled prior to the renewal timestamp.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
                3. How Customers Cancel & When Cancellation Takes Effect
              </h2>
              <p>
                <strong>Self-Service Cancellation:</strong> You can cancel your subscription at any time with one click directly from within your MiraTech workspace under <em>Settings &gt; Subscriptions</em>, or through the self-service Paddle Customer Portal. There are no cancellation fees or penalties.
              </p>
              <p>
                <strong>Effect of Cancellation:</strong> When you cancel, your subscription will not auto-renew for the subsequent billing period. Your workspace remains fully functional and accessible until the end of your current prepaid billing cycle.
              </p>
            </section>

            <section className="space-y-3 bg-blue-50/70 p-6 rounded-2xl border border-blue-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span>4. Refund Eligibility & Paddle&apos;s Role</span>
              </h2>
              <p className="text-slate-800 font-medium">
                Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 pt-2">
                <li>
                  <strong>Annual Subscriptions:</strong> Covered by a 14-day money-back guarantee from the initial payment date following the trial. Requests submitted within 14 days of initial annual billing are eligible for a full refund.
                </li>
                <li>
                  <strong>Monthly Subscriptions:</strong> Monthly subscription fees are generally non-refundable once billed, given the immediate availability of cloud resources and software access. Exceptional billing disputes are reviewed on a case-by-case basis by our support desk.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
                5. How Customers Request Refunds
              </h2>
              <p>
                To request an eligible refund or inquire about a billing transaction, please contact our support desk or Paddle customer service with your transaction ID / order reference:
              </p>
              <div className="space-y-1 text-xs pt-1">
                <p><strong>Support Email:</strong> <a href="mailto:miratechindustries@gmail.com" className="text-blue-600 underline">miratechindustries@gmail.com</a></p>
                <p><strong>Support Phone:</strong> <a href="tel:+26879427339" className="text-blue-600 underline font-mono">+268 7942 7339</a> / <a href="tel:+26876427339" className="text-blue-600 underline font-mono">+268 7642 7339</a></p>
                <p><strong>Merchant Help Center:</strong> Accessible via your Paddle receipt email link or customer portal.</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

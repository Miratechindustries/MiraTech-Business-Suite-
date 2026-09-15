'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  SUBSCRIPTION_PLANS, 
  getPlanPrice 
} from '../../lib/subscriptions';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { 
  Check, 
  Sparkles, 
  ShieldCheck, 
  CreditCard, 
  HelpCircle, 
  ArrowRight, 
  Clock, 
  FileText,
  Building2,
  RefreshCw,
  Users
} from 'lucide-react';

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const pricingFaqs = [
    {
      q: "How does the 14-day free trial work?",
      a: "Every new corporate tenant receives a full-featured 14-day evaluation trial of their chosen plan. You can explore all enterprise modules with no upfront billing and no commitment. You can upgrade, change tiers, or cancel at any point."
    },
    {
      q: "What payment methods are supported?",
      a: "All subscription transactions are processed by Paddle.com Market Ltd as our Merchant of Record. We accept major credit cards, PayPal, Apple Pay, Google Pay, and regional wire transfers."
    },
    {
      q: "How does recurring subscription billing work?",
      a: "Subscriptions are billed automatically at the beginning of each billing interval (monthly or annually) according to your selected tier. Digital VAT/tax-compliant PDF receipts are delivered automatically to your company billing administrator."
    },
    {
      q: "How do I cancel my subscription?",
      a: "You can cancel your subscription at any time without fees or penalties. You can cancel directly from within your MiraTech workspace under Settings > Subscriptions, or through the self-service Paddle Customer Portal. Your account remains active until the end of your paid billing period."
    },
    {
      q: "What is your refund policy?",
      a: "We offer a 14-day money-back guarantee for annual subscription plans. For monthly plans, billing disputes can be submitted to our finance desk. For complete details, review our published Refund & Cancellation Policy."
    },
    {
      q: "Can I upgrade or downgrade between tiers?",
      a: "Yes. Administrators can change tiers at any time. When upgrading, new user quotas and modules are unlocked immediately with prorated billing handled automatically by Paddle."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Header Banner */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Transparent Enterprise SaaS Subscriptions</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Plans Engineered for Modern Business Scale
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              MiraTech Business Suite is a cloud-based business management SaaS platform for small and medium-sized businesses. Customers purchase recurring subscription plans to access the platform and its features. Billed securely through Paddle.
            </p>

            {/* Billing Cycle Switcher */}
            <div className="pt-4 flex justify-center">
              <div className="inline-flex items-center bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    billingCycle === 'annual'
                      ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Annual Billing</span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const isPopular = plan.id === 'professional';
              const price = getPlanPrice(plan, billingCycle);

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl p-6 flex flex-col justify-between border transition-all duration-200 relative ${
                    isPopular
                      ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-lg scale-102 z-10'
                      : 'border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs">
                      Most Popular Tier
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{plan.name}</h3>
                      <p className="text-xs text-slate-600 mt-1 min-h-[38px] leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    <div className="pt-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-900">R{price}</span>
                        <span className="text-xs text-slate-500 font-medium">/{billingCycle === 'annual' ? 'year' : 'month'}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {billingCycle === 'annual' ? 'Billed annually as recurring subscription' : 'Billed monthly as recurring subscription'}
                      </p>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1.5 border-t border-slate-100 pt-3">
                      <p className="flex justify-between">
                        <span>Admin Seats:</span>
                        <strong className="text-slate-900">{plan.maxAdmin === 9999 ? 'Unlimited' : plan.maxAdmin}</strong>
                      </p>
                      <p className="flex justify-between">
                        <span>Staff Seats:</span>
                        <strong className="text-slate-900">{plan.maxStaff === 9999 ? 'Unlimited' : plan.maxStaff}</strong>
                      </p>
                      <p className="flex justify-between">
                        <span>Evaluation Trial:</span>
                        <strong className="text-emerald-600">14 Days Free</strong>
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Core Features Included:</span>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {plan.features.slice(0, 4).map((feat, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-100 space-y-2">
                    <Link
                      href={`/register?plan=${plan.id}`}
                      className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        isPopular
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <span>Start 14-Day Free Trial</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <p className="text-[10px] text-center text-slate-500">
                      Recurring billing • Cancel anytime
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paddle Merchant of Record & Subscription Disclosure */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 space-y-6 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">Secure Recurring Billing &amp; Merchant of Record Notice</h3>
                <p className="text-xs text-slate-600">
                  MiraTech Business Suite subscription plans are continuous recurring services that automatically renew until cancelled.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <strong className="text-slate-900 block">Paddle Merchant of Record</strong>
                <p>
                  Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all orders, handling tax collection, compliance, and payments.
                </p>
              </div>
              <div className="space-y-1">
                <strong className="text-slate-900 block">Trial &amp; Cancellation Terms</strong>
                <p>
                  All paid tiers begin with a 14-day free evaluation trial. You may cancel with one click at any time from your workspace settings or via the Paddle portal with zero fees.
                </p>
              </div>
              <div className="space-y-1">
                <strong className="text-slate-900 block">Support &amp; Inquiries</strong>
                <p>
                  For billing questions, VAT receipts, or refund requests, contact our customer desk at <a href="mailto:miratechindustries@gmail.com" className="text-blue-600 underline">miratechindustries@gmail.com</a>.
                </p>
              </div>
            </div>
          </div>

          {/* Pricing FAQ Section */}
          <div className="max-w-4xl mx-auto space-y-8 pt-6">
            <div className="text-center space-y-2">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Frequently Asked Pricing Questions
              </h3>
              <p className="text-xs text-slate-600">
                Everything you need to know about billing cycles, trials, and Paddle checkout.
              </p>
            </div>

            <div className="space-y-4">
              {pricingFaqs.map((faq, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2 shadow-xs">
                  <h4 className="font-bold text-sm text-slate-900">{faq.q}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

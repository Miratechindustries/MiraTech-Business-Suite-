'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  SUBSCRIPTION_PLANS, 
  SubscriptionPlan, 
  getPlanPrice, 
  formatPlanPrice,
  ALL_FEATURES
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

  const comparisonModules = [
    { id: 'quotations', name: 'Quotations & Estimates' },
    { id: 'invoices', name: 'Tax Invoices & Accounts Receivable' },
    { id: 'receipts', name: 'Receipts & Payment Proofs' },
    { id: 'inventory', name: 'Multi-Warehouse Inventory Stock Control' },
    { id: 'clients', name: 'CRM & Client Directory' },
    { id: 'transactions', name: 'Double-Entry Financial Transactions' },
    { id: 'reports', name: 'Executive P&L & Balance Sheet Analytics' },
    { id: 'audit', name: 'Cryptographic Cyber Audit Logs' },
    { id: 'payroll', name: 'Automated HR & Salary Payroll' },
    { id: 'projects', name: 'Project Workspace & Sprint Tasks' },
    { id: 'procurement', name: 'Procurement & 3-Way Match Verification' },
    { id: 'audit_center', name: 'Institutional Compliance & SecOps Center' },
  ];

  const pricingFaqs = [
    {
      q: "How does the 14-day free trial work?",
      a: "Every new corporate tenant receives a full-featured 14-day evaluation trial of their chosen plan. You can explore all enterprise modules with no upfront billing and no commitment. You can upgrade, change tiers, or cancel at any point."
    },
    {
      q: "What payment methods are supported?",
      a: "All subscription transactions are processed by Paddle.com Market Ltd as our Merchant of Record. We accept major credit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, Google Pay, and regional wire transfers."
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
    <div className="min-h-screen bg-[#070D1E] text-white flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Header Banner */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Transparent Enterprise SaaS Subscriptions</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
              Plans Engineered for Modern Business Scale
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Every plan includes enterprise encryption, multi-tenant isolation, automatic daily backups, and a 14-day free evaluation trial. Billed securely through Paddle.
            </p>

            {/* Billing Cycle Switcher */}
            <div className="pt-4 flex justify-center">
              <div className="inline-flex items-center bg-[#0B132B] p-1.5 rounded-2xl border border-slate-700 shadow-lg">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    billingCycle === 'annual'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Annual Billing</span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-black">
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
                  className={`bg-[#0B132B] rounded-2xl p-6 flex flex-col justify-between border transition-all duration-200 relative ${
                    isPopular
                      ? 'border-amber-500 ring-2 ring-amber-500/30 shadow-2xl scale-102 z-10'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-3.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md">
                      Most Popular Tier
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-bold text-lg text-white">{plan.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 min-h-[38px] leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    <div className="pt-2 pb-4 border-b border-slate-800">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white">
                          ${price.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">
                          /{billingCycle === 'annual' ? 'yr' : 'mo'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {billingCycle === 'annual'
                          ? 'Billed annually (includes 20% discount)'
                          : 'Billed monthly, cancel anytime'}
                      </p>
                    </div>

                    {/* Quota Specs */}
                    <div className="space-y-2 text-xs py-2">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Users className="w-3.5 h-3.5 text-amber-400" />
                          <span>Admins:</span>
                        </span>
                        <span className="font-bold text-white">
                          {plan.maxAdmin === 9999 ? 'Unlimited' : plan.maxAdmin}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Users className="w-3.5 h-3.5 text-amber-400" />
                          <span>Staff Allowed:</span>
                        </span>
                        <span className="font-bold text-white">
                          {plan.maxStaff === 9999 ? 'Unlimited' : plan.maxStaff}
                        </span>
                      </div>
                    </div>

                    {/* Included Features List */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Included Workflows:
                      </span>
                      <ul className="space-y-2 text-xs text-slate-300">
                        {plan.features.slice(0, 7).map((featId) => {
                          const featureObj = ALL_FEATURES.find(f => f.id === featId);
                          return (
                            <li key={featId} className="flex items-start gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                              <span className="line-clamp-1">{featureObj?.label || featId}</span>
                            </li>
                          );
                        })}
                        {plan.features.length > 7 && (
                          <li className="text-[11px] text-amber-400 font-semibold pl-5">
                            + {plan.features.length - 7} more advanced modules
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-800">
                    <Link
                      href={`/register?plan=${plan.id}&cycle=${billingCycle}`}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isPopular
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md hover:shadow-amber-500/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      <span>Start 14-Day Free Trial</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Merchant of Record & Billing Transparency Box */}
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-8 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-amber-400">
                  <Clock className="w-5 h-5" />
                  <h4 className="font-bold text-sm text-white">14-Day Free Evaluation</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every workspace begins with a 14-day evaluation trial. Test every feature, invite team members, and configure ledgers. No obligation and cancel anytime before trial completion.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-amber-400">
                  <CreditCard className="w-5 h-5" />
                  <h4 className="font-bold text-sm text-white">Paddle Merchant of Record</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle handles sales tax calculation (VAT/GST), automated recurring billing, and Level 1 PCI-DSS compliance.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-amber-400">
                  <RefreshCw className="w-5 h-5" />
                  <h4 className="font-bold text-sm text-white">Cancellation & Refunds</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Cancel anytime via Workspace Settings or the Paddle Customer Portal. Annual plans include a 14-day money-back guarantee. Read our full{' '}
                  <Link href="/refund" className="text-amber-400 underline hover:text-amber-300">
                    Refund & Cancellation Policy
                  </Link>.
                </p>
              </div>
            </div>
          </div>

          {/* Full Feature Comparison Matrix */}
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white">Full Feature Comparison Matrix</h2>
              <p className="text-xs text-slate-400 mt-1">
                Detailed comparison of capabilities, user seats, and operational governance across every tier.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] font-black uppercase tracking-wider">
                    <th className="py-3 px-4">Capability / Module</th>
                    {SUBSCRIPTION_PLANS.map((p) => (
                      <th key={p.id} className="py-3 px-4 text-center text-white">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {/* Quotas */}
                  <tr className="bg-slate-900/40">
                    <td className="py-3 px-4 font-bold text-white">Max Administrator Accounts</td>
                    {SUBSCRIPTION_PLANS.map((p) => (
                      <td key={p.id} className="py-3 px-4 text-center font-bold text-amber-400">
                        {p.maxAdmin === 9999 ? 'Unlimited' : p.maxAdmin}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-slate-900/40">
                    <td className="py-3 px-4 font-bold text-white">Max Staff Accounts</td>
                    {SUBSCRIPTION_PLANS.map((p) => (
                      <td key={p.id} className="py-3 px-4 text-center font-bold text-amber-400">
                        {p.maxStaff === 9999 ? 'Unlimited' : p.maxStaff}
                      </td>
                    ))}
                  </tr>

                  {/* Modules */}
                  {comparisonModules.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-200">{m.name}</td>
                      {SUBSCRIPTION_PLANS.map((p) => {
                        const hasFeat = p.features.includes(m.id);
                        return (
                          <td key={p.id} className="py-3 px-4 text-center">
                            {hasFeat ? (
                              <span className="inline-flex p-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                                <Check className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="text-slate-600 font-mono text-sm">—</span>
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

          {/* Pricing FAQ */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white">Billing & Subscription FAQ</h2>
              <p className="text-xs text-slate-400 max-w-xl mx-auto">
                Direct answers regarding trial terms, recurring billing, Paddle Reseller guarantees, and subscription governance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {pricingFaqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-2"
                >
                  <h4 className="font-bold text-sm text-white flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>{faq.q}</span>
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed pl-6">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Final Action Strip */}
          <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 rounded-2xl p-8 sm:p-10 text-slate-950 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-2xl font-black tracking-tight">
                Ready to transform your enterprise operations?
              </h3>
              <p className="text-xs font-semibold text-slate-900 max-w-xl">
                Provision your company workspace in under 2 minutes with a 14-day free trial. Scale seamlessly with Paddle Merchant of Record protection.
              </p>
            </div>
            <Link
              href="/register"
              className="px-6 py-3 bg-[#0B132B] hover:bg-[#111A38] text-white font-bold text-xs rounded-xl shadow-xl transition-all cursor-pointer whitespace-nowrap"
            >
              Start 14-Day Free Trial
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

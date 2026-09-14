'use client';

import React from 'react';
import Link from 'next/link';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { RefreshCw, ShieldCheck, Clock, CheckCircle2, AlertCircle, Mail, ExternalLink, ArrowRight } from 'lucide-react';

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-[#070D1E] text-white flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header Banner */}
          <div className="space-y-4 border-b border-slate-800 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Consumer Protection & Billing Transparency</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Subscription, Refund & Cancellation Policy
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span><strong>Effective Date:</strong> January 1, 2026</span>
              <span>•</span>
              <span><strong>Version:</strong> v2.0 (Paddle Merchant of Record Compliant)</span>
              <span>•</span>
              <span><strong>Provider:</strong> MiraTech Industries</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-[#0B132B] p-4 rounded-xl border border-slate-800">
              At MiraTech Industries, customer transparency and satisfaction are our core priorities. This policy clearly outlines how subscription renewals, trial periods, cancellations, and refund eligibility operate for MiraTech Business Suite.
            </p>
          </div>

          {/* Key Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl w-fit">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm">14-Day Free Evaluation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every newly provisioned corporate workspace receives 14 days of unrestricted access. You may cancel at any point before trial conclusion without being charged.
              </p>
            </div>

            <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm">14-Day Money-Back Guarantee</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                For annual subscription plans, Customer is entitled to request a 100% full refund within 14 calendar days of the initial subscription payment.
              </p>
            </div>

            <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl w-fit">
                <RefreshCw className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm">Cancel Anytime Self-Service</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                No phone calls or complex tickets required. Cancel directly from your Workspace Settings or the Paddle Customer Portal with zero penalties.
              </p>
            </div>
          </div>

          {/* Detailed Policy Text */}
          <div className="space-y-10 text-xs sm:text-sm text-slate-300 leading-relaxed">
            {/* Paddle Merchant of Record Notice */}
            <section className="bg-[#0B132B] p-6 rounded-2xl border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="text-lg font-bold text-white">Paddle.com as Merchant of Record</h2>
              </div>
              <p className="text-slate-200">
                Our order process is conducted by our online reseller <strong>Paddle.com</strong>. Paddle.com is the Merchant of Record for all our orders. Paddle provides customer service inquiries regarding billing and payment disputes and handles refund processing.
              </p>
              <p className="text-slate-300">
                When you purchase a subscription or initiate a checkout, your transaction is processed in accordance with Paddle&apos;s Checkout Terms. Refund authorizations are executed via Paddle back to your original payment method.
              </p>
            </section>

            {/* Section 1: Recurring Billing */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                1. Subscription Billing Frequency & Automatic Renewal
              </h2>
              <p>
                MiraTech Business Suite subscription tiers (Starter, Growth, Professional, Elite, Enterprise) are billed on a recurring prepaid basis:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Monthly Plans:</strong> Billed automatically every 30 days on the anniversary of your subscription activation.
                </li>
                <li>
                  <strong>Annual Plans:</strong> Billed automatically every 365 days, incorporating a 20% promotional discount compared to monthly pricing.
                </li>
              </ul>
              <p>
                Subscriptions automatically renew unless explicitly cancelled prior to the renewal date. An electronic invoice and payment confirmation will be emailed to your billing administrator by Paddle upon each successful renewal.
              </p>
            </section>

            {/* Section 2: 14-Day Free Trial */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                2. 14-Day Free Evaluation Trial
              </h2>
              <p>
                All new corporate workspaces are eligible for a 14-day evaluation trial of their chosen plan tier. During this period:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>You have complete access to all included modules, reporting tools, and user quotas.</li>
                <li>No charges are executed during the 14-day trial window.</li>
                <li>If you cancel prior to the expiration of the 14th day, your credit card will never be charged.</li>
                <li>If you choose to continue using the software after the 14 days, your subscription will activate on the plan tier selected during registration.</li>
              </ul>
            </section>

            {/* Section 3: Cancellation Procedures */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                3. Step-by-Step Cancellation Procedures
              </h2>
              <p>
                We believe in frictionless self-service cancellation without cumbersome hurdles. You can cancel your subscription at any time using either of the following two methods:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-5 bg-[#0B132B] border border-slate-800 rounded-xl space-y-2">
                  <h4 className="font-bold text-white text-xs">Method A: Inside Workspace</h4>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-300 text-xs">
                    <li>Log in to your workspace at <Link href="/login" className="text-amber-400 underline">miratechsuite.com/login</Link></li>
                    <li>Navigate to <strong>Settings &gt; Subscriptions</strong></li>
                    <li>Locate <strong>Subscription Auto-Renewal</strong> toggle</li>
                    <li>Switch toggle to <strong>Auto-Renew OFF</strong> or click <strong>Cancel Plan</strong></li>
                  </ol>
                </div>
                <div className="p-5 bg-[#0B132B] border border-slate-800 rounded-xl space-y-2">
                  <h4 className="font-bold text-white text-xs">Method B: Paddle Customer Portal</h4>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-300 text-xs">
                    <li>Click the <strong>Paddle Customer Portal</strong> link in any receipt email</li>
                    <li>Authenticate using your corporate email address</li>
                    <li>Click <strong>Cancel Subscription</strong> under Active Subscriptions</li>
                  </ol>
                </div>
              </div>
              <p className="pt-2">
                <strong>Post-Cancellation Access:</strong> After cancellation, your workspace remains fully active and accessible until the end of your current paid billing period. There are no cancellation fees, penalty charges, or retroactive surcharges.
              </p>
            </section>

            {/* Section 4: Refund Eligibility */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                4. Refund Eligibility Criteria
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Annual Subscription Plans:</strong> Eligible for a <strong>100% full refund</strong> if requested within fourteen (14) calendar days of the initial subscription payment.
                </li>
                <li>
                  <strong>Monthly Subscription Plans:</strong> Monthly recurring fees are generally non-refundable once charged, as the service is made immediately available. However, if you experienced an inadvertent renewal and submit a request within 48 hours without having utilized platform services, our billing desk will review your request in good faith.
                </li>
                <li>
                  <strong>SLA Availability Breaches:</strong> If MiraTech fails to achieve its published 99.95% annual uptime SLA in a given billing cycle, Customer is eligible for proportional service credits applied to subsequent billing cycles.
                </li>
                <li>
                  <strong>Non-Refundable Services:</strong> Custom implementation engineering, dedicated migration consulting, and third-party transactional messaging fees are strictly non-refundable.
                </li>
              </ul>
            </section>

            {/* Section 5: Dispute Resolution */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                5. How to Submit a Refund or Billing Inquiry
              </h2>
              <p>
                To request a refund under our 14-day annual plan guarantee or dispute an unexpected billing charge, submit an email to our specialized finance desk:
              </p>
              <div className="bg-[#0B132B] p-6 rounded-2xl border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>MiraTech Finance & Billing Desk</span>
                </div>
                <p>
                  <strong>Primary Email:</strong> <a href="mailto:miratechindustries@gmail.com" className="text-amber-400 font-bold underline">miratechindustries@gmail.com</a>
                </p>
                <p>
                  <strong>Secondary Billing Desk:</strong> <a href="mailto:billing@miratechsuite.com" className="text-amber-400 underline">billing@miratechsuite.com</a>
                </p>
                <p>
                  <strong>Required Information:</strong> Corporate Entity Name, Workspace Administrator Email, and Paddle Transaction ID (found on your PDF invoice, formatted as <code className="font-mono text-amber-300">txn_...</code>).
                </p>
                <p className="text-slate-400 pt-1">
                  <strong>Resolution Commitment:</strong> Our finance team reviews all billing inquiries within <strong>three (3) business days</strong>. Once an authorized refund is approved, funds are credited back to your original payment method via Paddle within 3–7 business days depending on your banking institution.
                </p>
              </div>
            </section>
          </div>

          {/* Quick Links Footer Strip */}
          <div className="border-t border-slate-800 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex gap-4">
              <Link href="/terms" className="text-amber-400 hover:underline">
                View Terms of Service &rarr;
              </Link>
              <Link href="/pricing" className="text-amber-400 hover:underline">
                View Pricing Plans &rarr;
              </Link>
            </div>
            <Link
              href="/register"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition"
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
